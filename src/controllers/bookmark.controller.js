const Bookmark = require("../models/Bookmark.model");
const catchAsync = require("../utils/catchAsync");
const ApiResponse = require("../utils/ApiResponse");
const { getPagination, buildMeta } = require("../utils/pagination");

const AUTHOR_SELECT = "name username avatarUrl role";

/**
 * GET /bookmarks (authenticated)
 * Query: collection, page, limit
 */
const getMyBookmarks = catchAsync(async (req, res) => {
  const { collection } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  const filter = { user: req.user._id };
  if (collection) filter.collectionName = collection;

  const [bookmarks, total] = await Promise.all([
    Bookmark.find(filter)
      .populate({
        path: "post",
        populate: { path: "author", select: AUTHOR_SELECT },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Bookmark.countDocuments(filter),
  ]);

  // A bookmarked post may have since been deleted — filter those out rather
  // than surfacing a null post to the client.
  const posts = bookmarks.filter((b) => b.post).map((b) => ({ ...b.post.toObject(), bookmarkedAt: b.createdAt, collectionName: b.collectionName }));

  return new ApiResponse(200, { bookmarks: posts }, "Bookmarks fetched", buildMeta({ page, limit, total })).send(res);
});

/**
 * GET /bookmarks/collections (authenticated) — distinct collection names in use
 */
const getMyCollections = catchAsync(async (req, res) => {
  const collections = await Bookmark.distinct("collectionName", { user: req.user._id });
  return new ApiResponse(200, { collections }, "Collections fetched").send(res);
});

module.exports = { getMyBookmarks, getMyCollections };
