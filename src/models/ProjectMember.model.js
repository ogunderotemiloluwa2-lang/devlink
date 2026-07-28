const mongoose = require("mongoose");
const { Schema } = mongoose;
const Project = require("./Project.model");

// A member's role is one of the six collaboration roles, or "Owner" for the
// project creator specifically (not offered as an invite role — you can't
// invite someone to be the owner, ownership is set at creation time).
const MEMBER_ROLES = [...Project.ROLES, "Owner"];
const MEMBER_STATUSES = ["pending", "accepted", "rejected", "removed", "left"];

const projectMemberSchema = new Schema(
  {
    project: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: { type: String, enum: MEMBER_ROLES, required: true },
    status: { type: String, enum: MEMBER_STATUSES, default: "pending", index: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    respondedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

projectMemberSchema.index({ project: 1, user: 1 }, { unique: true });
projectMemberSchema.index({ user: 1, status: 1, createdAt: -1 });

projectMemberSchema.statics.ROLES = MEMBER_ROLES;
projectMemberSchema.statics.STATUSES = MEMBER_STATUSES;

module.exports = mongoose.model("ProjectMember", projectMemberSchema);
