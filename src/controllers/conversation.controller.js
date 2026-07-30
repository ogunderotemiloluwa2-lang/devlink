const Conversation = require("../models/Conversation.model");
const Message = require("../models/Message.model");
const User = require("../models/User.model");
const catchAsync = require("../utils/catchAsync");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const { encodeCursor, cursorFilter } = require("../utils/cursorPagination");
const {
  findDirectConversation,
  getParticipant,
  isActiveParticipant,
  isGroupAdmin,
  markParticipantRead,
} = require("../services/conversation.service");
const { uploadImage, deleteAsset } = require("../services/cloudinary.service");
const presence = require("../services/presence.service");

const USER_SELECT = "name username avatarUrl role";

async function resolveActiveUser(username) {
  const user = await User.findOne({ username: username.trim().toLowerCase(), status: "active" });
  if (!user) throw ApiError.notFound("User not found");
  return user;
}

function shapeConversation(conversation, viewerId) {
  const obj = conversation.toObject();
  const viewer = getParticipant(conversation, viewerId);
  obj.viewerRole = viewer?.role || null;
  obj.unreadCount = viewer?.unreadCount || 0;

  if (conversation.type === "direct") {
    const otherParticipant = conversation.participants.find((p) => p.user._id.toString() !== viewerId.toString());
    obj.otherParticipant = otherParticipant?.user || null;
    if (obj.otherParticipant) obj.isOnline = presence.isOnline(obj.otherParticipant._id);
  } else {
    obj.onlineParticipantIds = presence.getOnlineUserIds(conversation.participants.map((p) => p.user._id));
  }

  return obj;
}

/**
 * POST /conversations (authenticated)
 * Direct: { participantUsername }. Group: { type: "group", groupName, participantUsernames: [] }.
 */
const createConversation = catchAsync(async (req, res) => {
  const { type = "direct" } = req.body;

  if (type === "group") {
    const { groupName, participantUsernames } = req.body;
    const usernames = [...new Set(participantUsernames.map((u) => u.trim().toLowerCase()))];
    const users = await User.find({ username: { $in: usernames }, status: "active" });
    if (users.length === 0) throw ApiError.badRequest("No valid participants found");

    const participants = [
      { user: req.user._id, role: "admin", status: "active" },
      ...users.map((u) => ({ user: u._id, role: "member", status: "active" })),
    ];

    const conversation = await Conversation.create({
      type: "group",
      groupName: groupName.trim(),
      participants,
      createdBy: req.user._id,
    });

    await conversation.populate("participants.user", USER_SELECT);
    return new ApiResponse(201, { conversation: shapeConversation(conversation, req.user._id) }, "Group created").send(res);
  }

  const { participantUsername } = req.body;
  const target = await resolveActiveUser(participantUsername);
  if (target._id.equals(req.user._id)) throw ApiError.badRequest("You cannot message yourself");

  const existing = await findDirectConversation(req.user._id, target._id);
  if (existing) {
    await existing.populate("participants.user", USER_SELECT);
    return new ApiResponse(200, { conversation: shapeConversation(existing, req.user._id) }, "Conversation already exists").send(res);
  }

  const conversation = await Conversation.create({
    type: "direct",
    participants: [
      { user: req.user._id, status: "active" },
      { user: target._id, status: "active" },
    ],
    createdBy: req.user._id,
  });

  await conversation.populate("participants.user", USER_SELECT);
  return new ApiResponse(201, { conversation: shapeConversation(conversation, req.user._id) }, "Conversation created").send(res);
});

/**
 * GET /conversations (cursor-paginated, sorted by most recent activity)
 */
const getMyConversations = catchAsync(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);

  const filter = {
    participants: { $elemMatch: { user: req.user._id, status: "active" } },
  };
  const cursorPart = cursorFilter(req.query.cursor, "lastActivityAt");
  const finalFilter = Object.keys(cursorPart).length ? { $and: [filter, cursorPart] } : filter;

  const conversations = await Conversation.find(finalFilter)
    .populate("participants.user", USER_SELECT)
    .populate("lastMessage.sender", USER_SELECT)
    .sort({ lastActivityAt: -1, _id: -1 })
    .limit(limit + 1);

  const hasMore = conversations.length > limit;
  const page = conversations.slice(0, limit);
  const shaped = page.map((c) => shapeConversation(c, req.user._id));
  const nextCursor = hasMore ? encodeCursor(page[page.length - 1], "lastActivityAt") : null;

  return new ApiResponse(200, { conversations: shaped, nextCursor, hasMore }, "Conversations fetched").send(res);
});

