const mongoose = require("mongoose");
const { Schema } = mongoose;

const ROLES = ["admin", "moderator", "member"];

const communityMemberSchema = new Schema(
  {
    community: { type: Schema.Types.ObjectId, ref: "Community", required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: { type: String, enum: ROLES, default: "member" },
    status: { type: String, enum: ["active", "invited", "banned"], default: "active" },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

communityMemberSchema.index({ community: 1, user: 1 }, { unique: true });
communityMemberSchema.index({ community: 1, role: 1 });
communityMemberSchema.index({ user: 1, createdAt: -1 });

communityMemberSchema.statics.ROLES = ROLES;

module.exports = mongoose.model("CommunityMember", communityMemberSchema);
