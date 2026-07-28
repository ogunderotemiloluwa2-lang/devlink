const AITool = require("../models/AITool.model");
const Review = require("../models/Review.model");
const Like = require("../models/Like.model");
const catchAsync = require("../utils/catchAsync");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const slugify = require("../utils/slugify");
const { getPagination, buildMeta } = require("../utils/pagination");
const { recomputeToolRating } = require("../services/aiTool.service");
const { toggleLike, hasLiked } = require("../services/like.service");
const { uploadImage, deleteAsset } = require("../services/cloudinary.service");

const USER_SELECT = "name username avatarUrl role";

async function resolveTool(slug) {
  const tool = await AITool.findOne({ slug: slug.trim().toLowerCase(), status: "approved" });
  if (!tool) throw ApiError.notFound("Tool not found");
  return tool;
}

async function generateUniqueSlug(name) {
  const base = slugify(name) || "tool";
  let slug = base;
  let suffix = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await AITool.findOne({ slug })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

/**
 * POST /ai-tools (authenticated)
 */
const createTool = catchAsync(async (req, res) => {
  const { name, tagline, description, category, pricing, websiteUrl, tags } = req.body;
  const slug = await generateUniqueSlug(name);

  const tool = await AITool.create({
    name: name.trim(),
    slug,
    tagline: tagline?.trim() || "",
    description: description?.trim() || "",
    category: category.trim(),
    pricing: pricing || "Freemium",
    websiteUrl: websiteUrl || "",
    tags: Array.isArray(tags) ? tags.map((t) => t.trim().toLowerCase()).filter(Boolean) : [],
    submittedBy: req.user._id,
  });

  return new ApiResponse(201, { tool }, "Tool added to the AI Hub").send(res);
});

/**
 * GET /ai-tools — search/filter/paginate
 * Query: q, category, pricing, tag, featured, sort, page, limit
 */
const listTools = catchAsync(async (req, res) => {
  const { q, category, pricing, tag, featured, sort } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  const filter = { status: "approved" };
  if (category) filter.category = new RegExp(`^${category.trim()}$`, "i");
  if (pricing) filter.pricing = pricing;
  if (tag) filter.tags = tag.trim().toLowerCase();
  if (featured === "true") filter.featured = true;
  if (q) {
    const regex = new RegExp(q.trim(), "i");
    filter.$or = [{ name: regex }, { tagline: regex }, { description: regex }, { tags: regex }];
  }

  const sortOption = sort === "rating" ? { ratingAvg: -1, reviewsCount: -1 } : sort === "newest" ? { createdAt: -1 } : { bookmarksCount: -1, ratingAvg: -1 };

  const [tools, total] = await Promise.all([
    AITool.find(filter).sort(sortOption).skip(skip).limit(limit),
    AITool.countDocuments(filter),
  ]);

  let shaped = tools;
  if (req.user) {
    const bookmarkedSet = await hasLiked(req.user._id, "AITool", tools.map((t) => t._id));
    shaped = tools.map((t) => {
      const obj = t.toObject();
      obj.isBookmarked = bookmarkedSet.has(t._id.toString());
      return obj;
    });
  }

  return new ApiResponse(200, { tools: shaped }, "Tools fetched", buildMeta({ page, limit, total })).send(res);
});

/**
 * GET /ai-tools/categories — distinct categories currently in use
 */
const getCategories = catchAsync(async (req, res) => {
  const categories = await AITool.distinct("category", { status: "approved" });
  return new ApiResponse(200, { categories: categories.sort() }, "Categories fetched").send(res);
});

/**
 * GET /ai-tools/featured
 */
const getFeaturedTools = catchAsync(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 30);
  const tools = await AITool.find({ status: "approved", featured: true })
    .sort({ ratingAvg: -1 })
    .limit(limit);
  return new ApiResponse(200, { tools }, "Featured tools fetched").send(res);
});

/**
 * GET /ai-tools/trending
 * Ranked by recent review velocity + bookmarks, engagement-decay similar to post trending.
 */
