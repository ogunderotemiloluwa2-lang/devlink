const express = require("express");
const messageController = require("../controllers/message.controller");
const { protect } = require("../middleware/auth.middleware");
const validate = require("../middleware/validate.middleware");
const { messageIdValidator, editMessageValidator, reactValidator } = require("../validators/message.validator");

const router = express.Router();

router.use(protect);

/**
 * @swagger
 * tags:
 *   name: Messages
 *   description: Editing, deleting, and reacting to messages (sending/listing is nested under /conversations/{id}/messages)
 */

/**
 * @swagger
 * /messages/{messageId}:
 *   patch:
 *     summary: Edit a message (sender only)
 *     tags: [Messages]
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
 *       200: { description: Message updated }
 *   delete:
 *     summary: Delete a message for everyone (sender only)
 *     tags: [Messages]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Message deleted }
 */
router.patch("/:messageId", editMessageValidator, validate, messageController.editMessage);
router.delete("/:messageId", messageIdValidator, validate, messageController.deleteMessage);

/**
 * @swagger
 * /messages/{messageId}/react:
 *   post:
 *     summary: React to a message (same emoji again removes it)
 *     tags: [Messages]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [emoji]
 *             properties:
 *               emoji: { type: string, example: "🔥" }
 *     responses:
 *       200: { description: Reaction updated }
 */
router.post("/:messageId/react", reactValidator, validate, messageController.reactToMessage);

module.exports = router;
