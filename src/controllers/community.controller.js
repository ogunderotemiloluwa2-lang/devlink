const Community = require("../models/Community.model");
const CommunityMember = require("../models/CommunityMember.model");
const Post = require("../models/Post.model");
const Profile = require("../models/Profile.model");
const User = require("../models/User.model");
const catchAsync = require("../utils/catchAsync");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const slugify = require("../utils/slugify");
const { getPagination, buildMeta } = require("../utils/pagination");
const { extractHashtags, extractMentions } = require("../utils/textParsing");
const { getMembership, isAdmin, isModeratorOrAbove, getMembershipRoleMap } = require("../services/community.service");
const { uploadImage, deleteAsset } = require("../services/cloudinary.service");
const { createNotification } = require("../services/notification.service");

const AUTHOR_SELECT = "name username avatarUrl role";
const MEMBER_USER_SELECT = "name username avatarUrl role";

async function resolveCommunity(slug) {
  const community = await Community.findOne({ slug: slug.trim().toLowerCase(), status: "active" });
  if (!community) throw ApiError.notFound("Community not found");
  return community;
}

async function generateUniqueSlug(name) {
  const base = slugify(name) || "community";
  let slug = base;
  let suffix = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await Community.findOne({ slug })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

/**
 * POST /communities (authenticated)
 */
const createCommunity = catchAsync(async (req, res) => {
  const { name, description, topics, rules, visibility } = req.body;

  const slug = await generateUniqueSlug(name);

  const community = await Community.create({
    name: name.trim(),
    slug,
    description: description?.trim() || "",
    topics: Array.isArray(topics) ? topics.map((t) => t.trim().toLowerCase()).filter(Boolean) : [],
    rules: Array.isArray(rules) ? rules.map((r) => r.trim()).filter(Boolean) : [],
    visibility: visibility === "private" ? "private" : "public",
    creator: req.user._id,
    membersCount: 1,
  });

  await CommunityMember.create({ community: community._id, user: req.user._id, role: "admin" });

  return new ApiResponse(201, { community }, "Community created").send(res);
});

/**
 * GET /communities — search/filter/paginate
 * Query: q, topic, sort, page, limit
 */
const listCommunities = catchAsync(async (req, res) => {
  const { q, topic, sort } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  const filter = { status: "active", visibility: "public" };
  if (topic) filter.topics = topic.trim().toLowerCase();
  if (q) {
    const regex = new RegExp(q.trim(), "i");
    filter.$or = [{ name: regex }, { description: regex }, { topics: regex }];
  }

  const sortOption = sort === "recent" ? { createdAt: -1 } : { membersCount: -1, createdAt: -1 };

  const [communities, total] = await Promise.all([
    Community.find(filter).sort(sortOption).skip(skip).limit(limit),
    Community.countDocuments(filter),
  ]);

  let shaped = communities;
  if (req.user) {
    const roleMap = await getMembershipRoleMap(req.user._id, communities.map((c) => c._id));
    shaped = communities.map((c) => {
      const obj = c.toObject();
      obj.viewerRole = roleMap.get(c._id.toString()) || null;
      obj.isMember = roleMap.has(c._id.toString());
      return obj;
    });
  }

  return new ApiResponse(200, { communities: shaped }, "Communities fetched", buildMeta({ page, limit, total })).send(res);
});

/**
 * GET /communities/:slug
 */
const getCommunity = catchAsync(async (req, res) => {
  const community = await resolveCommunity(req.params.slug);
  const membership = await getMembership(community._id, req.user?._id);

  const payload = community.toObject();
  payload.viewerRole = membership?.role || null;
  payload.isMember = !!membership;

  return new ApiResponse(200, { community: payload }, "Community fetched").send(res);
});

/**
 * PATCH /communities/:slug (admin only)
 */
const updateCommunity = catchAsync(async (req, res) => {
  const community = await resolveCommunity(req.params.slug);
  const membership = await getMembership(community._id, req.user._id);
  if (!isAdmin(membership)) throw ApiError.forbidden("Only community admins can edit this community");

  const { name, description, topics, rules, visibility } = req.body;
  if (name !== undefined) community.name = name.trim();
  if (description !== undefined) community.description = description.trim();
  if (topics !== undefined) community.topics = topics.map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (rules !== undefined) community.rules = rules.map((r) => r.trim()).filter(Boolean);
  if (visibility !== undefined) community.visibility = visibility;

  await community.save();
  return new ApiResponse(200, { community }, "Community updated").send(res);
});

/**
 * DELETE /communities/:slug (creator/admin or platform admin)
 */
const deleteCommunity = catchAsync(async (req, res) => {
  const community = await resolveCommunity(req.params.slug);
  const membership = await getMembership(community._id, req.user._id);
  const isPlatformAdmin = req.user.role === "admin";

  if (!isAdmin(membership) && !isPlatformAdmin) {
    throw ApiError.forbidden("Only community admins can delete this community");
  }

  // Detach (not delete) posts made in this community so member contributions
  // aren't destroyed — they simply stop being associated with a community.
  await Post.updateMany(
    { community: community._id },
    { $set: { community: null, isPinned: false, isAnnouncement: false } }
  );
  await CommunityMember.deleteMany({ community: community._id });
  await community.deleteOne();

  return new ApiResponse(200, null, "Community deleted").send(res);
});

/**
 * POST /communities/:slug/avatar (admin only, multipart "avatar")
 */
const uploadCommunityAvatar = catchAsync(async (req, res) => {
  if (!req.file) throw ApiError.badRequest("No image file provided");
  const community = await resolveCommunity(req.params.slug);
  const membership = await getMembership(community._id, req.user._id);
  if (!isAdmin(membership)) throw ApiError.forbidden("Only community admins can update the avatar");

  const { url, publicId } = await uploadImage(req.file.buffer, "community-avatars", `community_${community._id}`);
  const oldPublicId = community.avatarPublicId;
  community.avatarUrl = url;
  community.avatarPublicId = publicId;
  await community.save();
  if (oldPublicId && oldPublicId !== publicId) await deleteAsset(oldPublicId);

  return new ApiResponse(200, { avatarUrl: url }, "Community avatar updated").send(res);
});

/**
 * POST /communities/:slug/banner (admin only, multipart "banner")
 */
const uploadCommunityBanner = catchAsync(async (req, res) => {
  if (!req.file) throw ApiError.badRequest("No image file provided");
  const community = await resolveCommunity(req.params.slug);
  const membership = await getMembership(community._id, req.user._id);
  if (!isAdmin(membership)) throw ApiError.forbidden("Only community admins can update the banner");

  const { url, publicId } = await uploadImage(req.file.buffer, "community-banners", `community_${community._id}`);
  const oldPublicId = community.bannerPublicId;
  community.bannerUrl = url;
  community.bannerPublicId = publicId;
  await community.save();
  if (oldPublicId && oldPublicId !== publicId) await deleteAsset(oldPublicId);

  return new ApiResponse(200, { bannerUrl: url }, "Community banner updated").send(res);
});

/**
 * DELETE /communities/:slug/avatar (admin only)
 */
const deleteCommunityAvatar = catchAsync(async (req, res) => {
  const community = await resolveCommunity(req.params.slug);
  const membership = await getMembership(community._id, req.user._id);
  if (!isAdmin(membership)) throw ApiError.forbidden("Only community admins can remove the avatar");

  const fresh = await Community.findById(community._id).select("+avatarPublicId");
  if (fresh.avatarPublicId) await deleteAsset(fresh.avatarPublicId);
  fresh.avatarUrl = null;
  fresh.avatarPublicId = null;
  await fresh.save();

  return new ApiResponse(200, null, "Community avatar removed").send(res);
});

/**
 * DELETE /communities/:slug/banner (admin only)
 */
const deleteCommunityBanner = catchAsync(async (req, res) => {
  const community = await resolveCommunity(req.params.slug);
  const membership = await getMembership(community._id, req.user._id);
  if (!isAdmin(membership)) throw ApiError.forbidden("Only community admins can remove the banner");

  const fresh = await Community.findById(community._id).select("+bannerPublicId");
  if (fresh.bannerPublicId) await deleteAsset(fresh.bannerPublicId);
  fresh.bannerUrl = null;
  fresh.bannerPublicId = null;
  await fresh.save();

  return new ApiResponse(200, null, "Community banner removed").send(res);
});

/**
 * POST /communities/:slug/invite (admin/moderator only)
 */
const inviteToCommunity = catchAsync(async (req, res) => {
  const community = await resolveCommunity(req.params.slug);
  const requesterMembership = await getMembership(community._id, req.user._id);
  if (!isModeratorOrAbove(requesterMembership)) {
    throw ApiError.forbidden("Only community admins or moderators can invite members");
  }

  const targetUser = await User.findOne({ username: req.body.username.trim().toLowerCase(), status: "active" });
  if (!targetUser) throw ApiError.notFound("User not found");

  const existing = await CommunityMember.findOne({ community: community._id, user: targetUser._id });
  if (existing) {
    if (existing.status === "active") throw ApiError.conflict("This user is already a member");
    if (existing.status === "invited") throw ApiError.conflict("This user already has a pending invite");
    if (existing.status === "banned") throw ApiError.forbidden("This user has been banned from this community");
  } else {
    await CommunityMember.create({
      community: community._id,
      user: targetUser._id,
      role: "member",
      status: "invited",
      invitedBy: req.user._id,
    });
  }

  await createNotification(req.app.get("io"), {
    recipient: targetUser._id,
    actor: req.user._id,
    type: "community_invite",
    text: `invited you to join ${community.name}`,
    entityType: "Community",
    entityId: community._id,
  });

  return new ApiResponse(201, null, `Invited @${targetUser.username}`).send(res);
});

/**
 * GET /communities/invites/mine (authenticated)
 */
const getMyCommunityInvites = catchAsync(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { user: req.user._id, status: "invited" };

  const [invites, total] = await Promise.all([
    CommunityMember.find(filter)
      .populate("community", "name slug description avatarUrl")
      .populate("invitedBy", MEMBER_USER_SELECT)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    CommunityMember.countDocuments(filter),
  ]);

  return new ApiResponse(200, { invites }, "Invites fetched", buildMeta({ page, limit, total })).send(res);
});

