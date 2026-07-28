const express = require("express");
const bookmarkController = require("../controllers/bookmark.controller");
const { protect } = require("../middleware/auth.middleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Bookmarks
 *   description: Saved posts (toggling a bookmark happens via POST /posts/{id}/bookmark)
 */

/**
 * @swagger
 * /bookmarks:
 *   get:
 *     summary: Get the authenticated user's bookmarked posts
 *     tags: [Bookmarks]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: collection
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Bookmarks fetched }
 */
router.get("/", protect, bookmarkController.getMyBookmarks);

/**
 * @swagger
 * /bookmarks/collections:
 *   get:
 *     summary: Get the authenticated user's bookmark collection names
 *     tags: [Bookmarks]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Collections fetched }
 */
router.get("/collections", protect, bookmarkController.getMyCollections);

module.exports = router;
