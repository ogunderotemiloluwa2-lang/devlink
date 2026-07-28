const Conversation = require("../models/Conversation.model");

/**
 * Safely extracts a comparable id string whether `value` is a raw ObjectId
 * (unpopulated ref) or a populated document (has ._id). Mongoose documents
 * don't override toString() the way ObjectId does, so comparing a populated
 * participant.user directly against another id with .toString() silently
 * breaks — this is the single place that logic lives.
 */
function idOf(value) {
  return (value?._id ?? value).toString();
}

/**
 * Finds an existing direct conversation between exactly these two users
 * (regardless of who "started" it), or null.
 */
async function findDirectConversation(userIdA, userIdB) {
  return Conversation.findOne({
    type: "direct",
    "participants.user": { $all: [userIdA, userIdB] },
    $expr: { $eq: [{ $size: "$participants" }, 2] },
  });
}

function getParticipant(conversation, userId) {
  if (!userId) return undefined;
  const target = idOf(userId);
  return conversation.participants.find((p) => idOf(p.user) === target);
}

function isActiveParticipant(conversation, userId) {
  const p = getParticipant(conversation, userId);
  return !!p && p.status === "active";
}

function isGroupAdmin(conversation, userId) {
  const p = getParticipant(conversation, userId);
  return !!p && p.role === "admin";
}

/**
 * Increments unreadCount for every active participant except the sender,
 * and refreshes the denormalized lastMessage preview — all in one write.
 */
async function applyNewMessageToConversation(conversation, message, senderId) {
  const senderIdStr = idOf(senderId);
  conversation.participants.forEach((p) => {
    if (p.status === "active" && idOf(p.user) !== senderIdStr) {
      p.unreadCount += 1;
    }
  });

  conversation.lastMessage = {
    sender: senderId,
    preview: message.content?.slice(0, 120) || (message.attachments?.length ? "Sent an attachment" : ""),
    hasAttachment: (message.attachments?.length || 0) > 0,
    sentAt: message.createdAt,
  };
  conversation.lastActivityAt = message.createdAt;

  await conversation.save();
}

function markParticipantRead(conversation, userId) {
  const p = getParticipant(conversation, userId);
  if (!p) return;
  p.unreadCount = 0;
  p.lastReadAt = new Date();
}

module.exports = {
  idOf,
  findDirectConversation,
  getParticipant,
  isActiveParticipant,
  isGroupAdmin,
  applyNewMessageToConversation,
  markParticipantRead,
};
