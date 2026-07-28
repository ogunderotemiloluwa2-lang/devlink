const CommunityMember = require("../models/CommunityMember.model");

/**
 * @returns {Promise<import('mongoose').Document|null>} the membership doc, or null if not a member
 */
async function getMembership(communityId, userId) {
  if (!userId) return null;
  return CommunityMember.findOne({ community: communityId, user: userId, status: "active" });
}

function isAdmin(membership) {
  return !!membership && membership.role === "admin";
}

function isModeratorOrAbove(membership) {
  return !!membership && ["admin", "moderator"].includes(membership.role);
}

/**
 * Batched membership lookup for list endpoints (e.g. community directory).
 * @returns {Promise<Map<string, string>>} communityId -> role
 */
async function getMembershipRoleMap(userId, communityIds) {
  if (!userId || communityIds.length === 0) return new Map();
  const memberships = await CommunityMember.find({
    user: userId,
    community: { $in: communityIds },
    status: "active",
  }).select("community role");
  return new Map(memberships.map((m) => [m.community.toString(), m.role]));
}

module.exports = { getMembership, isAdmin, isModeratorOrAbove, getMembershipRoleMap };
