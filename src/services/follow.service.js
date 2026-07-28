const Follow = require("../models/Follow.model");

/**
 * Returns whether `followerId` follows `followingId`.
 */
async function isFollowing(followerId, followingId) {
  if (!followerId || !followingId) return false;
  const doc = await Follow.findOne({ follower: followerId, following: followingId }).select("_id");
  return !!doc;
}

/**
 * Batched version of isFollowing for list responses — one query instead of N.
 * @returns {Promise<Set<string>>} set of target user ids (as strings) the viewer follows
 */
async function getFollowingSet(viewerId, targetUserIds) {
  if (!viewerId || targetUserIds.length === 0) return new Set();
  const docs = await Follow.find({ follower: viewerId, following: { $in: targetUserIds } }).select("following");
  return new Set(docs.map((d) => d.following.toString()));
}

/**
 * All user ids a given user follows (used to build the "following" feed).
 */
async function getFollowingIds(userId) {
  const docs = await Follow.find({ follower: userId }).select("following");
  return docs.map((d) => d.following);
}

async function getFollowerIds(userId) {
  const docs = await Follow.find({ following: userId }).select("follower");
  return docs.map((d) => d.follower);
}

module.exports = { isFollowing, getFollowingSet, getFollowingIds, getFollowerIds };