/**
 * POST /communities/:slug/join (authenticated)
 * Also accepts a pending invite, if one exists.
 */
const joinCommunity = catchAsync(async (req, res) => {
  const community = await resolveCommunity(req.params.slug);

  const existing = await CommunityMember.findOne({ community: community._id, user: req.user._id });
  if (existing) {
    if (existing.status === "banned") throw ApiError.forbidden("You have been banned from this community");
    if (existing.status === "active") {
      return new ApiResponse(200, { isMember: true }, "Already a member").send(res);
    }
    // status === "invited" — accepting the invite.
    existing.status = "active";
    await existing.save();
    community.membersCount += 1;
    await community.save();
    return new ApiResponse(200, { isMember: true }, `You joined ${community.name}`).send(res);
  }

  if (community.visibility === "private") {
    throw ApiError.forbidden("This community is private — an admin must invite you");
  }

  await CommunityMember.create({ community: community._id, user: req.user._id, role: "member", status: "active" });
  community.membersCount += 1;
  await community.save();

  return new ApiResponse(201, { isMember: true }, `You joined ${community.name}`).send(res);
});

/**
 * POST /communities/:slug/leave (authenticated)
 */
const leaveCommunity = catchAsync(async (req, res) => {
  const community = await resolveCommunity(req.params.slug);

  if (community.creator.equals(req.user._id)) {
    throw ApiError.badRequest(
      "The creator cannot leave their own community — delete it instead, or promote another admin first"
    );
  }

  const membership = await CommunityMember.findOneAndDelete({ community: community._id, user: req.user._id });
  if (!membership) {
    return new ApiResponse(200, { isMember: false }, "You are not a member of this community").send(res);
  }

  community.membersCount = Math.max(community.membersCount - 1, 0);
  await community.save();

  return new ApiResponse(200, { isMember: false }, `You left ${community.name}`).send(res);
});

