const ProjectMember = require("../models/ProjectMember.model");

/**
 * @returns {Promise<import('mongoose').Document|null>} the accepted membership doc, or null
 */
async function getAcceptedMembership(projectId, userId) {
  if (!userId) return null;
  return ProjectMember.findOne({ project: projectId, user: userId, status: "accepted" });
}

function isOwner(membership) {
  return !!membership && membership.role === "Owner";
}

/**
 * Batched membership lookup for list endpoints.
 * @returns {Promise<Map<string, string>>} projectId -> role
 */
async function getMembershipRoleMap(userId, projectIds) {
  if (!userId || projectIds.length === 0) return new Map();
  const memberships = await ProjectMember.find({
    user: userId,
    project: { $in: projectIds },
    status: "accepted",
  }).select("project role");
  return new Map(memberships.map((m) => [m.project.toString(), m.role]));
}

module.exports = { getAcceptedMembership, isOwner, getMembershipRoleMap };
