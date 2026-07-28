const { body, param, query } = require("express-validator");

const createConversationValidator = [
  body("type").optional().isIn(["direct", "group"]).withMessage("Invalid conversation type"),
  body("participantUsername")
    .if(body("type").not().equals("group"))
    .trim()
    .notEmpty()
    .withMessage("participantUsername is required for a direct conversation"),
  body("participantUsernames")
    .if(body("type").equals("group"))
    .isArray({ min: 1 })
    .withMessage("A group needs at least one other participant"),
  body("groupName")
    .if(body("type").equals("group"))
    .trim()
    .notEmpty()
    .withMessage("Group name is required")
    .isLength({ max: 100 }),
];

const conversationIdValidator = [param("id").isMongoId().withMessage("Invalid conversation id")];

const updateGroupValidator = [
  param("id").isMongoId().withMessage("Invalid conversation id"),
  body("groupName").optional().trim().isLength({ min: 1, max: 100 }),
];

const addParticipantValidator = [
  param("id").isMongoId().withMessage("Invalid conversation id"),
  body("username").trim().notEmpty().withMessage("Username is required"),
];

const participantUsernameValidator = [
  param("id").isMongoId().withMessage("Invalid conversation id"),
  param("username").trim().notEmpty().withMessage("Username is required"),
];

const listQueryValidator = [
  query("cursor").optional().isString(),
  query("limit").optional().isInt({ min: 1, max: 100 }),
];

module.exports = {
  createConversationValidator,
  conversationIdValidator,
  updateGroupValidator,
  addParticipantValidator,
  participantUsernameValidator,
  listQueryValidator,
};
