const mongoose = require("mongoose");
const { Schema } = mongoose;

const reviewSchema = new Schema(
  {
    aiTool: { type: Schema.Types.ObjectId, ref: "AITool", required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    rating: { type: Number, required: [true, "A rating from 1-5 is required"], min: 1, max: 5 },
    content: { type: String, trim: true, maxlength: 1000, default: "" },

    helpfulCount: { type: Number, default: 0, min: 0 },

    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One review per user per tool — resubmitting updates the existing review.
reviewSchema.index({ aiTool: 1, user: 1 }, { unique: true });
reviewSchema.index({ aiTool: 1, createdAt: -1 });

module.exports = mongoose.model("Review", reviewSchema);
