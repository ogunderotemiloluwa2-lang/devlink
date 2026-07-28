const Notification = require("../models/Notification.model");
const Profile = require("../models/Profile.model");
const logger = require("../utils/logger");

const USER_SELECT = "name username avatarUrl role";

// Maps a notification type to the Profile.notificationPreferences key that
// gates it. Types with no entry here (currently just "system") are never
// gated — they always get delivered.
const PREFERENCE_KEY_BY_TYPE = {
  follow: "follow",
  like: "like",
  comment: "comment",
  reply: "reply",
  mention: "mention",
  project_invite: "projectInvite",
  community_invite: "communityInvite",
  message: "message",
};

async function isEnabledForRecipient(recipientId, type) {
  const prefKey = PREFERENCE_KEY_BY_TYPE[type];
  if (!prefKey) return true; // system notifications are never gated
  const profile = await Profile.findOne({ user: recipientId }).select(`notificationPreferences.${prefKey}`);
  // Default to enabled if no profile/preference row exists yet.
  return profile?.notificationPreferences?.[prefKey] !== false;
}

/**
 * Creates a notification (respecting the recipient's preferences) and
 * pushes it in real time over the recipient's personal socket room.
 * Never notifies a user about their own action.
 *
 * @param {import('socket.io').Server} io
 * @param {object} params
 * @param {import('mongoose').Types.ObjectId} params.recipient
 * @param {import('mongoose').Types.ObjectId|null} params.actor
 * @param {string} params.type - one of Notification.TYPES
 * @param {string} params.text
 * @param {string} [params.entityType]
 * @param {import('mongoose').Types.ObjectId} [params.entityId]
 */
async function createNotification(io, { recipient, actor, type, text, entityType, entityId }) {
  try {
    if (actor && recipient.toString() === actor.toString()) return null;

    const enabled = await isEnabledForRecipient(recipient, type);
    if (!enabled) return null;

    const notification = await Notification.create({
      recipient,
      actor: actor || null,
      type,
      text,
      entityType: entityType || null,
      entityId: entityId || null,
    });

    await notification.populate("actor", USER_SELECT);

    io?.to(`user:${recipient}`).emit("notification:new", notification);

    return notification;
  } catch (err) {
    // A notification failure should never break the primary action (the
    // like, the comment, the invite) that triggered it.
    logger.error("Failed to create notification:", err.message);
    return null;
  }
}

/**
 * Message notifications are throttled: rather than one row per message in
 * a fast-moving conversation, we touch (refresh + mark unread again) the
 * existing unread notification for that conversation if one exists.
 */
async function createOrTouchMessageNotification(io, { recipient, actor, text, entityId }) {
  try {
    if (recipient.toString() === actor.toString()) return null;

    const enabled = await isEnabledForRecipient(recipient, "message");
    if (!enabled) return null;

    const existing = await Notification.findOne({
      recipient,
      type: "message",
      entityType: "Conversation",
      entityId,
      isRead: false,
    });

    if (existing) {
      existing.text = text;
      existing.actor = actor;
      existing.isRead = false;
      existing.readAt = null;
      existing.set("updatedAt", new Date());
      await existing.save();
      await existing.populate("actor", USER_SELECT);
      io?.to(`user:${recipient}`).emit("notification:new", existing);
      return existing;
    }

    return createNotification(io, {
      recipient,
      actor,
      type: "message",
      text,
      entityType: "Conversation",
      entityId,
    });
  } catch (err) {
    logger.error("Failed to create/touch message notification:", err.message);
    return null;
  }
}

module.exports = { createNotification, createOrTouchMessageNotification };
