const User = require("../models/User.model");
const Profile = require("../models/Profile.model");
const Follow = require("../models/Follow.model");
const Skill = require("../models/Skill.model");
const catchAsync = require("../utils/catchAsync");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const { getPagination, buildMeta } = require("../utils/pagination");
const { getFollowingSet, getFollowingIds } = require("../services/follow.service");
const { createNotification } = require("../services/notification.service");

const USER_SELECT = "name username avatarUrl role status createdAt";

async function resolveActiveUser(username) {
  const user = await User.findOne({ username: username.trim().toLowerCase(), status: "active" });
  if (!user) throw ApiError.notFound("User not found");
  return user;
}

/**
 * POST /follow/:username (authenticated)
 */
const followUser = catchAsync(async (req, res) => {
  const target = await resolveActiveUser(req.params.username);

  if (target._id.equals(req.user._id)) {
    throw ApiError.badRequest("You cannot follow yourself");
  }

  const existing = await Follow.findOne({ follower: req.user._id, following: target._id });
  if (existing) {
    return new ApiResponse(200, { following: true }, "Already following").send(res);
  }

  await Follow.create({ follower: req.user._id, following: target._id });
  await Promise.all([
    Profile.findOneAndUpdate({ user: req.user._id }, { $inc: { followingCount: 1 } }),
    Profile.findOneAndUpdate({ user: target._id }, { $inc: { followersCount: 1 } }),
  ]);

  await createNotification(req.app.get("io"), {
    recipient: target._id,
    actor: req.user._id,
    type: "follow",
    text: "started following you",
  });

  return new ApiResponse(201, { following: true }, `You are now following @${target.username}`).send(res);
});

/**
 * DELETE /follow/:username (authenticated)
 */
const unfollowUser = catchAsync(async (req, res) => {
  const target = await resolveActiveUser(req.params.username);

  const existing = await Follow.findOneAndDelete({ follower: req.user._id, following: target._id });
  if (!existing) {
    return new ApiResponse(200, { following: false }, "You were not following this user").send(res);
  }

  await Promise.all([
    Profile.findOneAndUpdate({ user: req.user._id }, { $inc: { followingCount: -1 } }),
    Profile.findOneAndUpdate({ user: target._id }, { $inc: { followersCount: -1 } }),
  ]);

  return new ApiResponse(200, { following: false }, `You unfollowed @${target.username}`).send(res);
});

/**
 * GET /follow/:username/followers
 */
const getFollowers = catchAsync(async (req, res) => {
  const target = await resolveActiveUser(req.params.username);
  const { page, limit, skip } = getPagination(req.query);

  const [follows, total] = await Promise.all([
    Follow.find({ following: target._id })
      .populate("follower", USER_SELECT)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Follow.countDocuments({ following: target._id }),
  ]);

  let users = follows.map((f) => f.follower).filter(Boolean);

  if (req.user) {
    const followingSet = await getFollowingSet(req.user._id, users.map((u) => u._id));
    users = users.map((u) => ({ ...u.toObject(), isFollowing: followingSet.has(u._id.toString()) }));
  }

  return new ApiResponse(200, { users }, "Followers fetched", buildMeta({ page, limit, total })).send(res);
});

/**
 * GET /follow/:username/following
 */
const getFollowing = catchAsync(async (req, res) => {
  const target = await resolveActiveUser(req.params.username);
  const { page, limit, skip } = getPagination(req.query);

  const [follows, total] = await Promise.all([
    Follow.find({ follower: target._id })
      .populate("following", USER_SELECT)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Follow.countDocuments({ follower: target._id }),
  ]);

  let users = follows.map((f) => f.following).filter(Boolean);

  if (req.user) {
    const followingSet = await getFollowingSet(req.user._id, users.map((u) => u._id));
    users = users.map((u) => ({ ...u.toObject(), isFollowing: followingSet.has(u._id.toString()) }));
  }

  return new ApiResponse(200, { users }, "Following fetched", buildMeta({ page, limit, total })).send(res);
});

/**
 * GET /follow/:username/mutual (authenticated)
 * Developers followed by both the viewer and the target user.
 */