/**
 * GET /communities/:slug/members
 * Query: role, page, limit
 */
const getCommunityMembers = catchAsync(async (req, res) => {
  const community = await resolveCommunity(req.params.slug);
  const { role } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  const filter = { community: community._id, status: "active" };
  if (role) filter.role = role;

  const [members, total] = await Promise.all([
    CommunityMember.find(filter)
      .populate("user", MEMBER_USER_SELECT)
      .sort({ role: 1, createdAt: 1 })
      .skip(skip)
      .limit(limit),
    CommunityMember.countDocuments(filter),
  ]);

  return new ApiResponse(200, { members }, "Members fetched", buildMeta({ page, limit, total })).send(res);
});

/**
 * PATCH /communities/:slug/members/:username/role (admin only)
 */
const updateMemberRole = catchAsync(async (req, res) => {
  const community = await resolveCommunity(req.params.slug);
  const requesterMembership = await getMembership(community._id, req.user._id);
  if (!isAdmin(requesterMembership)) throw ApiError.forbidden("Only community admins can change member roles");

  const { role } = req.body;
  if (!CommunityMember.ROLES.includes(role)) throw ApiError.badRequest("Invalid role");

  const targetUser = await User.findOne({ username: req.params.username.trim().toLowerCase() });
  if (!targetUser) throw ApiError.notFound("User not found");

  if (community.creator.equals(targetUser._id) && role !== "admin") {
    throw ApiError.badRequest("The community creator must remain an admin");
  }

  const membership = await CommunityMember.findOneAndUpdate(
    { community: community._id, user: targetUser._id },
    { role },
    { new: true }
  ).populate("user", MEMBER_USER_SELECT);

  if (!membership) throw ApiError.notFound("This user is not a member of the community");

  return new ApiResponse(200, { member: membership }, "Member role updated").send(res);
});

