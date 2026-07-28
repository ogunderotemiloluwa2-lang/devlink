const express = require("express");
const searchController = require("../controllers/search.controller");
const { protect, optionalAuth } = require("../middleware/auth.middleware");
const validate = require("../middleware/validate.middleware");
const {
  searchQueryValidator,
  trendingQueryValidator,
  recentQueryParamValidator,
} = require("../validators/search.validator");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Search
 *   description: Global search across developers, projects, communities, posts, AI tools, skills, and companies
 */

router.get("/", optionalAuth, searchQueryValidator, validate, searchController.searchAll);
router.get("/trending", trendingQueryValidator, validate, searchController.getTrendingSearches);

router.get("/recent", protect, searchController.getRecentSearches);
router.delete("/recent", protect, searchController.clearRecentSearches);
router.delete("/recent/:query", protect, recentQueryParamValidator, validate, searchController.deleteRecentSearch);

router.get("/developers", optionalAuth, searchQueryValidator, validate, searchController.searchDevelopersRoute);
router.get("/projects", searchQueryValidator, validate, searchController.searchProjectsRoute);
router.get("/communities", searchQueryValidator, validate, searchController.searchCommunitiesRoute);
router.get("/posts", searchQueryValidator, validate, searchController.searchPostsRoute);
router.get("/tools", searchQueryValidator, validate, searchController.searchToolsRoute);
router.get("/skills", searchQueryValidator, validate, searchController.searchSkillsRoute);
router.get("/companies", searchQueryValidator, validate, searchController.searchCompaniesRoute);

module.exports = router;
