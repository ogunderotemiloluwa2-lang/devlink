const Conversation = require("../models/Conversation.model");
const Message = require("../models/Message.model");
const catchAsync = require("../utils/catchAsync");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const { encodeCursor, cursorFilter } = require("../utils/cursorPagination");
const { isActiveParticipant, applyNewMessageToConversation } = require("../services/conversation.service");
const { uploadMessageAttachment, deleteAsset } = require("../services/cloudinary.service");
const { createOrTouchMessageNotification } = require("../services/notification.service");

const USER_SELECT = "name username avatarUrl role";

async function resolveConversationForParticipant(conversationId, userId) {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw ApiError.notFound("Conversation not found");
  if (!isActiveParticipant(conversation, userId)) throw ApiError.forbidden("You are not part of this conversation");
  return conversation;
}

function emitToConversation(req, conversationId, event, payload) {
  const io = req.app.get("io");
  io.to(`conversation:${conversationId}`).emit(event, payload);
}

/**
 * GET /conversations/:id/messages (cursor-paginated, loads older messages)
 */
const getMessages = catchAsync(async (req, res) => {
  const conversation = await resolveConversationForParticipant(req.params.id, req.user._id);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);

  const baseFilter = { conversation: conversation._id };
  const cursorPart = cursorFilter(req.query.cursor);
  const filter = Object.keys(cursorPart).length ? { $and: [baseFilter, cursorPart] } : baseFilter;

  const messages = await Message.find(filter)
    .populate("sender", USER_SELECT)
    .populate({ path: "replyTo", select: "content sender isDeleted", populate: { path: "sender", select: USER_SELECT } })
    .populate("reactions.user", "username")
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1);

  const hasMore = messages.length > limit;
  const page = messages.slice(0, limit);
  const nextCursor = hasMore ? encodeCursor(page[page.length - 1]) : null;

  // Return in chronological order (oldest first) for natural rendering,
  // while pagination itself walks backward from the newest message.
  return new ApiResponse(200, { messages: page.reverse(), nextCursor, hasMore }, "Messages fetched").send(res);
});

/**
 * POST /conversations/:id/messages (multipart optional "attachments", up to 5)
 */
const sendMessage = catchAsync(async (req, res) => {
  const conversation = await resolveConversationForParticipant(req.params.id, req.user._id);
  const { content, replyTo } = req.body;

  if (!content?.trim() && (!req.files || req.files.length === 0)) {
    throw ApiError.badRequest("A message needs text content or at least one attachment");
  }

  if (replyTo) {
    const original = await Message.findOne({ _id: replyTo, conversation: conversation._id });
    if (!original) throw ApiError.notFound("The message you're replying to was not found");
  }

  let attachments = [];
  if (req.files && req.files.length > 0) {
    const uploads = await Promise.all(
      req.files.map((file, idx) =>
        uploadMessageAttachment(
          file.buffer,
          file.mimetype,
          "message-attachments",
          `msg_${conversation._id}_${Date.now()}_${idx}`
        ).then((result) => ({
          url: result.url,
          publicId: result.publicId,
          type: result.type,
          name: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          duration: result.duration || null,
        }))
      )
    );
    attachments = uploads;
  }

  const message = await Message.create({
    conversation: conversation._id,
    sender: req.user._id,
    content: content?.trim() || "",
    attachments,
    replyTo: replyTo || null,
    readBy: [{ user: req.user._id, readAt: new Date() }],
  });

  await applyNewMessageToConversation(conversation, message, req.user._id);

  await message.populate("sender", USER_SELECT);
  if (message.replyTo) {
    await message.populate({ path: "replyTo", select: "content sender isDeleted", populate: { path: "sender", select: USER_SELECT } });
  }

  emitToConversation(req, conversation._id, "message:new", message);

  // Mark message as delivered to online participants (those in the conversation room)
  const io = req.app.get("io");
  const room = io.sockets.adapter.rooms.get(`conversation:${conversation._id}`);
  const onlineParticipantIds = [];
  if (room) {
    for (const socketId of room) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket && socket.userId && !socket.userId.equals(req.user._id)) {
        onlineParticipantIds.push(socket.userId);
      }
    }
  }
  if (onlineParticipantIds.length > 0) {
    await Message.updateOne(
      { _id: message._id },
      { $addToSet: { deliveredTo: { $each: onlineParticipantIds.map((uid) => ({ user: uid, deliveredAt: new Date() })) } } }
    );
  }

  const notificationText =
    conversation.type === "group" ? `sent a message in ${conversation.groupName || "a group"}` : "sent you a message";

  await Promise.all(
    conversation.participants
      .filter((p) => p.status === "active" && !p.user.equals(req.user._id))
      .map((p) =>
        createOrTouchMessageNotification(io, {
          recipient: p.user,
          actor: req.user._id,
          text: notificationText,
          entityId: conversation._id,
        })
      )
  );

  return new ApiResponse(201, { message }, "Message sent").send(res);
});

