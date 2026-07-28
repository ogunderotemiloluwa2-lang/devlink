const Post = require("../models/Post.model");
const Comment = require("../models/Comment.model");
const Like = require("../models/Like.model");
const Bookmark = require("../models/Bookmark.model");
const Community = require("../models/Community.model");
const User = require("../models/User.model");
const Profile = require("../models/Profile.model");
const catchAsync = require("../utils/catchAsync");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const { getPagination, buildMeta } = require("../utils/pagination");
const { encodeCursor, cursorFilter } = require("../utils/cursorPagination");
const { extractHashtags, extractMentions } = require("../utils/textParsing");
const { toggleLike, getLikers } = require("../services/like.service");
const { getFollowingIds } = require("../services/follow.service");
const { createNotification } = require("../services/notification.service");
const { uploadImage, deleteAsset } = require("../services/cloudinary.service");

const AUTHOR_SELECT = "name username avatarUrl role";

async function attachViewerFlags(posts, viewerId) {
  if (!viewerId || posts.length === 0) return posts;
  const postIds = posts.map((p) => p._id);

  const [likedDocs, bookmarkedDocs] = await Promise.all([
    Like.find({ user: viewerId, targetType: "Post", targetId: { $in: postIds } }).select("targetId"),
    Bookmark.find({ user: viewerId, post: { $in: postIds } }).select("post"),
  ]);
  const likedSet = new Set(likedDocs.map((l) => l.targetId.toString()));
  const bookmarkedSet = new Set(bookmarkedDocs.map((b) => b.post.toString()));

  return posts.map((p) => {
    const obj = p.toObject ? p.toObject() : p;
    obj.isLiked = likedSet.has(p._id.toString());
    obj.isBookmarked = bookmarkedSet.has(p._id.toString());
    return obj;
  });
}

function populatePost(query) {
  return query.populate("author", AUTHOR_SELECT).populate({
    path: "repostOf",
    populate: { path: "author", select: AUTHOR_SELECT },
  });
}

/**
 * POST /posts (authenticated, multipart optional "images")
 */
const createPost = catchAsync(async (req, res) => {
  const { type = "text", content = "", codeSnippet, link, poll, project, community, quoteContent, repostOf } = req.body;

  if (!Post.TYPES.includes(type)) throw ApiError.badRequest("Invalid post type");
  if (!content.trim() && type === "text") throw ApiError.badRequest("Post content cannot be empty");

  if (repostOf) {
    const original = await Post.findById(repostOf);
    if (!original || original.status !== "active") throw ApiError.notFound("Original post not found");
  }

  const hashtags = extractHashtags(content);
  const mentions = await extractMentions(content);

  const postData = {
    author: req.user._id,
    type,
    content: content.trim(),
    hashtags,
    mentions,
    project: project || null,
    community: community || null,
  };

  if (type === "code" && codeSnippet) {
    postData.codeSnippet = {
      language: codeSnippet.language || "",
      code: codeSnippet.code || "",
    };
  }

  if (type === "link" && link) {
    postData.link = link;
  }

  if (type === "poll" && poll) {
    if (!Array.isArray(poll.options) || poll.options.length < 2 || poll.options.length > 6) {
      throw ApiError.badRequest("A poll needs between 2 and 6 options");
    }
    postData.poll = {
      options: poll.options.map((text) => ({ text: String(text).trim() })),
      expiresAt: poll.expiresInHours ? new Date(Date.now() + poll.expiresInHours * 3600 * 1000) : null,
      voters: [],
    };
  }

  if (repostOf) {
    postData.repostOf = repostOf;
    postData.quoteContent = quoteContent ? quoteContent.trim() : "";
  }

  // Optional images uploaded alongside a text/image post.
  if (req.files && req.files.length > 0) {
    const uploads = await Promise.all(
      req.files.map((file, idx) => uploadImage(file.buffer, "posts", `post_${req.user._id}_${Date.now()}_${idx}`))
    );
    postData.media = uploads.map((u) => ({ url: u.url, publicId: u.publicId, type: "image" }));
    if (type === "text") postData.type = "image";
  }

  const post = await Post.create(postData);

  if (repostOf) {
    await Post.findByIdAndUpdate(repostOf, { $inc: { sharesCount: 1 } });
  }

  await Profile.findOneAndUpdate({ user: req.user._id }, { $inc: { postsCount: 1 } });

  const io = req.app.get("io");
  await Promise.all(
    mentions.map((mentionedUserId) =>
      createNotification(io, {
        recipient: mentionedUserId,
        actor: req.user._id,
        type: "mention",
        text: "mentioned you in a post",
        entityType: "Post",
        entityId: post._id,
      })
    )
  );

  const populated = await populatePost(Post.findById(post._id));

  return new ApiResponse(201, { post: populated }, "Post created").send(res);
});

