const User = require("../models/User.model");
const Profile = require("../models/Profile.model");
const Skill = require("../models/Skill.model");
const catchAsync = require("../utils/catchAsync");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const { getPagination, buildMeta } = require("../utils/pagination");
const { uploadImage, uploadRawFile, deleteAsset } = require("../services/cloudinary.service");
const { isFollowing, getFollowingSet } = require("../services/follow.service");

const PROFILE_UPDATABLE_FIELDS = [
  "headline",
  "company",
  "location",
  "country",
  "bio",
  "about",
  "pinnedRepo",
  "openToWork",
  "openToCollab",
  "visibility",
];

function applyUpdatableFields(profile, body) {
  PROFILE_UPDATABLE_FIELDS.forEach((field) => {
    if (body[field] !== undefined) profile[field] = body[field];
  });
  if (body.experience) {
    if (body.experience.level !== undefined) profile.experience.level = body.experience.level;
    if (body.experience.years !== undefined) profile.experience.years = body.experience.years;
  }
  if (body.links) {
    ["github", "website", "portfolio", "twitter", "linkedin"].forEach((key) => {
      if (body.links[key] !== undefined) profile.links[key] = body.links[key];
    });
  }
  return profile;
}

async function getOrCreateProfile(userId) {
  let profile = await Profile.findOne({ user: userId });
  if (!profile) profile = await Profile.create({ user: userId });
  return profile;
}

/**
 * GET /profiles/me (authenticated)
 */
const getMyProfile = catchAsync(async (req, res) => {
  const profile = await getOrCreateProfile(req.user._id);
  await profile.populate("skills");

  // Calculate total likes received on the user's posts for dashboard stats
  const postLikesResult = await Post.aggregate([
    { $match: { author: req.user._id, status: "active" } },
    { $group: { _id: null, totalLikes: { $sum: "$likesCount" } } },
  ]);
  const totalPostLikes = postLikesResult[0]?.totalLikes || 0;

  return new ApiResponse(
    200,
    { user: req.user.toSafeObject(), profile, stats: { totalPostLikes } },
    "Profile fetched"
  ).send(res);
});

/**
 * PATCH /profiles/me (authenticated)
 */
const updateMyProfile = catchAsync(async (req, res) => {
  const profile = await getOrCreateProfile(req.user._id);
  applyUpdatableFields(profile, req.body);
  await profile.save();

  return new ApiResponse(200, { profile }, "Profile updated successfully").send(res);
});

/**
 * PATCH /profiles/username (authenticated)
 */
const updateUsername = catchAsync(async (req, res) => {
  const { username } = req.body;

  if (username === req.user.username) {
    return new ApiResponse(200, { username }, "Username unchanged").send(res);
  }

  const existing = await User.findOne({ username });
  if (existing) throw ApiError.conflict("That username is already taken");

  req.user.username = username;
  await req.user.save({ validateBeforeSave: true });

  return new ApiResponse(200, { username }, "Username updated successfully").send(res);
});

/**
 * GET /profiles/username-check/:username (public)
 */
const checkUsernameAvailability = catchAsync(async (req, res) => {
  const username = req.params.username.trim().toLowerCase();
  const valid = /^[a-z0-9_]{3,30}$/.test(username);
  if (!valid) {
    return new ApiResponse(200, { available: false, reason: "invalid_format" }, "Username format invalid").send(res);
  }

  const existing = await User.findOne({ username });
  return new ApiResponse(200, { available: !existing }, existing ? "Username taken" : "Username available").send(res);
});

/**
 * GET /profiles/:username (public — respects visibility)
 */
const getPublicProfile = catchAsync(async (req, res) => {
  const username = req.params.username.trim().toLowerCase();
  const user = await User.findOne({ username, status: "active" });
  if (!user) throw ApiError.notFound("Profile not found");

  const profile = await Profile.findOne({ user: user._id }).populate("skills");
  if (!profile) throw ApiError.notFound("Profile not found");

  const isOwner = req.user && req.user._id.equals(user._id);
  const isPrivate = profile.visibility === "private" && !isOwner;

  if (!isOwner) {
    profile.profileViews += 1;
    await profile.save({ validateBeforeSave: false });
  }

  const stack = (profile.skills || [])
    .slice()
    .sort((a, b) => (b.featured === a.featured ? 0 : b.featured ? 1 : -1))
    .map((s) => s.name);

  const viewerIsFollowing = !isOwner && req.user ? await isFollowing(req.user._id, user._id) : false;

  const publicPayload = {
    username: user.username,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: user.role === "admin" ? undefined : user.role,
    joined: user.createdAt,
  };

  if (isPrivate) {
    return new ApiResponse(
      200,
      { profile: { ...publicPayload, visibility: "private" }, isPrivate: true, isFollowing: viewerIsFollowing },
      "This profile is private"
    ).send(res);
  }

  return new ApiResponse(
    200,
    {
      profile: {
        ...publicPayload,
        headline: profile.headline,
        company: profile.company,
        location: profile.location,
        country: profile.country,
        bio: profile.bio,
        about: profile.about,
        experience: profile.experience,
        coverImageUrl: profile.coverImageUrl,
        links: profile.links,
        pinnedRepo: profile.pinnedRepo,
        openToWork: profile.openToWork,
        openToCollab: profile.openToCollab,
        followersCount: profile.followersCount,
        followingCount: profile.followingCount,
        postsCount: profile.postsCount,
        projectsCount: profile.projectsCount,
        profileViews: profile.profileViews,
        stack,
        skills: profile.skills,
        isOwner: !!isOwner,
        isFollowing: viewerIsFollowing,
      },
    },
    "Profile fetched"
  ).send(res);
});

