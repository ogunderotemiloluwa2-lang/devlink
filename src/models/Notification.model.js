const mongoose = require("mongoose");
const { Schema } = mongoose;

const NOTIFICATION_TYPES = [
  "follow",
  "like",
  "comment",
  "reply",
  "mention",
  "project_invite",
  "community_invite",
  "message",
  "system",
];

const ENTITY_TYPES = ["Post", "Comment", "Project", "Community", "Conversation", "AITool", "Review", "User"];

const notificationSchema = new Schema(
  {
    recipient: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Nullable — system notifications have no actor.
    actor: { type: Schema.Types.ObjectId, ref: "User", default: null },

    type: { type: String, enum: NOTIFICATION_TYPES, required: true, index: true },

    // Short, human-readable description matching the frontend's existing
    // notification shape, e.g. "liked your post about the ledger migration".
    text: { type: String, required: true, trim: true, maxlength: 300 },

    entityType: { type: String, enum: ENTITY_TYPES, default: null },
    entityId: { type: Schema.Types.ObjectId, default: null, refPath: "entityType" },

    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
// Used to find-and-touch an existing unread "message" notification instead
// of spamming one row per message in a fast-moving conversation.
notificationSchema.index({ recipient: 1, type: 1, entityId: 1, isRead: 1 });

notificationSchema.statics.TYPES = NOTIFICATION_TYPES;
notificationSchema.statics.ENTITY_TYPES = ENTITY_TYPES;

module.exports = mongoose.model("Notification", notificationSchema);
