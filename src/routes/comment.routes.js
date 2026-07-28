const express = require("express");
const commentController = require("../controllers/comment.controller");
const { protect, optionalAuth } = require("../middleware/auth.middleware");
const validate = require("../middleware/validate.middleware");
const {
  updateCommentValidator,
  commentIdValidator,
} = require("../validators/comment.validator");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Comments
 *   description: Comment editing, replies, and likes (creation is nested under /posts/{postId}/comments)
 */

/**
 * @swagger
 * /comments/{id}/replies:
 *   get:
 *     summary: Get replies to a top-level comment
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Replies fetched }
 */
router.get("/:id/replies", optionalAuth, commentIdValidator, validate, commentController.getCommentReplies);

/**
 * @swagger
 * /comments/{id}:
 *   patch:
 *     summary: Edit a comment (owner only)
 *     tags: [Comments]
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
 *     responses:
 *       200: { description: Comment updated }
 *   delete:
 *     summary: Delete a comment (owner, post owner, or admin/moderator)
 *     tags: [Comments]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Comment deleted }
 */
router.patch("/:id", protect, updateCommentValidator, validate, commentController.updateComment);
router.delete("/:id", protect, commentIdValidator, validate, commentController.deleteComment);

/**
 * @swagger
 * /comments/{id}/like:
 *   post:
 *     summary: Toggle like on a comment
 *     tags: [Comments]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Like toggled }
 */
router.post("/:id/like", protect, commentIdValidator, validate, commentController.toggleLikeComment);
router.get("/:id/likes", commentIdValidator, validate, commentController.getCommentLikers);

module.exports = router;
