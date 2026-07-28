const { body, param, query } = require("express-validator");
const AITool = require("../models/AITool.model");

const createToolValidator = [
  body("name").trim().notEmpty().withMessage("Tool name is required").isLength({ max: 100 }),
  body("tagline").optional().trim().isLength({ max: 150 }),
  body("description").optional().trim().isLength({ max: 2000 }),
  body("category").trim().notEmpty().withMessage("Category is required").isLength({ max: 60 }),
  body("pricing").optional().isIn(AITool.PRICING_OPTIONS).withMessage("Invalid pricing option"),
  body("websiteUrl").optional({ checkFalsy: true }).trim().isURL().withMessage("Website must be a valid URL"),
  body("tags").optional().isArray({ max: 10 }),
];

const updateToolValidator = [
  param("slug").trim().notEmpty(),
  body("name").optional().trim().isLength({ min: 1, max: 100 }),
  body("tagline").optional().trim().isLength({ max: 150 }),
  body("description").optional().trim().isLength({ max: 2000 }),
  body("category").optional().trim().isLength({ min: 1, max: 60 }),
  body("pricing").optional().isIn(AITool.PRICING_OPTIONS).withMessage("Invalid pricing option"),
  body("websiteUrl").optional({ checkFalsy: true }).trim().isURL(),
  body("tags").optional().isArray({ max: 10 }),
  body("featured").optional().isBoolean(),
];

const slugParamValidator = [param("slug").trim().notEmpty().withMessage("Tool slug is required")];

const listToolsValidator = [
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("pricing").optional().isIn(AITool.PRICING_OPTIONS),
];

const createReviewValidator = [
  param("slug").trim().notEmpty(),
  body("rating").isInt({ min: 1, max: 5 }).withMessage("Rating must be between 1 and 5"),
  body("content").optional().trim().isLength({ max: 1000 }),
];

const reviewIdValidator = [
  param("slug").trim().notEmpty(),
  param("reviewId").isMongoId().withMessage("Invalid review id"),
];

module.exports = {
  createToolValidator,
  updateToolValidator,
  slugParamValidator,
  listToolsValidator,
  createReviewValidator,
  reviewIdValidator,
};