/**
 * GET /posts/feed (cursor-based, infinite scroll)
 * Query: cursor, limit, mode ("all" | "following")
 * mode=following requires authentication and restricts the feed to posts by
 * accounts the viewer follows (plus their own posts).
 */
const getFeed = catchAsync(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
  const mode = req.query.mode === "following" ? "following" : "all";

  if (mode === "following" && !req.user) {
    throw ApiError.unauthorized("Log in to view your following feed");
  }

  const baseFilter = { status: "active", community: null };

  if (mode === "following") {
    const followingIds = await getFollowingIds(req.user._id);
    baseFilter.author = { $in: [...followingIds, req.user._id] };
  }

  const cursorPart = cursorFilter(req.query.cursor);
  const filter = Object.keys(cursorPart).length ? { $and: [baseFilter, cursorPart] } : baseFilter;

  const posts = await populatePost(Post.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit + 1));

  const hasMore = posts.length > limit;
  const page = posts.slice(0, limit);
  const shaped = await attachViewerFlags(page, req.user?._id);
  const nextCursor = hasMore ? encodeCursor(page[page.length - 1]) : null;

  return new ApiResponse(200, { posts: shaped, nextCursor, hasMore, mode }, "Feed fetched").send(res);
});

/**
 * GET /posts/trending
 * Query: window (days, default 7), limit
 */
const getTrendingPosts = catchAsync(async (req, res) => {
  const windowDays = Math.min(parseInt(req.query.window, 10) || 7, 30);
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
  const since = new Date(Date.now() - windowDays * 24 * 3600 * 1000);

  const candidates = await populatePost(
    Post.find({ status: "active", createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(500)
  );

  const ranked = candidates
    .map((p) => ({ post: p, score: p.computeTrendingScore() }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.post);

  const shaped = await attachViewerFlags(ranked, req.user?._id);
  return new ApiResponse(200, { posts: shaped }, "Trending posts fetched").send(res);
});

/**
 * GET /posts/hashtag/:tag
 */
const getPostsByHashtag = catchAsync(async (req, res) => {
  const tag = req.params.tag.trim().toLowerCase().replace(/^#/, "");
  const { page, limit, skip } = getPagination(req.query);

  const filter = { status: "active", hashtags: tag };
  const [posts, total] = await Promise.all([
    populatePost(Post.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)),
    Post.countDocuments(filter),
  ]);

  const shaped = await attachViewerFlags(posts, req.user?._id);
  return new ApiResponse(200, { tag, posts: shaped }, "Posts fetched", buildMeta({ page, limit, total })).send(res);
});

/**
 * GET /posts/hashtags/trending
 */
const getTrendingHashtags = catchAsync(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 30);
  const since = new Date(Date.now() - 14 * 24 * 3600 * 1000);

  const results = await Post.aggregate([
    { $match: { status: "active", createdAt: { $gte: since }, hashtags: { $exists: true, $ne: [] } } },
    { $unwind: "$hashtags" },
    { $group: { _id: "$hashtags", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
    { $project: { _id: 0, tag: "$_id", count: 1 } },
  ]);

  return new ApiResponse(200, { hashtags: results }, "Trending hashtags fetched").send(res);
});

/**
 * GET /posts/user/:username
 */
const getUserPosts = catchAsync(async (req, res) => {
  const username = req.params.username.trim().toLowerCase();
  const user = await User.findOne({ username, status: "active" });
  if (!user) throw ApiError.notFound("User not found");

  const { page, limit, skip } = getPagination(req.query);
  const filter = { author: user._id, status: "active" };

  const [posts, total] = await Promise.all([
    populatePost(Post.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)),
    Post.countDocuments(filter),
  ]);

  const shaped = await attachViewerFlags(posts, req.user?._id);
  return new ApiResponse(200, { posts: shaped }, "User posts fetched", buildMeta({ page, limit, total })).send(res);
});

/**
 * GET /posts/:id
 */
const getPostById = catchAsync(async (req, res) => {
  const post = await populatePost(Post.findById(req.params.id));
  if (!post || post.status !== "active") throw ApiError.notFound("Post not found");

  post.viewsCount += 1;
  await post.save({ validateBeforeSave: false });

  const [shaped] = await attachViewerFlags([post], req.user?._id);
  return new ApiResponse(200, { post: shaped || post }, "Post fetched").send(res);
});

/**
 * PATCH /posts/:id (owner only)
 */
const updatePost = catchAsync(async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post || post.status !== "active") throw ApiError.notFound("Post not found");
  if (!post.author.equals(req.user._id)) throw ApiError.forbidden("You can only edit your own posts");

  const { content } = req.body;
  if (content !== undefined) {
    post.content = content.trim();
    post.hashtags = extractHashtags(content);
    post.mentions = await extractMentions(content);
  }

  post.isEdited = true;
  post.editedAt = new Date();
  await post.save();

  const populated = await populatePost(Post.findById(post._id));
  return new ApiResponse(200, { post: populated }, "Post updated").send(res);
});

