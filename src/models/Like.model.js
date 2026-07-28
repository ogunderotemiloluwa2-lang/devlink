const mongoose = require("mongoose");
const { Schema } = mongoose;

const LIKE_TARGET_TYPES = ["Post", "Comment", "Project", "AITool", "Review"];

const likeSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    targetType: { type: String, enum: LIKE_TARGET_TYPES, required: true },
    targetId: { type: Schema.Types.ObjectId, required: true, refPath: "targetType" },
  },
  { timestamps: true }
);

// A user can only like a given target once.
likeSchema.index({ user: 1, targetType: 1, targetId: 1 }, { unique: true });
likeSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

likeSchema.statics.TARGET_TYPES = LIKE_TARGET_TYPES;

module.exports = mongoose.model("Like", likeSchema);
