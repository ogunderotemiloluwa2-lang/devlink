const { body, param } = require("express-validator");

const sendMessageValidator = [
  param("id").isMongoId().withMessage("Invalid conversation id"),
  body("content").optional().trim().isLength({ max: 5000 }),
  body("replyTo").optional().isMongoId().withMessage("Invalid replyTo message id"),
];

const messageIdValidator = [param("messageId").isMongoId().withMessage("Invalid message id")];

const editMessageValidator = [
  param("messageId").isMongoId().withMessage("Invalid message id"),
  body("content").trim().notEmpty().withMessage("Message content is required").isLength({ max: 5000 }),
];

const reactValidator = [
  param("messageId").isMongoId().withMessage("Invalid message id"),
  body("emoji").trim().notEmpty().withMessage("Emoji is required").isLength({ max: 8 }),
];

module.exports = { sendMessageValidator, messageIdValidator, editMessageValidator, reactValidator };