/**
 * GET /conversations/unread-count (authenticated)
 */
const getUnreadCount = catchAsync(async (req, res) => {
  const conversations = await Conversation.find({
    participants: { $elemMatch: { user: req.user._id, status: "active" } },
  }).select("participants");

  const totalUnread = conversations.reduce((sum, c) => {
    const p = getParticipant(c, req.user._id);
    return sum + (p?.unreadCount || 0);
  }, 0);

  return new ApiResponse(200, { unreadCount: totalUnread }, "Unread count fetched").send(res);
});

/**
 * GET /conversations/:id
 */
const getConversation = catchAsync(async (req, res) => {
  const conversation = await Conversation.findById(req.params.id).populate("participants.user", USER_SELECT);
  if (!conversation) throw ApiError.notFound("Conversation not found");
  if (!isActiveParticipant(conversation, req.user._id)) throw ApiError.forbidden("You are not part of this conversation");

  return new ApiResponse(200, { conversation: shapeConversation(conversation, req.user._id) }, "Conversation fetched").send(res);
});

/**
 * PATCH /conversations/:id (group admin only)
 */
const updateGroup = catchAsync(async (req, res) => {
  const conversation = await Conversation.findById(req.params.id);
  if (!conversation) throw ApiError.notFound("Conversation not found");
  if (conversation.type !== "group") throw ApiError.badRequest("Only group conversations can be edited");
  if (!isGroupAdmin(conversation, req.user._id)) throw ApiError.forbidden("Only group admins can edit this group");

  if (req.body.groupName !== undefined) conversation.groupName = req.body.groupName.trim();
  await conversation.save();
  await conversation.populate("participants.user", USER_SELECT);

  return new ApiResponse(200, { conversation: shapeConversation(conversation, req.user._id) }, "Group updated").send(res);
});

/**
 * POST /conversations/:id/avatar (group admin only, multipart "avatar")
 */
const uploadGroupAvatar = catchAsync(async (req, res) => {
  if (!req.file) throw ApiError.badRequest("No image file provided");
  const conversation = await Conversation.findById(req.params.id).select("+groupAvatarPublicId");
  if (!conversation) throw ApiError.notFound("Conversation not found");
  if (conversation.type !== "group") throw ApiError.badRequest("Only group conversations have an avatar");
  if (!isGroupAdmin(conversation, req.user._id)) throw ApiError.forbidden("Only group admins can update the avatar");

  const { url, publicId } = await uploadImage(req.file.buffer, "group-avatars", `conversation_${conversation._id}`);
  const oldPublicId = conversation.groupAvatarPublicId;
  conversation.groupAvatarUrl = url;
  conversation.groupAvatarPublicId = publicId;
  await conversation.save();
  if (oldPublicId && oldPublicId !== publicId) await deleteAsset(oldPublicId);

  return new ApiResponse(200, { groupAvatarUrl: url }, "Group avatar updated").send(res);
});

/**
 * DELETE /conversations/:id/avatar (group admin only)
 */
const deleteGroupAvatar = catchAsync(async (req, res) => {
  const conversation = await Conversation.findById(req.params.id).select("+groupAvatarPublicId");
  if (!conversation) throw ApiError.notFound("Conversation not found");
  if (conversation.type !== "group") throw ApiError.badRequest("Only group conversations have an avatar");
  if (!isGroupAdmin(conversation, req.user._id)) throw ApiError.forbidden("Only group admins can remove the avatar");

  if (conversation.groupAvatarPublicId) await deleteAsset(conversation.groupAvatarPublicId);
  conversation.groupAvatarUrl = null;
  conversation.groupAvatarPublicId = null;
  await conversation.save();

  return new ApiResponse(200, null, "Group avatar removed").send(res);
});

/**
 * POST /conversations/:id/participants (group admin only)
 */