const getTrendingTools = catchAsync(async (req, res) => {
  const windowDays = Math.min(parseInt(req.query.window, 10) || 14, 60);
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 30);
  const since = new Date(Date.now() - windowDays * 24 * 3600 * 1000);

  const recentReviewCounts = await Review.aggregate([
    { $match: { createdAt: { $gte: since } } },
    { $group: { _id: "$aiTool", recentReviews: { $sum: 1 } } },
  ]);
  const recentReviewMap = new Map(recentReviewCounts.map((r) => [r._id.toString(), r.recentReviews]));

  const candidates = await AITool.find({ status: "approved" }).limit(300);

  const ranked = candidates
    .map((tool) => {
      const ageDays = Math.max((Date.now() - tool.createdAt.getTime()) / 86400000, 1);
      const recentReviews = recentReviewMap.get(tool._id.toString()) || 0;
      const score =
        (recentReviews * 4 + tool.bookmarksCount * 1.5 + tool.ratingAvg * 2) / Math.pow(Math.min(ageDays, 30) + 2, 0.8);
      return { tool, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.tool);

  return new ApiResponse(200, { tools: ranked }, "Trending tools fetched").send(res);
});

/**
 * GET /ai-tools/:slug
 */
const getTool = catchAsync(async (req, res) => {
  const tool = await resolveTool(req.params.slug);
  tool.viewsCount += 1;
  await tool.save({ validateBeforeSave: false });

  const obj = tool.toObject();
  if (req.user) {
    const bookmarkedSet = await hasLiked(req.user._id, "AITool", [tool._id]);
    obj.isBookmarked = bookmarkedSet.has(tool._id.toString());
  }

  return new ApiResponse(200, { tool: obj }, "Tool fetched").send(res);
});

/**
 * PATCH /ai-tools/:slug (submitter or platform admin)
 */
const updateTool = catchAsync(async (req, res) => {
  const tool = await resolveTool(req.params.slug);
  const isOwner = tool.submittedBy.equals(req.user._id);
  const isPlatformAdmin = ["admin", "moderator"].includes(req.user.role);
  if (!isOwner && !isPlatformAdmin) throw ApiError.forbidden("You can only edit tools you submitted");

  const { name, tagline, description, category, pricing, websiteUrl, tags, featured } = req.body;
  if (name !== undefined) tool.name = name.trim();
  if (tagline !== undefined) tool.tagline = tagline.trim();
  if (description !== undefined) tool.description = description.trim();
  if (category !== undefined) tool.category = category.trim();
  if (pricing !== undefined) tool.pricing = pricing;
  if (websiteUrl !== undefined) tool.websiteUrl = websiteUrl;
  if (tags !== undefined) tool.tags = tags.map((t) => t.trim().toLowerCase()).filter(Boolean);
  // Only platform admins/moderators can toggle "featured" — it's an
  // editorial placement, not something a submitter should self-grant.
  if (featured !== undefined && isPlatformAdmin) tool.featured = featured;

  await tool.save();
  return new ApiResponse(200, { tool }, "Tool updated").send(res);
});

/**
 * DELETE /ai-tools/:slug (submitter or platform admin)
 */
const deleteTool = catchAsync(async (req, res) => {
  const tool = await resolveTool(req.params.slug);
  const isOwner = tool.submittedBy.equals(req.user._id);
  const isPlatformAdmin = ["admin", "moderator"].includes(req.user.role);
  if (!isOwner && !isPlatformAdmin) throw ApiError.forbidden("You can only delete tools you submitted");

  if (tool.logoPublicId) await deleteAsset(tool.logoPublicId);

  const reviews = await Review.find({ aiTool: tool._id }).select("_id");
  const reviewIds = reviews.map((r) => r._id);

  await Promise.all([
    Review.deleteMany({ aiTool: tool._id }),
    Like.deleteMany({ targetType: "AITool", targetId: tool._id }),
    Like.deleteMany({ targetType: "Review", targetId: { $in: reviewIds } }),
  ]);

  await tool.deleteOne();

  return new ApiResponse(200, null, "Tool deleted").send(res);
});

/**
 * POST /ai-tools/:slug/logo (submitter or platform admin, multipart "logo")
 */
const uploadToolLogo = catchAsync(async (req, res) => {
  if (!req.file) throw ApiError.badRequest("No image file provided");
  const tool = await resolveTool(req.params.slug);
  const isOwner = tool.submittedBy.equals(req.user._id);
  const isPlatformAdmin = ["admin", "moderator"].includes(req.user.role);
  if (!isOwner && !isPlatformAdmin) throw ApiError.forbidden("You can only edit tools you submitted");

  const { url, publicId } = await uploadImage(req.file.buffer, "ai-tool-logos", `tool_${tool._id}`);
  const oldPublicId = tool.logoPublicId;
  tool.logoUrl = url;
  tool.logoPublicId = publicId;
  await tool.save();
  if (oldPublicId && oldPublicId !== publicId) await deleteAsset(oldPublicId);

  return new ApiResponse(200, { logoUrl: url }, "Logo updated").send(res);
});

/**
 * DELETE /ai-tools/:slug/logo (submitter or platform admin)
 */
const deleteToolLogo = catchAsync(async (req, res) => {
  const tool = await resolveTool(req.params.slug);
  const isOwner = tool.submittedBy.equals(req.user._id);
  const isPlatformAdmin = ["admin", "moderator"].includes(req.user.role);
  if (!isOwner && !isPlatformAdmin) throw ApiError.forbidden("You can only edit tools you submitted");

  const fresh = await AITool.findById(tool._id).select("+logoPublicId");
  if (fresh.logoPublicId) await deleteAsset(fresh.logoPublicId);
  fresh.logoUrl = null;
  fresh.logoPublicId = null;
  await fresh.save();

  return new ApiResponse(200, null, "Logo removed").send(res);
});

/**
 * POST /ai-tools/:slug/bookmark (toggle)
 */
const toggleBookmarkTool = catchAsync(async (req, res) => {
  const tool = await resolveTool(req.params.slug);
  const result = await toggleLike({
    userId: req.user._id,
    targetType: "AITool",
    targetId: tool._id,
    TargetModel: AITool,
    countField: "bookmarksCount",
  });
  return new ApiResponse(200, result, result.liked ? "Tool bookmarked" : "Bookmark removed").send(res);
});

// =========================== Reviews ===========================

/**
 * GET /ai-tools/:slug/reviews
 */
const getToolReviews = catchAsync(async (req, res) => {
  const tool = await resolveTool(req.params.slug);
  const { page, limit, skip } = getPagination(req.query);

  const [reviews, total] = await Promise.all([
    Review.find({ aiTool: tool._id }).populate("user", USER_SELECT).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Review.countDocuments({ aiTool: tool._id }),
  ]);

  return new ApiResponse(200, { reviews }, "Reviews fetched", buildMeta({ page, limit, total })).send(res);
});

/**
 * POST /ai-tools/:slug/reviews (authenticated — one per user per tool)
 */
const createReview = catchAsync(async (req, res) => {
  const tool = await resolveTool(req.params.slug);
  const { rating, content } = req.body;

  const existing = await Review.findOne({ aiTool: tool._id, user: req.user._id });
  if (existing) throw ApiError.conflict("You've already reviewed this tool — edit your existing review instead");

  const review = await Review.create({
    aiTool: tool._id,
    user: req.user._id,
    rating,
    content: content?.trim() || "",
  });

  await recomputeToolRating(tool._id);
  await review.populate("user", USER_SELECT);

  return new ApiResponse(201, { review }, "Review posted").send(res);
});

/**
 * PATCH /ai-tools/:slug/reviews/:reviewId (author only)
 */
const updateReview = catchAsync(async (req, res) => {
  const review = await Review.findOne({ _id: req.params.reviewId, aiTool: (await resolveTool(req.params.slug))._id });
  if (!review) throw ApiError.notFound("Review not found");
  if (!review.user.equals(req.user._id)) throw ApiError.forbidden("You can only edit your own review");

  const { rating, content } = req.body;
  if (rating !== undefined) review.rating = rating;
  if (content !== undefined) review.content = content.trim();
  review.isEdited = true;
  review.editedAt = new Date();
  await review.save();

  await recomputeToolRating(review.aiTool);
  await review.populate("user", USER_SELECT);

  return new ApiResponse(200, { review }, "Review updated").send(res);
});

/**
 * DELETE /ai-tools/:slug/reviews/:reviewId (author or platform admin)
 */
const deleteReview = catchAsync(async (req, res) => {
  const tool = await resolveTool(req.params.slug);
  const review = await Review.findOne({ _id: req.params.reviewId, aiTool: tool._id });
  if (!review) throw ApiError.notFound("Review not found");

  const isAuthor = review.user.equals(req.user._id);
  const isPlatformAdmin = ["admin", "moderator"].includes(req.user.role);
  if (!isAuthor && !isPlatformAdmin) throw ApiError.forbidden("You can only delete your own review");

  await review.deleteOne();
  await Like.deleteMany({ targetType: "Review", targetId: review._id });
  await recomputeToolRating(tool._id);

  return new ApiResponse(200, null, "Review deleted").send(res);
});

/**
 * POST /ai-tools/:slug/reviews/:reviewId/helpful (toggle)
 */
const toggleReviewHelpful = catchAsync(async (req, res) => {
  const review = await Review.findById(req.params.reviewId);
  if (!review) throw ApiError.notFound("Review not found");

  const result = await toggleLike({
    userId: req.user._id,
    targetType: "Review",
    targetId: review._id,
    TargetModel: Review,
    countField: "helpfulCount",
  });

  return new ApiResponse(200, result, result.liked ? "Marked as helpful" : "Helpful vote removed").send(res);
});

module.exports = {
  createTool,
  listTools,
  getCategories,
  getFeaturedTools,
  getTrendingTools,
  getTool,
  updateTool,
  deleteTool,
  uploadToolLogo,
  deleteToolLogo,
  toggleBookmarkTool,
  getToolReviews,
  createReview,
  updateReview,
  deleteReview,
  toggleReviewHelpful,
};
