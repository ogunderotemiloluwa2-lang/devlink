const express = require("express");
const conversationController = require("../controllers/conversation.controller");
const messageController = require("../controllers/message.controller");
const { protect } = require("../middleware/auth.middleware");
const validate = require("../middleware/validate.middleware");
const { avatarUpload, messageAttachmentUpload } = require("../middleware/upload.middleware");
const {
  createConversationValidator,
  conversationIdValidator,
  updateGroupValidator,
  addParticipantValidator,
  participantUsernameValidator,
  listQueryValidator,
} = require("../validators/conversation.validator");
const { sendMessageValidator } = require("../validators/message.validator");

const router = express.Router();

// Every route in this file requires authentication.
router.use(protect);

/**
 * @swagger
 * tags:
 *   name: Conversations
 *   description: Direct and group conversations
 */

router.get("/", listQueryValidator, validate, conversationController.getMyConversations);

/**
 * @swagger
 * /conversations:
 *   post:
 *     summary: Start a direct conversation, or create a group
 *     tags: [Conversations]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type: { type: string, enum: [direct, group], default: direct }
 *               participantUsername: { type: string, description: "required for type=direct" }
 *               groupName: { type: string, description: "required for type=group" }
 *               participantUsernames:
 *                 type: array
 *                 items: { type: string }
 *                 description: "required for type=group"
 *     responses:
 *       201: { description: Conversation created }
 *       200: { description: Existing direct conversation returned }
 */
router.post("/", createConversationValidator, validate, conversationController.createConversation);

/**
 * @swagger
 * /conversations/unread-count:
 *   get:
 *     summary: Get the total unread message count across all conversations
 *     tags: [Conversations]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Unread count fetched }
 */
router.get("/unread-count", conversationController.getUnreadCount);

/**
 * @swagger
 * /conversations/{id}:
 *   get:
 *     summary: Get a conversation by id
 *     tags: [Conversations]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Conversation fetched }
 *       403: { description: Not a participant }
 *   patch:
 *     summary: Edit a group's name (group admin only)
 *     tags: [Conversations]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Group updated }
 */
router.get("/:id", conversationIdValidator, validate, conversationController.getConversation);
router.patch("/:id", updateGroupValidator, validate, conversationController.updateGroup);

/**
 * @swagger
 * /conversations/{id}/avatar:
 *   post:
 *     summary: Upload a group's avatar (group admin only)
 *     tags: [Conversations]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar: { type: string, format: binary }
 *     responses:
 *       200: { description: Avatar updated }
 */
router.post("/:id/avatar", avatarUpload, conversationIdValidator, validate, conversationController.uploadGroupAvatar);
router.delete("/:id/avatar", conversationIdValidator, validate, conversationController.deleteGroupAvatar);

/**
 * @swagger
 * /conversations/{id}/participants:
 *   post:
 *     summary: Add a participant to a group (group admin only)
 *     tags: [Conversations]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username]
 *             properties:
 *               username: { type: string }
 *     responses:
 *       200: { description: Participant added }
 */
router.post("/:id/participants", addParticipantValidator, validate, conversationController.addParticipant);

/**
 * @swagger
 * /conversations/{id}/participants/{username}:
 *   delete:
 *     summary: Remove a participant from a group (group admin only)
 *     tags: [Conversations]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Participant removed }
 */
router.delete(
  "/:id/participants/:username",
  participantUsernameValidator,
  validate,
  conversationController.removeParticipant
);

/**
 * @swagger
 * /conversations/{id}/leave:
 *   post:
 *     summary: Leave a group conversation
 *     tags: [Conversations]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Left the group }
 */
router.post("/:id/leave", conversationIdValidator, validate, conversationController.leaveConversation);

/**
 * @swagger
 * /conversations/{id}/read:
 *   post:
 *     summary: Mark a conversation as read
 *     tags: [Conversations]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Marked as read }
 */
router.post("/:id/read", conversationIdValidator, validate, conversationController.markConversationRead);

/**
 * @swagger
 * /conversations/{id}/messages:
 *   get:
 *     summary: Get messages in a conversation (cursor-paginated, loads older messages)
 *     tags: [Conversations]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: cursor
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 30 }
 *     responses:
 *       200: { description: Messages fetched }
 *   post:
 *     summary: Send a message (text and/or up to 5 attachments)
 *     tags: [Conversations]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               content: { type: string }
 *               replyTo: { type: string }
 *               attachments:
 *                 type: array
 *                 items: { type: string, format: binary }
 *     responses:
 *       201: { description: Message sent }
 */
router.get("/:id/messages", conversationIdValidator, validate, messageController.getMessages);
router.post(
  "/:id/messages",
  messageAttachmentUpload,
  sendMessageValidator,
  validate,
  messageController.sendMessage
);

module.exports = router;