const addParticipant = catchAsync(async (req, res) => {
  const conversation = await Conversation.findById(req.params.id);
  if (!conversation) throw ApiError.notFound("Conversation not found");
  if (conversation.type !== "group") throw ApiError.badRequest("Only group conversations support adding members");
  if (!isGroupAdmin(conversation, req.user._id)) throw ApiError.forbidden("Only group admins can add members");

  const target = await resolveActiveUser(req.body.username);
  const existing = getParticipant(conversation, target._id);

  if (existing && existing.status === "active") throw ApiError.conflict("This user is already in the group");
  if (existing) {
    existing.status = "active";
    existing.role = "member";
    existing.unreadCount = 0;
  } else {
    conversation.participants.push({ user: target._id, role: "member", status: "active" });
  }

  await conversation.save();
  await conversation.populate("participants.user", USER_SELECT);

  return new ApiResponse(200, { conversation: shapeConversation(conversation, req.user._id) }, `Added @${target.username}`).send(res);
});

/**
 * DELETE /conversations/:id/participants/:username (group admin only)
 */
const removeParticipant = catchAsync(async (req, res) => {
  const conversation = await Conversation.findById(req.params.id);
  if (!conversation) throw ApiError.notFound("Conversation not found");
  if (conversation.type !== "group") throw ApiError.badRequest("Only group conversations support removing members");
  if (!isGroupAdmin(conversation, req.user._id)) throw ApiError.forbidden("Only group admins can remove members");

  const target = await resolveActiveUser(req.params.username);
  const participant = getParticipant(conversation, target._id);
  if (!participant || participant.status !== "active") throw ApiError.notFound("This user is not in the group");

  participant.status = "removed";
  await conversation.save();

  return new ApiResponse(200, null, "Member removed from group").send(res);
});

/**
 * POST /conversations/:id/leave (group only)
 */
const leaveConversation = catchAsync(async (req, res) => {
  const conversation = await Conversation.findById(req.params.id);
  if (!conversation) throw ApiError.notFound("Conversation not found");
  if (conversation.type !== "group") throw ApiError.badRequest("Direct conversations can't be left");

  const participant = getParticipant(conversation, req.user._id);
  if (!participant || participant.status !== "active") throw ApiError.notFound("You are not in this group");

  participant.status = "left";

  // If the last admin leaves, promote the longest-standing remaining member.
  const remainingAdmins = conversation.participants.filter((p) => p.status === "active" && p.role === "admin");
  if (participant.role === "admin" && remainingAdmins.length === 0) {
    const nextAdmin = conversation.participants.find((p) => p.status === "active");
    if (nextAdmin) nextAdmin.role = "admin";
  }

  await conversation.save();
  return new ApiResponse(200, null, "You left the group").send(res);
});

/**
 * POST /conversations/:id/read (authenticated)
 */
const markConversationRead = catchAsync(async (req, res) => {
  const conversation = await Conversation.findById(req.params.id);
  if (!conversation) throw ApiError.notFound("Conversation not found");
  if (!isActiveParticipant(conversation, req.user._id)) throw ApiError.forbidden("You are not part of this conversation");

  markParticipantRead(conversation, req.user._id);
  await conversation.save();

  await Message.updateMany(
    { conversation: conversation._id, sender: { $ne: req.user._id }, "readBy.user": { $ne: req.user._id } },
    { $push: { readBy: { user: req.user._id, readAt: new Date() } } }
  );

  // Also mark messages as delivered to this user
  await Message.updateMany(
    { conversation: conversation._id, sender: { $ne: req.user._id }, "deliveredTo.user": { $ne: req.user._id } },
    { $addToSet: { deliveredTo: { user: req.user._id, deliveredAt: new Date() } } }
  );

  const io = req.app.get("io");
  io.to(`conversation:${conversation._id}`).emit("conversation:read", {
    conversationId: conversation._id,
    userId: req.user._id,
    readAt: new Date(),
  });

  return new ApiResponse(200, null, "Marked as read").send(res);
});

module.exports = {
  createConversation,
  getMyConversations,
  getUnreadCount,
  getConversation,
  updateGroup,
  uploadGroupAvatar,
  deleteGroupAvatar,
  addParticipant,
  removeParticipant,
  leaveConversation,
  markConversationRead,
};
