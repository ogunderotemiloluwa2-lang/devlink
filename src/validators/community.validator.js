const { body, param, query } = require("express-validator");
const CommunityMember = require("../models/CommunityMember.model");

const createCommunityValidator = [
  body("name").trim().notEmpty().withMessage("Community name is required").isLength({ max: 100 }),
  body("description").optional().trim().isLength({ max: 500 }),
  body("topics").optional().isArray({ max: 10 }).withMessage("Up to 10 topics allowed"),
  body("rules").optional().isArray({ max: 20 }).withMessage("Up to 20 rules allowed"),
  body("visibility").optional().isIn(["public", "private"]),
];

const updateCommunityValidator = [
  param("slug").trim().notEmpty(),
  body("name").optional().trim().isLength({ min: 1, max: 100 }),
  body("description").optional().trim().isLength({ max: 500 }),
  body("topics").optional().isArray({ max: 10 }),
  body("rules").optional().isArray({ max: 20 }),
  body("visibility").optional().isIn(["public", "private"]),
];

const slugParamValidator = [param("slug").trim().notEmpty().withMessage("Community slug is required")];

const memberUsernameValidator = [
  param("slug").trim().notEmpty(),
  param("username").trim().notEmpty().withMessage("Username is required"),
];

const inviteValidator = [
  param("slug").trim().notEmpty(),
  body("username").trim().notEmpty().withMessage("Username is required"),
];

const updateRoleValidator = [
  ...memberUsernameValidator,
  body("role").isIn(CommunityMember.ROLES).withMessage("Invalid role"),
];

const createCommunityPostValidator = [
  param("slug").trim().notEmpty(),
  body("content").trim().notEmpty().withMessage("Post content cannot be empty").isLength({ max: 3000 }),
  body("isAnnouncement").optional().isBoolean(),
];

const listCommunitiesValidator = [
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
];

module.exports = {
  createCommunityValidator,
  updateCommunityValidator,
  slugParamValidator,
  memberUsernameValidator,
  inviteValidator,
  updateRoleValidator,
  createCommunityPostValidator,
  listCommunitiesValidator,
};
