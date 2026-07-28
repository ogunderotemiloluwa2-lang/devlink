const express = require("express");
const postController = require("../controllers/post.controller");
const commentController = require("../controllers/comment.controller");
const { protect, optionalAuth } = require("../middleware/auth.middleware");
const validate = require("../middleware/validate.middleware");
const { multipleImageUpload } = require("../middleware/upload.middleware");
const {
  createPostValidator,
  updatePostValidator,
  postIdValidator,
  voteValidator,
  hashtagParamValidator,
  listQueryValidator,
  feedQueryValidator,
} = require("../validators/post.validator");
const {
  createCommentValidator,
  postIdParamValidator,
} = require("../validators/comment.validator");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Posts
 *   description: Feed posts — text, images, code, polls, project updates, reposts
 */

/**
 * @swagger
 * /posts:
 *   post:
 *     summary: Create a post
 *     tags: [Posts]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               type: { type: string, enum: [text, project-update, poll, image, video, link, code] }
 *               content: { type: string }
 *               images:
 *                 type: array
 *                 items: { type: string, format: binary }
 *     responses:
 *       201: { description: Post created }
 */
router.post("/", protect, multipleImageUpload, createPostValidator, validate, postController.createPost);

/**
 * @swagger
 * /posts/feed:
 *   get:
 *     summary: Cursor-paginated feed (infinite scroll)
 *     tags: [Posts]
 *     parameters:
 *       - in: query
 *         name: cursor
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: mode
 *         schema: { type: string, enum: [all, following] }
 *         description: '"following" requires authentication'
 *     responses:
 *       200: { description: Feed page fetched }
 */
router.get("/feed", optionalAuth, feedQueryValidator, validate, postController.getFeed);

/**
 * @swagger
 * /posts/trending:
 *   get:
 *     summary: Trending posts ranked by recent engagement
 *     tags: [Posts]
 *     parameters:
 *       - in: query
 *         name: window
 *         schema: { type: integer, default: 7 }
 *         description: Lookback window in days
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Trending posts fetched }
 */
router.get("/trending", optionalAuth, postController.getTrendingPosts);

/**
 * @swagger
 * /posts/hashtags/trending:
 *   get:
 *     summary: Trending hashtags over the last 14 days
 *     tags: [Posts]
 *     responses:
 *       200: { description: Trending hashtags fetched }
 */
router.get("/hashtags/trending", postController.getTrendingHashtags);

/**
 * @swagger
 * /posts/hashtag/{tag}:
 *   get:
 *     summary: Get posts containing a hashtag
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: tag
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Posts fetched }
 */
router.get("/hashtag/:tag", optionalAuth, hashtagParamValidator, validate, postController.getPostsByHashtag);

/**
 * @swagger
 * /posts/user/{username}:
 *   get:
 *     summary: Get a user's posts
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: User posts fetched }
 */
router.get("/user/:username", optionalAuth, listQueryValidator, validate, postController.getUserPosts);

/**
 * @swagger
 * /posts/{id}:
 *   get:
 *     summary: Get a single post
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Post fetched }
 *       404: { description: Post not found }
 *   patch:
 *     summary: Edit a post (owner only)
 *     tags: [Posts]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Post updated }
 *   delete:
 *     summary: Delete a post (owner, admin, or moderator)
 *     tags: [Posts]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Post deleted }
 */
router.get("/:id", optionalAuth, postIdValidator, validate, postController.getPostById);
router.patch("/:id", protect, updatePostValidator, validate, postController.updatePost);
router.delete("/:id", protect, postIdValidator, validate, postController.deletePost);

/**
 * @swagger
 * /posts/{id}/like:
 *   post:
 *     summary: Toggle like on a post
 *     tags: [Posts]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Like toggled }
 */
router.post("/:id/like", protect, postIdValidator, validate, postController.toggleLikePost);
router.get("/:id/likes", postIdValidator, validate, postController.getPostLikers);

/**
 * @swagger
 * /posts/{id}/bookmark:
 *   post:
 *     summary: Toggle bookmark on a post
 *     tags: [Posts]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Bookmark toggled }
 */
router.post("/:id/bookmark", protect, postIdValidator, validate, postController.toggleBookmarkPost);

/**
 * @swagger
 * /posts/{id}/vote:
 *   post:
 *     summary: Vote in a poll post
 *     tags: [Posts]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [optionId]
 *             properties:
 *               optionId: { type: string }
 *     responses:
 *       200: { description: Vote recorded }
 */
router.post("/:id/vote", protect, voteValidator, validate, postController.votePoll);

/**
 * @swagger
 * /posts/{postId}/comments:
 *   get:
 *     summary: Get top-level comments on a post
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Comments fetched }
 *   post:
 *     summary: Add a comment or reply to a post
 *     tags: [Posts]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content: { type: string }
 *               parentComment: { type: string, description: "Optional — reply to a top-level comment" }
 *     responses:
 *       201: { description: Comment added }
 */
router.get("/:postId/comments", optionalAuth, postIdParamValidator, validate, commentController.getPostComments);
router.post("/:postId/comments", protect, createCommentValidator, validate, commentController.createComment);

module.exports = router;