/**
 * GET /profiles (public — browse/search developers)
 * Query params: q, skill, location, openToWork, page, limit, sort
 */
const listProfiles = catchAsync(async (req, res) => {
  const { q, skill, location, openToWork, sort } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  const profileFilter = { visibility: "public" };
  if (location) profileFilter.location = new RegExp(location.trim(), "i");
  if (openToWork === "true") profileFilter.openToWork = true;

  let candidateUserIds = null;

  if (q) {
    const regex = new RegExp(q.trim(), "i");
    const matchingUsers = await User.find({
      status: "active",
      $or: [{ name: regex }, { username: regex }],
    }).select("_id");
    candidateUserIds = matchingUsers.map((u) => u._id.toString());
  }

  if (skill) {
    const matchingSkills = await Skill.find({ slug: new RegExp(skill.trim().toLowerCase(), "i") }).select("user");
    const skillUserIds = [...new Set(matchingSkills.map((s) => s.user.toString()))];
    candidateUserIds = candidateUserIds
      ? candidateUserIds.filter((id) => skillUserIds.includes(id))
      : skillUserIds;
  }

  if (candidateUserIds) {
    if (candidateUserIds.length === 0) {
      return new ApiResponse(200, { profiles: [] }, "No developers found", buildMeta({ page, limit, total: 0 })).send(res);
    }
    profileFilter.user = { $in: candidateUserIds };
  }

  const sortOption = sort === "recent" ? { createdAt: -1 } : { followersCount: -1, createdAt: -1 };

  const [profiles, total] = await Promise.all([
    Profile.find(profileFilter)
      .populate("user", "name username avatarUrl role status createdAt")
      .sort(sortOption)
      .skip(skip)
      .limit(limit),
    Profile.countDocuments(profileFilter),
  ]);

  const filtered = profiles.filter((p) => p.user && p.user.status === "active");

  let shaped = filtered;
  if (req.user) {
    const followingSet = await getFollowingSet(req.user._id, filtered.map((p) => p.user._id));
    shaped = filtered.map((p) => {
      const obj = p.toObject();
      obj.isFollowing = followingSet.has(p.user._id.toString());
      return obj;
    });
  }

  return new ApiResponse(200, { profiles: shaped }, "Developers fetched", buildMeta({ page, limit, total })).send(res);
});

/**
 * GET /profiles/users (public — browse all connected users with pagination)
 * Query params: q, skill, location, openToWork, page, limit, sort
 * Returns all public profiles so users can discover and connect with each other.
 */
const listUsers = catchAsync(async (req, res) => {
  const { q, skill, location, openToWork, sort } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  const profileFilter = { visibility: "public" };
  if (location) profileFilter.location = new RegExp(location.trim(), "i");
  if (openToWork === "true") profileFilter.openToWork = true;

  let candidateUserIds = null;

  if (q) {
    const regex = new RegExp(q.trim(), "i");
    const matchingUsers = await User.find({
      status: "active",
      $or: [{ name: regex }, { username: regex }],
    }).select("_id");
    candidateUserIds = matchingUsers.map((u) => u._id.toString());
  }

  if (skill) {
    const matchingSkills = await Skill.find({ slug: new RegExp(skill.trim().toLowerCase(), "i") }).select("user");
    const skillUserIds = [...new Set(matchingSkills.map((s) => s.user.toString()))];
    candidateUserIds = candidateUserIds
      ? candidateUserIds.filter((id) => skillUserIds.includes(id))
      : skillUserIds;
  }

  if (candidateUserIds) {
    if (candidateUserIds.length === 0) {
      return new ApiResponse(200, { profiles: [] }, "No developers found", buildMeta({ page, limit, total: 0 })).send(res);
    }
    profileFilter.user = { $in: candidateUserIds };
  }

  const sortOption = sort === "recent" ? { createdAt: -1 } : { followersCount: -1, createdAt: -1 };

  const [profiles, total] = await Promise.all([
    Profile.find(profileFilter)
      .populate("user", "name username avatarUrl role status createdAt")
      .sort(sortOption)
      .skip(skip)
      .limit(limit),
    Profile.countDocuments(profileFilter),
  ]);

  const filtered = profiles.filter((p) => p.user && p.user.status === "active");

  let shaped = filtered;
  if (req.user) {
    const followingSet = await getFollowingSet(req.user._id, filtered.map((p) => p.user._id));
    shaped = filtered.map((p) => {
      const obj = p.toObject();
      obj.isFollowing = followingSet.has(p.user._id.toString());
      return obj;
    });
  }

  return new ApiResponse(200, { profiles: shaped }, "Users fetched", buildMeta({ page, limit, total })).send(res);
});

