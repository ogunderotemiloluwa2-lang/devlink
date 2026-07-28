const express = require("express");
const followController = require("../controllers/follow.controller");
const { protect, optionalAuth } = require("../middleware/auth.middleware");
const validate = require("../middleware/validate.middleware");
const { authLimiter } = require("../middleware/rateLimiter.middleware");
const {
  usernameParamValidator,
  paginationValidator,
  suggestionsQueryValidator,
} = require("../validators/follow.validator");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Follow
 *   description: Follow/unfollow, followers, following, mutual connections, suggestions
 */

/**
 * @swagger
 * /follow/suggestions:
 *   get:
 *     summary: Get suggested developers to follow
 *     tags: [Follow]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200: { description: Suggestions fetched }
 */
router.get("/suggestions", protect, suggestionsQueryValidator, validate, followController.getSuggestedDevelopers);

/**
 * @swagger
 * /follow/{username}:
 *   post:
 *     summary: Follow a user
 *     tags: [Follow]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       201: { description: Now following }
 *       400: { description: Cannot follow yourself }
 *   delete:
 *     summary: Unfollow a user
 *     tags: [Follow]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Unfollowed }
 */
router.post("/:username", protect, authLimiter, usernameParamValidator, validate, followController.followUser);
router.delete("/:username", protect, usernameParamValidator, validate, followController.unfollowUser);

/**
 * @swagger
 * /follow/{username}/followers:
 *   get:
 *     summary: Get a user's followers
 *     tags: [Follow]
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Followers fetched }
 */
router.get(
  "/:username/followers",
  optionalAuth,
  usernameParamValidator,
  paginationValidator,
  validate,
  followController.getFollowers
);

/**
 * @swagger
 * /follow/{username}/following:
 *   get:
 *     summary: Get accounts a user follows
 *     tags: [Follow]
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Following fetched }
 */
router.get(
  "/:username/following",
  optionalAuth,
  usernameParamValidator,
  paginationValidator,
  validate,
  followController.getFollowing
);

/**
 * @swagger
 * /follow/{username}/mutual:
 *   get:
 *     summary: Get mutual connections between the viewer and a user
 *     tags: [Follow]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Mutual connections fetched }
 */
router.get(
  "/:username/mutual",
  protect,
  usernameParamValidator,
  paginationValidator,
  validate,
  followController.getMutualConnections
);

module.exports = router;
