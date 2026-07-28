const express = require("express");
const aiToolController = require("../controllers/aiTool.controller");
const { protect, optionalAuth } = require("../middleware/auth.middleware");
const validate = require("../middleware/validate.middleware");
const { singleImageUpload } = require("../middleware/upload.middleware");
const {
  createToolValidator,
  updateToolValidator,
  slugParamValidator,
  listToolsValidator,
  createReviewValidator,
  reviewIdValidator,
} = require("../validators/aiTool.validator");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: AI Hub
 *   description: AI tool directory — CRUD, categories, ratings/reviews, bookmarks, featured/trending
 */

router.get("/", optionalAuth, listToolsValidator, validate, aiToolController.listTools);

/**
 * @swagger
 * /ai-tools:
 *   post:
 *     summary: Submit a new tool to the AI Hub
 *     tags: [AI Hub]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, category]
 *             properties:
 *               name: { type: string }
 *               tagline: { type: string }
 *               description: { type: string }
 *               category: { type: string }
 *               pricing: { type: string, enum: [Free, Freemium, Paid] }
 *               websiteUrl: { type: string }
 *               tags: { type: array, items: { type: string } }
 *     responses:
 *       201: { description: Tool created }
 */
router.post("/", protect, createToolValidator, validate, aiToolController.createTool);

router.get("/categories", aiToolController.getCategories);
router.get("/featured", aiToolController.getFeaturedTools);
router.get("/trending", aiToolController.getTrendingTools);

/**
 * @swagger
 * /ai-tools/{slug}:
 *   get:
 *     summary: Get a tool by slug
 *     tags: [AI Hub]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Tool fetched }
 *       404: { description: Tool not found }
 *   patch:
 *     summary: Edit a tool (submitter or platform admin)
 *     tags: [AI Hub]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Tool updated }
 *   delete:
 *     summary: Delete a tool (submitter or platform admin)
 *     tags: [AI Hub]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Tool deleted }
 */
router.get("/:slug", optionalAuth, slugParamValidator, validate, aiToolController.getTool);
router.patch("/:slug", protect, updateToolValidator, validate, aiToolController.updateTool);
router.delete("/:slug", protect, slugParamValidator, validate, aiToolController.deleteTool);

router.post("/:slug/logo", protect, singleImageUpload, slugParamValidator, validate, aiToolController.uploadToolLogo);
router.delete("/:slug/logo", protect, slugParamValidator, validate, aiToolController.deleteToolLogo);
router.post("/:slug/bookmark", protect, slugParamValidator, validate, aiToolController.toggleBookmarkTool);

/**
 * @swagger
 * /ai-tools/{slug}/reviews:
 *   get:
 *     summary: Get a tool's reviews
 *     tags: [AI Hub]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Reviews fetched }
 *   post:
 *     summary: Post a review (one per user per tool)
 *     tags: [AI Hub]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rating]
 *             properties:
 *               rating: { type: integer, minimum: 1, maximum: 5 }
 *               content: { type: string }
 *     responses:
 *       201: { description: Review posted }
 *       409: { description: Already reviewed — edit instead }
 */
router.get("/:slug/reviews", slugParamValidator, validate, aiToolController.getToolReviews);
router.post("/:slug/reviews", protect, createReviewValidator, validate, aiToolController.createReview);

router.patch("/:slug/reviews/:reviewId", protect, reviewIdValidator, validate, aiToolController.updateReview);
router.delete("/:slug/reviews/:reviewId", protect, reviewIdValidator, validate, aiToolController.deleteReview);
router.post(
  "/:slug/reviews/:reviewId/helpful",
  protect,
  reviewIdValidator,
  validate,
  aiToolController.toggleReviewHelpful
);

module.exports = router;