const getMutualConnections = catchAsync(async (req, res) => {
  const target = await resolveActiveUser(req.params.username);
  if (target._id.equals(req.user._id)) {
    return new ApiResponse(200, { users: [] }, "Mutual connections fetched").send(res);
  }

  const { page, limit, skip } = getPagination(req.query);

  const [viewerFollowing, targetFollowing] = await Promise.all([
    Follow.find({ follower: req.user._id }).select("following"),
    Follow.find({ follower: target._id }).select("following"),
  ]);

  const targetSet = new Set(targetFollowing.map((f) => f.following.toString()));
  const mutualIds = viewerFollowing.map((f) => f.following.toString()).filter((id) => targetSet.has(id));

  const total = mutualIds.length;
  const pageIds = mutualIds.slice(skip, skip + limit);
  const users = await User.find({ _id: { $in: pageIds }, status: "active" }).select(USER_SELECT);

  return new ApiResponse(200, { users }, "Mutual connections fetched", buildMeta({ page, limit, total })).send(res);
});

/**
 * GET /follow/suggestions (authenticated)
 * Ranking, in priority order:
 *   1. Accounts followed by people the viewer follows (2nd-degree / "mutual connections")
 *   2. Accounts sharing skills with the viewer
 *   3. Popular public profiles (fallback for new accounts with no signal yet)
 */
const getSuggestedDevelopers = catchAsync(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 30);
  const viewerId = req.user._id;

  const followingIds = await getFollowingIds(viewerId);
  const excludeIds = new Set([viewerId.toString(), ...followingIds.map((id) => id.toString())]);

  const suggestions = new Map(); // userId -> { score, reason, ...meta }

  // 1. Second-degree connections
  if (followingIds.length > 0) {
    const secondDegree = await Follow.aggregate([
      { $match: { follower: { $in: followingIds } } },
      { $group: { _id: "$following", mutualCount: { $sum: 1 } } },
      { $sort: { mutualCount: -1 } },
      { $limit: 50 },
    ]);
    secondDegree.forEach(({ _id, mutualCount }) => {
      const id = _id.toString();
      if (excludeIds.has(id)) return;
      suggestions.set(id, { score: mutualCount * 3, reason: "mutual_connections", mutualCount });
    });
  }

  // 2. Shared skills
  if (suggestions.size < limit) {
    const mySkills = await Skill.find({ user: viewerId }).select("slug");
    const mySlugSet = mySkills.map((s) => s.slug);

    if (mySlugSet.length > 0) {
      const skillMatches = await Skill.aggregate([
        { $match: { slug: { $in: mySlugSet }, user: { $ne: viewerId } } },
        { $group: { _id: "$user", sharedSkillCount: { $sum: 1 } } },
        { $sort: { sharedSkillCount: -1 } },
        { $limit: 50 },
      ]);
      skillMatches.forEach(({ _id, sharedSkillCount }) => {
        const id = _id.toString();
        if (excludeIds.has(id)) return;
        const existing = suggestions.get(id);
        const score = sharedSkillCount * 2;
        if (existing) existing.score += score;
        else suggestions.set(id, { score, reason: "shared_skills", sharedSkillCount });
      });
    }
  }

  // 3. Popular fallback
  if (suggestions.size < limit) {
    const popular = await Profile.find({
      visibility: "public",
      user: { $nin: [...excludeIds, ...suggestions.keys()] },
    })
      .sort({ followersCount: -1 })
      .limit(limit * 2)
      .select("user followersCount");

    popular.forEach((p) => {
      const id = p.user.toString();
      if (!suggestions.has(id)) suggestions.set(id, { score: 1, reason: "popular" });
    });
  }

  const rankedIds = [...suggestions.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, limit)
    .map(([id]) => id);

  const users = await User.find({ _id: { $in: rankedIds }, status: "active" })
    .select(USER_SELECT)
    .lean();
  const profiles = await Profile.find({ user: { $in: rankedIds } }).select(
    "user headline company location openToWork openToCollab"
  );
  const profileByUser = new Map(profiles.map((p) => [p.user.toString(), p]));

  const shaped = rankedIds
    .map((id) => {
      const user = users.find((u) => u._id.toString() === id);
      if (!user) return null;
      const profile = profileByUser.get(id);
      const meta = suggestions.get(id);
      return {
        ...user,
        headline: profile?.headline || "",
        company: profile?.company || "",
        location: profile?.location || "",
        openToWork: profile?.openToWork || false,
        openToCollab: profile?.openToCollab ?? true,
        suggestionReason: meta.reason,
      };
    })
    .filter(Boolean);

  return new ApiResponse(200, { suggestions: shaped }, "Suggested developers fetched").send(res);
});

module.exports = {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  getMutualConnections,
  getSuggestedDevelopers,
};
