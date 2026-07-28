const Like = require("../models/Like.model");

/**
 * Toggles a like/star for (user, targetType, targetId) and keeps the target's
 * denormalized counter field in sync in the same call.
 *
 * @param {object} params
 * @param {import('mongoose').Types.ObjectId} params.userId
 * @param {"Post"|"Comment"|"Project"} params.targetType
 * @param {import('mongoose').Types.ObjectId} params.targetId
 * @param {import('mongoose').Model} params.TargetModel - Post, Comment, or Project model
 * @param {string} [params.countField="likesCount"] - the field to increment/decrement (e.g. "starsCount" for Project)
 * @returns {Promise<{ liked: boolean, [countField]: number }>} response key matches countField,
 *          so existing Post/Comment callers keep receiving `likesCount` unchanged.
 */
async function toggleLike({ userId, targetType, targetId, TargetModel, countField = "likesCount" }) {
  const existing = await Like.findOne({ user: userId, targetType, targetId });

  if (existing) {
    await existing.deleteOne();
    const updated = await TargetModel.findByIdAndUpdate(
      targetId,
      { $inc: { [countField]: -1 } },
      { new: true }
    ).select(countField);
    return { liked: false, [countField]: Math.max(updated?.[countField] ?? 0, 0) };
  }

  await Like.create({ user: userId, targetType, targetId });
  const updated = await TargetModel.findByIdAndUpdate(
    targetId,
    { $inc: { [countField]: 1 } },
    { new: true }
  ).select(countField);
  return { liked: true, [countField]: updated?.[countField] ?? 1 };
}

async function getLikers({ targetType, targetId, skip, limit }) {
  const [likes, total] = await Promise.all([
    Like.find({ targetType, targetId })
      .populate("user", "name username avatarUrl")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Like.countDocuments({ targetType, targetId }),
  ]);
  return { users: likes.map((l) => l.user).filter(Boolean), total };
}

async function hasLiked(userId, targetType, targetIds) {
  if (!userId || targetIds.length === 0) return new Set();
  const likes = await Like.find({
    user: userId,
    targetType,
    targetId: { $in: targetIds },
  }).select("targetId");
  return new Set(likes.map((l) => l.targetId.toString()));
}

module.exports = { toggleLike, getLikers, hasLiked };
