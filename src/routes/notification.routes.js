const express = require("express");
const notificationController = require("../controllers/notification.controller");
const { protect } = require("../middleware/auth.middleware");
const validate = require("../middleware/validate.middleware");
const {
  notificationIdValidator,
  listNotificationsValidator,
  updatePreferencesValidator,
} = require("../validators/notification.validator");

const router = express.Router();

router.use(protect);

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: Real-time notifications, preferences, and read state
 */

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Get the authenticated user's notifications
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [follow, like, comment, reply, mention, project_invite, community_invite, message, system] }
 *       - in: query
 *         name: isRead
 *         schema: { type: boolean }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Notifications fetched }
 *   delete:
 *     summary: Clear notifications (all, or only read ones with ?readOnly=true)
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: readOnly
 *         schema: { type: boolean }
 *     responses:
 *       200: { description: Notifications cleared }
 */
router.get("/", listNotificationsValidator, validate, notificationController.getMyNotifications);
router.delete("/", notificationController.clearNotifications);

router.get("/unread-count", notificationController.getUnreadCount);
router.post("/read-all", notificationController.markAllAsRead);

/**
 * @swagger
 * /notifications/preferences:
 *   get:
 *     summary: Get notification preferences
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Preferences fetched }
 *   patch:
 *     summary: Update notification preferences
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               follow: { type: boolean }
 *               like: { type: boolean }
 *               comment: { type: boolean }
 *               reply: { type: boolean }
 *               mention: { type: boolean }
 *               projectInvite: { type: boolean }
 *               communityInvite: { type: boolean }
 *               message: { type: boolean }
 *               emailDigest: { type: boolean }
 *     responses:
 *       200: { description: Preferences updated }
 */
router.get("/preferences", notificationController.getPreferences);
router.patch("/preferences", updatePreferencesValidator, validate, notificationController.updatePreferences);

/**
 * @swagger
 * /notifications/{id}/read:
 *   patch:
 *     summary: Mark a single notification as read
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Marked as read }
 */
router.patch("/:id/read", notificationIdValidator, validate, notificationController.markAsRead);

/**
 * @swagger
 * /notifications/{id}:
 *   delete:
 *     summary: Delete a single notification
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Notification deleted }
 */
router.delete("/:id", notificationIdValidator, validate, notificationController.deleteNotification);

module.exports = router;
