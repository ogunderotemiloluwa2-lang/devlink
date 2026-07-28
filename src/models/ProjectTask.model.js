const mongoose = require("mongoose");
const { Schema } = mongoose;

const TASK_STATUSES = ["todo", "in-progress", "done"];

const projectTaskSchema = new Schema(
  {
    project: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    title: { type: String, required: [true, "Task title is required"], trim: true, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 1000, default: "" },
    status: { type: String, enum: TASK_STATUSES, default: "todo", index: true },
    assignee: { type: Schema.Types.ObjectId, ref: "User", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    dueDate: { type: Date, default: null },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

projectTaskSchema.index({ project: 1, status: 1, order: 1 });

projectTaskSchema.statics.STATUSES = TASK_STATUSES;

module.exports = mongoose.model("ProjectTask", projectTaskSchema);