/**
 * DELETE /posts/:id (owner or admin/moderator)
 */
const deletePost = catchAsync(async (req, res) => {
  const post = await Post.findById(req.params.id).select("+media.publicId");
  if (!post) throw ApiError.notFound("Post not found");

  const isOwner = post.author.equals(req.user._id);
  const isModerator = ["admin", "moderator"].includes(req.user.role);
  if (!isOwner && !isModerator) throw ApiError.forbidden("You can only delete your own posts");

  await Promise.all([
    Comment.deleteMany({ post: post._id }),
    Like.deleteMany({ targetType: "Post", targetId: post._id }),
    Bookmark.deleteMany({ post: post._id }),
  ]);

  if (post.media?.length) {
    await Promise.all(post.media.map((m) => deleteAsset(m.publicId)));
  }

  await post.deleteOne();
  await Profile.findOneAndUpdate({ user: post.author }, { $inc: { postsCount: -1 } });
  if (post.community) {
    await Community.findByIdAndUpdate(post.community, { $inc: { postsCount: -1 } });
  }

  return new ApiResponse(200, null, "Post deleted").send(res);
});

/**
 * POST /posts/:id/like (toggle)
 */
const toggleLikePost = catchAsync(async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post || post.status !== "active") throw ApiError.notFound("Post not found");

  const result = await toggleLike({
    userId: req.user._id,
    targetType: "Post",
    targetId: post._id,
    TargetModel: Post,
  });

  if (result.liked) {
    await createNotification(req.app.get("io"), {
      recipient: post.author,
      actor: req.user._id,
      type: "like",
      text: "liked your post",
      entityType: "Post",
      entityId: post._id,
    });
  }

  return new ApiResponse(200, result, result.liked ? "Post liked" : "Post unliked").send(res);
});

/**
 * GET /posts/:id/likes
 */
const getPostLikers = catchAsync(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { users, total } = await getLikers({ targetType: "Post", targetId: req.params.id, skip, limit });
  return new ApiResponse(200, { users }, "Likers fetched", buildMeta({ page, limit, total })).send(res);
});

/**
 * POST /posts/:id/bookmark (toggle)
 */
const toggleBookmarkPost = catchAsync(async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post || post.status !== "active") throw ApiError.notFound("Post not found");

  const existing = await Bookmark.findOne({ user: req.user._id, post: post._id });

  if (existing) {
    await existing.deleteOne();
    post.bookmarksCount = Math.max(post.bookmarksCount - 1, 0);
    await post.save({ validateBeforeSave: false });
    return new ApiResponse(200, { bookmarked: false }, "Bookmark removed").send(res);
  }

  await Bookmark.create({ user: req.user._id, post: post._id, collectionName: req.body?.collectionName });
  post.bookmarksCount += 1;
  await post.save({ validateBeforeSave: false });

  return new ApiResponse(200, { bookmarked: true }, "Post bookmarked").send(res);
});

/**
 * POST /posts/:id/vote (poll)
 */
const votePoll = catchAsync(async (req, res) => {
  const { optionId } = req.body;
  if (!optionId) throw ApiError.badRequest("optionId is required");

  const post = await Post.findById(req.params.id);
  if (!post || post.status !== "active") throw ApiError.notFound("Post not found");
  if (post.type !== "poll") throw ApiError.badRequest("This post is not a poll");
  if (post.poll.expiresAt && post.poll.expiresAt < new Date()) throw ApiError.badRequest("This poll has closed");

  const alreadyVoted = post.poll.voters.some((v) => v.user.equals(req.user._id));
  if (alreadyVoted) throw ApiError.conflict("You already voted in this poll");

  const option = post.poll.options.id(optionId);
  if (!option) throw ApiError.notFound("Poll option not found");

  option.votes += 1;
  post.poll.voters.push({ user: req.user._id, optionId: option._id });
  await post.save();

  return new ApiResponse(200, { poll: post.poll }, "Vote recorded").send(res);
});

module.exports = {
  createPost,
  getFeed,
  getTrendingPosts,
  getPostsByHashtag,
  getTrendingHashtags,
  getUserPosts,
  getPostById,
  updatePost,
  deletePost,
  toggleLikePost,
  getPostLikers,
  toggleBookmarkPost,
  votePoll,
};
