const { body, param, query } = require("express-validator");
const Post = require("../models/Post.model");

const createPostValidator = [
  body("type").optional().isIn(Post.TYPES).withMessage("Invalid post type"),
  body("content").optional().isLength({ max: 3000 }).withMessage("Content must be under 3000 characters"),
  body("codeSnippet.code").optional().isLength({ max: 6000 }),
  body("link.url").optional({ checkFalsy: true }).isURL().withMessage("Link must be a valid URL"),
  body("poll.options").optional().isArray({ min: 2, max: 6 }).withMessage("A poll needs 2-6 options"),
];

const updatePostValidator = [
  param("id").isMongoId().withMessage("Invalid post id"),
  body("content").optional().isLength({ max: 3000 }).withMessage("Content must be under 3000 characters"),
];

const postIdValidator = [param("id").isMongoId().withMessage("Invalid post id")];

const voteValidator = [
  param("id").isMongoId().withMessage("Invalid post id"),
  body("optionId").isMongoId().withMessage("Invalid option id"),
];

const hashtagParamValidator = [param("tag").trim().notEmpty().withMessage("Hashtag is required")];

const listQueryValidator = [
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
];

const feedQueryValidator = [
  query("cursor").optional().isString(),
  query("limit").optional().isInt({ min: 1, max: 50 }),
];

module.exports = {
  createPostValidator,
  updatePostValidator,
  postIdValidator,
  voteValidator,
  hashtagParamValidator,
  listQueryValidator,
  feedQueryValidator,
};