/**
 * DELETE /communities/:slug/members/:username (admin/moderator — moderators cannot remove admins/moderators)
 */
const removeMember = catchAsync(async (req, res) => {
  const community = await resolveCommunity(req.params.slug);
  const requesterMembership = await getMembership(community._id, req.user._id);
  if (!isModeratorOrAbove(requesterMembership)) {
    throw ApiError.forbidden("Only community admins or moderators can remove members");
  }

  const targetUser = await User.findOne({ username: req.params.username.trim().toLowerCase() });
  if (!targetUser) throw ApiError.notFound("User not found");
  if (community.creator.equals(targetUser._id)) throw ApiError.badRequest("The community creator cannot be removed");

  const targetMembership = await CommunityMember.findOne({ community: community._id, user: targetUser._id });
  if (!targetMembership) throw ApiError.notFound("This user is not a member of the community");

  if (requesterMembership.role === "moderator" && targetMembership.role !== "member") {
    throw ApiError.forbidden("Moderators can only remove regular members");
  }

  await targetMembership.deleteOne();
  community.membersCount = Math.max(community.membersCount - 1, 0);
  await community.save();

  return new ApiResponse(200, null, "Member removed").send(res);
});

/**
 * GET /communities/:slug/posts — pinned first, then reverse-chronological
 */
const getCommunityPosts = catchAsync(async (req, res) => {
  const community = await resolveCommunity(req.params.slug);
  const { page, limit, skip } = getPagination(req.query);

  const filter = { community: community._id, status: "active" };
  const [posts, total] = await Promise.all([
    Post.find(filter)
      .populate("author", AUTHOR_SELECT)
      .sort({ isPinned: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Post.countDocuments(filter),
  ]);

  return new ApiResponse(200, { posts }, "Community posts fetched", buildMeta({ page, limit, total })).send(res);
});

/**
 * POST /communities/:slug/posts (members only)
 */
const createCommunityPost = catchAsync(async (req, res) => {
  const community = await resolveCommunity(req.params.slug);
  const membership = await getMembership(community._id, req.user._id);
  if (!membership) throw ApiError.forbidden("Join this community before posting in it");

  const { content, isAnnouncement } = req.body;
  if (!content || !content.trim()) throw ApiError.badRequest("Post content cannot be empty");

  const wantsAnnouncement = !!isAnnouncement && isModeratorOrAbove(membership);

  const hashtags = extractHashtags(content);
  const mentions = await extractMentions(content);

  const post = await Post.create({
    author: req.user._id,
    type: "text",
    content: content.trim(),
    community: community._id,
    hashtags,
    mentions,
    isAnnouncement: wantsAnnouncement,
    isPinned: wantsAnnouncement, // announcements are pinned by default
  });

  community.postsCount += 1;
  await community.save();
  await Profile.findOneAndUpdate({ user: req.user._id }, { $inc: { postsCount: 1 } });

  await post.populate("author", AUTHOR_SELECT);

  return new ApiResponse(201, { post }, "Post created").send(res);
});

/**
 * POST /communities/:slug/posts/:postId/pin (admin/moderator, toggle)
 */
const togglePinPost = catchAsync(async (req, res) => {
  const community = await resolveCommunity(req.params.slug);
  const membership = await getMembership(community._id, req.user._id);
  if (!isModeratorOrAbove(membership)) throw ApiError.forbidden("Only admins or moderators can pin posts");

  const post = await Post.findOne({ _id: req.params.postId, community: community._id });
  if (!post) throw ApiError.notFound("Post not found in this community");

  post.isPinned = !post.isPinned;
  if (!post.isPinned) post.isAnnouncement = false;
  await post.save();

  return new ApiResponse(200, { post }, post.isPinned ? "Post pinned" : "Post unpinned").send(res);
});

module.exports = {
  createCommunity,
  listCommunities,
  getCommunity,
  updateCommunity,
  deleteCommunity,
  uploadCommunityAvatar,
  uploadCommunityBanner,
  deleteCommunityAvatar,
  deleteCommunityBanner,
  joinCommunity,
  leaveCommunity,
  inviteToCommunity,
  getMyCommunityInvites,
  getCommunityMembers,
  updateMemberRole,
  removeMember,
  getCommunityPosts,
  createCommunityPost,
  togglePinPost,
};
