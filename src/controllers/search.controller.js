const User = require("../models/User.model");
const Profile = require("../models/Profile.model");
const Project = require("../models/Project.model");
const Community = require("../models/Community.model");
const Post = require("../models/Post.model");
const AITool = require("../models/AITool.model");
const Skill = require("../models/Skill.model");
const Search = require("../models/Search.model");
const catchAsync = require("../utils/catchAsync");
const ApiResponse = require("../utils/ApiResponse");
const { getPagination, buildMeta } = require("../utils/pagination");
const logger = require("../utils/logger");

const USER_SELECT = "name username avatarUrl role";
const AUTHOR_SELECT = "name username avatarUrl role";

function regexFor(q) {
  return new RegExp(q.trim(), "i");
}

/**
 * Fire-and-forget: records a search query for recent/trending purposes.
 * Never lets a logging failure affect the actual search response.
 */
async function recordSearch(userId, query) {
  const trimmed = query?.trim();
  if (!trimmed || trimmed.length < 2) return;
  try {
    await Search.create({ user: userId || null, query: trimmed });
  } catch (err) {
    logger.warn("Failed to record search:", err.message);
  }
}

// =========================== Per-type search ===========================

async function searchDevelopers(q, skip, limit) {
  const regex = regexFor(q);
  const matchingUsers = await User.find({ status: "active", $or: [{ name: regex }, { username: regex }] }).select(
    "_id"
  );
  const userIds = matchingUsers.map((u) => u._id);

  const filter = { visibility: "public", user: { $in: userIds } };
  const [profiles, total] = await Promise.all([
    Profile.find(filter).populate("user", USER_SELECT).sort({ followersCount: -1 }).skip(skip).limit(limit),
    Profile.countDocuments(filter),
  ]);

  return { results: profiles.filter((p) => p.user), total };
}

async function searchProjects(q, skip, limit) {
  const regex = regexFor(q);
  const filter = {
    status: "active",
    visibility: "public",
    $or: [{ name: regex }, { tagline: regex }, { description: regex }, { stack: regex }],
  };
  const [results, total] = await Promise.all([
    Project.find(filter).populate("owner", USER_SELECT).sort({ starsCount: -1 }).skip(skip).limit(limit),
    Project.countDocuments(filter),
  ]);
  return { results, total };
}

async function searchCommunities(q, skip, limit) {
  const regex = regexFor(q);
  const filter = {
    status: "active",
    visibility: "public",
    $or: [{ name: regex }, { description: regex }, { topics: regex }],
  };
  const [results, total] = await Promise.all([
    Community.find(filter).sort({ membersCount: -1 }).skip(skip).limit(limit),
    Community.countDocuments(filter),
  ]);
  return { results, total };
}

async function searchPosts(q, skip, limit) {
  const regex = regexFor(q);
  const filter = { status: "active", $or: [{ content: regex }, { hashtags: regex }] };
  const [results, total] = await Promise.all([
    Post.find(filter).populate("author", AUTHOR_SELECT).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Post.countDocuments(filter),
  ]);
  return { results, total };
}

async function searchTools(q, skip, limit) {
  const regex = regexFor(q);
  const filter = {
    status: "approved",
    $or: [{ name: regex }, { tagline: regex }, { description: regex }, { tags: regex }],
  };
  const [results, total] = await Promise.all([
    AITool.find(filter).sort({ ratingAvg: -1 }).skip(skip).limit(limit),
    AITool.countDocuments(filter),
  ]);
  return { results, total };
}