/**
 * POST /profiles/me/avatar (authenticated, multipart "avatar")
 */
const uploadAvatar = catchAsync(async (req, res) => {
  if (!req.file) throw ApiError.badRequest("No image file provided");

  const user = await User.findById(req.user._id).select("+avatarPublicId");
  const { url, publicId } = await uploadImage(req.file.buffer, "avatars", `user_${req.user._id}`);

  const oldPublicId = user.avatarPublicId;
  user.avatarUrl = url;
  user.avatarPublicId = publicId;
  await user.save({ validateBeforeSave: false });

  if (oldPublicId && oldPublicId !== publicId) await deleteAsset(oldPublicId);

  return new ApiResponse(200, { avatarUrl: url }, "Avatar updated successfully").send(res);
});

/**
 * DELETE /profiles/me/avatar (authenticated)
 */
const deleteAvatar = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).select("+avatarPublicId");
  if (user.avatarPublicId) await deleteAsset(user.avatarPublicId);

  user.avatarUrl = null;
  user.avatarPublicId = null;
  await user.save({ validateBeforeSave: false });

  return new ApiResponse(200, null, "Avatar removed").send(res);
});

/**
 * POST /profiles/me/cover (authenticated, multipart "cover")
 */
const uploadCover = catchAsync(async (req, res) => {
  if (!req.file) throw ApiError.badRequest("No image file provided");

  const profile = await getOrCreateProfile(req.user._id);
  const { url, publicId } = await uploadImage(req.file.buffer, "covers", `profile_${req.user._id}`);

  const oldPublicId = profile.coverImagePublicId;
  profile.coverImageUrl = url;
  profile.coverImagePublicId = publicId;
  await profile.save();

  if (oldPublicId && oldPublicId !== publicId) await deleteAsset(oldPublicId);

  return new ApiResponse(200, { coverImageUrl: url }, "Cover image updated successfully").send(res);
});

/**
 * DELETE /profiles/me/cover (authenticated)
 */
const deleteCover = catchAsync(async (req, res) => {
  const profile = await Profile.findOne({ user: req.user._id }).select("+coverImagePublicId");
  if (!profile) throw ApiError.notFound("Profile not found");

  if (profile.coverImagePublicId) await deleteAsset(profile.coverImagePublicId);
  profile.coverImageUrl = null;
  profile.coverImagePublicId = null;
  await profile.save();

  return new ApiResponse(200, null, "Cover image removed").send(res);
});

/**
 * POST /profiles/me/resume (authenticated, multipart "resume")
 */
const uploadResume = catchAsync(async (req, res) => {
  if (!req.file) throw ApiError.badRequest("No resume file provided");

  const profile = await getOrCreateProfile(req.user._id);
  const { url, publicId } = await uploadRawFile(req.file.buffer, "resumes", `resume_${req.user._id}_${Date.now()}`);

  const oldPublicId = profile.resumePublicId;
  profile.resumeUrl = url;
  profile.resumePublicId = publicId;
  await profile.save();

  if (oldPublicId && oldPublicId !== publicId) await deleteAsset(oldPublicId, "raw");

  return new ApiResponse(200, { resumeUrl: url }, "Resume uploaded successfully").send(res);
});

/**
 * DELETE /profiles/me/resume (authenticated)
 */
const deleteResume = catchAsync(async (req, res) => {
  const profile = await Profile.findOne({ user: req.user._id }).select("+resumePublicId");
  if (!profile) throw ApiError.notFound("Profile not found");

  if (profile.resumePublicId) await deleteAsset(profile.resumePublicId, "raw");
  profile.resumeUrl = null;
  profile.resumePublicId = null;
  await profile.save();

  return new ApiResponse(200, null, "Resume removed").send(res);
});

module.exports = {
  getMyProfile,
  updateMyProfile,
  updateUsername,
  checkUsernameAvailability,
  getPublicProfile,
  listProfiles,
  listUsers,
  uploadAvatar,
  deleteAvatar,
  uploadCover,
  deleteCover,
  uploadResume,
  deleteResume,
};
