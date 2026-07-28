const { body, param } = require("express-validator");

const createCommentValidator = [
  param("postId").isMongoId().withMessage("Invalid post id"),
  body("content").trim().notEmpty().withMessage("Comment content is required").isLength({ max: 1000 }),
  body("parentComment").optional().isMongoId().withMessage("Invalid parent comment id"),
];

const updateCommentValidator = [
  param("id").isMongoId().withMessage("Invalid comment id"),
  body("content").trim().notEmpty().withMessage("Comment content is required").isLength({ max: 1000 }),
];

const commentIdValidator = [param("id").isMongoId().withMessage("Invalid comment id")];

const postIdParamValidator = [param("postId").isMongoId().withMessage("Invalid post id")];

module.exports = {
  createCommentValidator,
  updateCommentValidator,
  commentIdValidator,
  postIdParamValidator,
};