async function searchSkills(q, limit) {
  const regex = new RegExp(q.trim().toLowerCase(), "i");
  const results = await Skill.aggregate([
    { $match: { slug: regex } },
    { $group: { _id: "$slug", name: { $first: "$name" }, category: { $first: "$category" }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
    { $project: { _id: 0, name: 1, category: 1, count: 1 } },
  ]);
  return { results, total: results.length };
}

async function searchCompanies(q, limit) {
  const regex = regexFor(q);
  const results = await Profile.aggregate([
    { $match: { company: { $regex: regex }, visibility: "public" } },
    { $match: { company: { $ne: "" } } },
    { $group: { _id: "$company", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
    { $project: { _id: 0, name: "$_id", count: 1 } },
  ]);
  return { results, total: results.length };
}

// =========================== Route handlers ===========================

/**
 * GET /search — combined "everything" search, small limit per category.
 * Query: q, limit (per-category, default 5)
 */
const searchAll = catchAsync(async (req, res) => {
  const { q } = req.query;
  const limit = Math.min(parseInt(req.query.limit, 10) || 5, 20);

  if (!q || q.trim().length < 2) {
    return new ApiResponse(
      200,
      { developers: [], projects: [], communities: [], posts: [], tools: [], skills: [], companies: [] },
      "Enter at least 2 characters to search"
    ).send(res);
  }

  const [developers, projects, communities, posts, tools, skills, companies] = await Promise.all([
    searchDevelopers(q, 0, limit),
    searchProjects(q, 0, limit),
    searchCommunities(q, 0, limit),
    searchPosts(q, 0, limit),
    searchTools(q, 0, limit),
    searchSkills(q, limit),
    searchCompanies(q, limit),
  ]);

  recordSearch(req.user?._id, q); // fire-and-forget

  return new ApiResponse(
    200,
    {
      developers: developers.results,
      projects: projects.results,
      communities: communities.results,
      posts: posts.results,
      tools: tools.results,
      skills: skills.results,
      companies: companies.results,
    },
    "Search results fetched"
  ).send(res);
});

function makeTypedHandler(searchFn, resultKey) {
  return catchAsync(async (req, res) => {
    const { q } = req.query;
    const { page, limit, skip } = getPagination(req.query);

    if (!q || q.trim().length < 2) {
      return new ApiResponse(200, { [resultKey]: [] }, "Enter at least 2 characters to search").send(res);
    }

    const { results, total } = await searchFn(q, skip, limit);
    recordSearch(req.user?._id, q);

    return new ApiResponse(200, { [resultKey]: results }, "Results fetched", buildMeta({ page, limit, total })).send(res);
  });
}

const searchDevelopersRoute = makeTypedHandler(searchDevelopers, "developers");
const searchProjectsRoute = makeTypedHandler(searchProjects, "projects");
const searchCommunitiesRoute = makeTypedHandler(searchCommunities, "communities");
const searchPostsRoute = makeTypedHandler(searchPosts, "posts");
const searchToolsRoute = makeTypedHandler(searchTools, "tools");

const searchSkillsRoute = catchAsync(async (req, res) => {
  const { q } = req.query;
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
  if (!q || q.trim().length < 2) {
    return new ApiResponse(200, { skills: [] }, "Enter at least 2 characters to search").send(res);
  }
  const { results } = await searchSkills(q, limit);
  recordSearch(req.user?._id, q);
  return new ApiResponse(200, { skills: results }, "Skills fetched").send(res);
});

const searchCompaniesRoute = catchAsync(async (req, res) => {
  const { q } = req.query;
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
  if (!q || q.trim().length < 2) {
    return new ApiResponse(200, { companies: [] }, "Enter at least 2 characters to search").send(res);
  }
  const { results } = await searchCompanies(q, limit);
  recordSearch(req.user?._id, q);
  return new ApiResponse(200, { companies: results }, "Companies fetched").send(res);
});

// =========================== Recent / trending ===========================

/**
 * GET /search/recent (authenticated) — the user's own recent unique queries
 */
const getRecentSearches = catchAsync(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 30);

  const recent = await Search.aggregate([
    { $match: { user: req.user._id } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: "$query", lastSearchedAt: { $first: "$createdAt" } } },
    { $sort: { lastSearchedAt: -1 } },
    { $limit: limit },
    { $project: { _id: 0, query: "$_id", lastSearchedAt: 1 } },
  ]);

  return new ApiResponse(200, { searches: recent }, "Recent searches fetched").send(res);
});

/**
 * DELETE /search/recent (authenticated) — clear all of the user's search history
 */
const clearRecentSearches = catchAsync(async (req, res) => {
  const result = await Search.deleteMany({ user: req.user._id });
  return new ApiResponse(200, { deletedCount: result.deletedCount }, "Recent searches cleared").send(res);
});

/**
 * DELETE /search/recent/:query (authenticated) — remove one query from history
 */
const deleteRecentSearch = catchAsync(async (req, res) => {
  const query = req.params.query.trim().toLowerCase();
  const result = await Search.deleteMany({ user: req.user._id, query });
  return new ApiResponse(200, { deletedCount: result.deletedCount }, "Search removed from history").send(res);
});

/**
 * GET /search/trending (public) — most common queries across all users recently
 */
const getTrendingSearches = catchAsync(async (req, res) => {
  const windowDays = Math.min(parseInt(req.query.window, 10) || 7, 30);
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 30);
  const since = new Date(Date.now() - windowDays * 24 * 3600 * 1000);

  const trending = await Search.aggregate([
    { $match: { createdAt: { $gte: since } } },
    { $group: { _id: "$query", count: { $sum: 1 } } },
    { $match: { count: { $gte: 2 } } }, // filter out one-off noise
    { $sort: { count: -1 } },
    { $limit: limit },
    { $project: { _id: 0, query: "$_id", count: 1 } },
  ]);

  return new ApiResponse(200, { searches: trending }, "Trending searches fetched").send(res);
});

module.exports = {
  searchAll,
  searchDevelopersRoute,
  searchProjectsRoute,
  searchCommunitiesRoute,
  searchPostsRoute,
  searchToolsRoute,
  searchSkillsRoute,
  searchCompaniesRoute,
  getRecentSearches,
  clearRecentSearches,
  deleteRecentSearch,
  getTrendingSearches,
};