/**
 * PATCH /messages/:messageId (sender only)
 */
const editMessage = catchAsync(async (req, res) => {
  const message = await Message.findById(req.params.messageId);
  if (!message || message.isDeleted) throw ApiError.notFound("Message not found");
  if (!message.sender.equals(req.user._id)) throw ApiError.forbidden("You can only edit your own messages");

  message.content = req.body.content.trim();
  message.isEdited = true;
  message.editedAt = new Date();
  await message.save();
  await message.populate("sender", USER_SELECT);

  emitToConversation(req, message.conversation, "message:updated", message);

  return new ApiResponse(200, { message }, "Message updated").send(res);
});

/**
 * DELETE /messages/:messageId (sender only — soft delete, "deleted for everyone")
 */
const deleteMessage = catchAsync(async (req, res) => {
  const message = await Message.findById(req.params.messageId).select("+attachments.publicId");
  if (!message || message.isDeleted) throw ApiError.notFound("Message not found");
  if (!message.sender.equals(req.user._id)) throw ApiError.forbidden("You can only delete your own messages");

  if (message.attachments?.length) {
    await Promise.all(
      message.attachments.map((a) =>
        deleteAsset(a.publicId, a.type === "image" ? "image" : a.type === "file" ? "raw" : "video")
      )
    );
  }

  message.isDeleted = true;
  message.deletedAt = new Date();
  message.content = "";
  message.attachments = [];
  await message.save();

  emitToConversation(req, message.conversation, "message:deleted", {
    messageId: message._id,
    conversationId: message.conversation,
  });

  return new ApiResponse(200, null, "Message deleted").send(res);
});

/**
 * POST /messages/:messageId/react (toggle — same emoji removes it, different emoji replaces)
 */
const reactToMessage = catchAsync(async (req, res) => {
  const message = await Message.findById(req.params.messageId);
  if (!message || message.isDeleted) throw ApiError.notFound("Message not found");

  const conversation = await Conversation.findById(message.conversation);
  if (!isActiveParticipant(conversation, req.user._id)) {
    throw ApiError.forbidden("You are not part of this conversation");
  }

  const { emoji } = req.body;
  const existingIndex = message.reactions.findIndex((r) => r.user.equals(req.user._id));

  let action;
  if (existingIndex === -1) {
    message.reactions.push({ user: req.user._id, emoji });
    action = "added";
  } else if (message.reactions[existingIndex].emoji === emoji) {
    message.reactions.splice(existingIndex, 1);
    action = "removed";
  } else {
    message.reactions[existingIndex].emoji = emoji;
    action = "changed";
  }

  await message.save();

  emitToConversation(req, message.conversation, "message:reaction", {
    messageId: message._id,
    conversationId: message.conversation,
    userId: req.user._id,
    emoji: action === "removed" ? null : emoji,
    action,
  });

  return new ApiResponse(200, { reactions: message.reactions, action }, "Reaction updated").send(res);
});

module.exports = { getMessages, sendMessage, editMessage, deleteMessage, reactToMessage };
