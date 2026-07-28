const mongoose = require("mongoose");
const { Schema } = mongoose;

const commentSchema = new Schema(
  {
    post: { type: Schema.Types.ObjectId, ref: "Post", required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    content: { type: String, required: [true, "Comment content is required"], trim: true, maxlength: 1000 },

    // Self-reference for replies. Kept flat (no arbitrary nesting depth) —
    // a reply's parentComment always points at a top-level comment so the
    // UI can render a simple two-tier thread.
    parentComment: { type: Schema.Types.ObjectId, ref: "Comment", default: null, index: true },

    mentions: [{ type: Schema.Types.ObjectId, ref: "User" }],

    likesCount: { type: Number, default: 0, min: 0 },
    repliesCount: { type: Number, default: 0, min: 0 },

    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },

    status: {
      type: String,
      enum: ["active", "removed", "reported"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true }
);

commentSchema.index({ post: 1, parentComment: 1, createdAt: 1 });

module.exports = mongoose.model("Comment", commentSchema);
