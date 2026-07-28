const mongoose = require("mongoose");
const { Schema } = mongoose;

const projectDiscussionMessageSchema = new Schema(
  {
    project: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: [true, "Message content is required"], trim: true, maxlength: 2000 },
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

projectDiscussionMessageSchema.index({ project: 1, createdAt: -1 });

module.exports = mongoose.model("ProjectDiscussionMessage", projectDiscussionMessageSchema);
