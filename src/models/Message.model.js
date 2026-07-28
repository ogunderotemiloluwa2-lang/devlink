const mongoose = require("mongoose");
const { Schema } = mongoose;

const ATTACHMENT_TYPES = ["image", "file", "audio", "video"];

const attachmentSchema = new Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true, select: false },
    type: { type: String, enum: ATTACHMENT_TYPES, required: true },
    name: { type: String, trim: true, default: "" },
    mimeType: { type: String, default: "" },
    size: { type: Number, default: 0 }, // bytes
    // Populated for audio/video attachments — supports voice messages at the
    // data-model level; recording/waveform UI is a frontend concern.
    duration: { type: Number, default: null }, // seconds
  },
  { _id: false }
);

const reactionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    emoji: { type: String, required: true, maxlength: 8 },
  },
  { _id: false }
);

const messageSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    content: { type: String, trim: true, maxlength: 5000, default: "" },
    attachments: [attachmentSchema],

    replyTo: { type: Schema.Types.ObjectId, ref: "Message", default: null },

    reactions: [reactionSchema],

    readBy: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User" },
        readAt: { type: Date, default: Date.now },
        _id: false,
      },
    ],

    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },

    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ conversation: 1, _id: -1 });

messageSchema.statics.ATTACHMENT_TYPES = ATTACHMENT_TYPES;

// A message needs either text content or at least one attachment.
messageSchema.pre("validate", function requireContentOrAttachment(next) {
  if (!this.content?.trim() && (!this.attachments || this.attachments.length === 0)) {
    return next(new Error("A message needs text content or at least one attachment"));
  }
  next();
});

module.exports = mongoose.model("Message", messageSchema);
