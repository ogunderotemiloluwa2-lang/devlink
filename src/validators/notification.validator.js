const { param, query, body } = require("express-validator");
const Notification = require("../models/Notification.model");

const notificationIdValidator = [param("id").isMongoId().withMessage("Invalid notification id")];

const listNotificationsValidator = [
  query("type").optional().isIn(Notification.TYPES).withMessage("Invalid notification type"),
  query("isRead").optional().isBoolean(),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
];

const updatePreferencesValidator = [
  body("follow").optional().isBoolean(),
  body("like").optional().isBoolean(),
  body("comment").optional().isBoolean(),
  body("reply").optional().isBoolean(),
  body("mention").optional().isBoolean(),
  body("projectInvite").optional().isBoolean(),
  body("communityInvite").optional().isBoolean(),
  body("message").optional().isBoolean(),
  body("emailDigest").optional().isBoolean(),
];

module.exports = { notificationIdValidator, listNotificationsValidator, updatePreferencesValidator };
