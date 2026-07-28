const mongoose = require("mongoose");
const { Schema } = mongoose;

const participantSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["admin", "member"], default: "member" }, // meaningful for group chats
    status: { type: String, enum: ["active", "left", "removed"], default: "active" },
    lastReadAt: { type: Date, default: null },
    unreadCount: { type: Number, default: 0, min: 0 },
    mutedUntil: { type: Date, default: null },
  },
  { _id: false }
);

const conversationSchema = new Schema(
  {
    type: { type: String, enum: ["direct", "group"], required: true },

    participants: {
      type: [participantSchema],
      validate: {
        validator(arr) {
          return arr.length >= 2;
        },
        message: "A conversation needs at least 2 participants",
      },
    },

    // Group-only fields
    groupName: { type: String, trim: true, maxlength: 100, default: "" },
    groupAvatarUrl: { type: String, default: null },
    groupAvatarPublicId: { type: String, default: null, select: false },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },

    // Bumped only when a new message arrives (see conversation.service.js)
    // — deliberately distinct from `updatedAt`, which also changes on read
    // receipts/participant edits and would otherwise reorder the list.
    lastActivityAt: { type: Date, default: Date.now, index: true },

    // Denormalized preview so the conversation list never needs to populate
    // and re-sort the full Message collection.
    lastMessage: {
      sender: { type: Schema.Types.ObjectId, ref: "User" },
      preview: { type: String, default: "" },
      hasAttachment: { type: Boolean, default: false },
      sentAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

conversationSchema.index({ "participants.user": 1, lastActivityAt: -1 });
conversationSchema.index({ type: 1, "participants.user": 1 });

module.exports = mongoose.model("Conversation", conversationSchema);
