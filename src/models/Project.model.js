const mongoose = require("mongoose");
const { Schema } = mongoose;

// The six collaboration roles the product supports, used both for what a
// project is looking for (rolesNeeded) and what an accepted member's role is.
const PROJECT_ROLES = ["Frontend", "Backend", "Full Stack", "UI Designer", "DevOps", "AI Engineer"];
const STAGES = ["Idea", "Pre-alpha", "Early stage", "Active development", "Maintained", "Archived"];

const projectSchema = new Schema(
  {
    name: { type: String, required: [true, "Project name is required"], trim: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },

    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    tagline: { type: String, trim: true, maxlength: 150, default: "" },
    description: { type: String, trim: true, maxlength: 3000, default: "" },

    stack: [{ type: String, trim: true, maxlength: 40 }],
    rolesNeeded: [{ type: String, enum: PROJECT_ROLES }],

    stage: { type: String, enum: STAGES, default: "Idea" },

    coverImageUrl: { type: String, default: null },
    coverImagePublicId: { type: String, default: null, select: false },

    repoUrl: { type: String, trim: true, default: "" },
    liveUrl: { type: String, trim: true, default: "" },

    visibility: { type: String, enum: ["public", "private"], default: "public" },

    membersCount: { type: Number, default: 1, min: 0 },
    starsCount: { type: Number, default: 0, min: 0 },
    tasksCount: { type: Number, default: 0, min: 0 },
    openTasksCount: { type: Number, default: 0, min: 0 },

    status: { type: String, enum: ["active", "archived"], default: "active", index: true },
  },
  { timestamps: true }
);

projectSchema.index({ name: "text", tagline: "text", description: "text", stack: "text" });
projectSchema.index({ status: 1, rolesNeeded: 1 });
projectSchema.index({ status: 1, stack: 1 });
projectSchema.index({ status: 1, starsCount: -1 });

projectSchema.statics.ROLES = PROJECT_ROLES;
projectSchema.statics.STAGES = STAGES;

module.exports = mongoose.model("Project", projectSchema);
