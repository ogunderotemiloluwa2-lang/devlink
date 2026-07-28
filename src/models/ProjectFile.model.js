const mongoose = require("mongoose");
const { Schema } = mongoose;

const projectFileSchema = new Schema(
  {
    project: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    url: { type: String, required: true },
    publicId: { type: String, required: true, select: false },
    mimeType: { type: String, default: "" },
    size: { type: Number, default: 0 }, // bytes
  },
  { timestamps: true }
);

projectFileSchema.index({ project: 1, createdAt: -1 });

module.exports = mongoose.model("ProjectFile", projectFileSchema);
