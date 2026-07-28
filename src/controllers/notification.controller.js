const Notification = require("../models/Notification.model");
const Profile = require("../models/Profile.model");
const catchAsync = require("../utils/catchAsync");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const { getPagination, buildMeta } = require("../utils/pagination");

const USER_SELECT = "name username avatarUrl role";

/**
 * GET /notifications
 * Query: type, isRead, page, limit
 */
const getMyNotifications = catchAsync(async (req, res) => {
  const { type, isRead } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  const filter = { recipient: req.user._id };
  if (type) filter.type = type;
  if (isRead !== undefined) filter.isRead = isRead === "true";

  const [notifications, total] = await Promise.all([
    Notification.find(filter).populate("actor", USER_SELECT).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(filter),
  ]);

  return new ApiResponse(200, { notifications }, "Notifications fetched", buildMeta({ page, limit, total })).send(res);
});

/**
 * GET /notifications/unread-count
 */
const getUnreadCount = catchAsync(async (req, res) => {
  const unreadCount = await Notification.countDocuments({ recipient: req.user._id, isRead: false });
  return new ApiResponse(200, { unreadCount }, "Unread count fetched").send(res);
});

/**
 * PATCH /notifications/:id/read
 */
const markAsRead = catchAsync(async (req, res) => {
  const notification = await Notification.findOne({ _id: req.params.id, recipient: req.user._id });
  if (!notification) throw ApiError.notFound("Notification not found");

  if (!notification.isRead) {
    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();
  }

  return new ApiResponse(200, { notification }, "Marked as read").send(res);
});

/**
 * POST /notifications/read-all
 */
const markAllAsRead = catchAsync(async (req, res) => {
  const result = await Notification.updateMany(
    { recipient: req.user._id, isRead: false },
    { isRead: true, readAt: new Date() }
  );

  return new ApiResponse(200, { modifiedCount: result.modifiedCount }, "All notifications marked as read").send(res);
});

/**
 * DELETE /notifications/:id
 */
const deleteNotification = catchAsync(async (req, res) => {
  const notification = await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user._id });
  if (!notification) throw ApiError.notFound("Notification not found");

  return new ApiResponse(200, null, "Notification deleted").send(res);
});

/**
 * DELETE /notifications
 * Query: readOnly=true clears only read notifications; otherwise clears all.
 */
const clearNotifications = catchAsync(async (req, res) => {
  const filter = { recipient: req.user._id };
  if (req.query.readOnly === "true") filter.isRead = true;

  const result = await Notification.deleteMany(filter);
  return new ApiResponse(200, { deletedCount: result.deletedCount }, "Notifications cleared").send(res);
});

/**
 * GET /notifications/preferences
 */
const getPreferences = catchAsync(async (req, res) => {
  const profile = await Profile.findOne({ user: req.user._id }).select("notificationPreferences");
  return new ApiResponse(200, { preferences: profile?.notificationPreferences || {} }, "Preferences fetched").send(res);
});

/**
 * PATCH /notifications/preferences
 */
const updatePreferences = catchAsync(async (req, res) => {
  const allowedKeys = [
    "follow",
    "like",
    "comment",
    "reply",
    "mention",
    "projectInvite",
    "communityInvite",
    "message",
    "emailDigest",
  ];

  const update = {};
  allowedKeys.forEach((key) => {
    if (req.body[key] !== undefined) update[`notificationPreferences.${key}`] = !!req.body[key];
  });

  const profile = await Profile.findOneAndUpdate(
    { user: req.user._id },
    { $set: update },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).select("notificationPreferences");

  return new ApiResponse(200, { preferences: profile.notificationPreferences }, "Preferences updated").send(res);
});

module.exports = {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearNotifications,
  getPreferences,
  updatePreferences,
};
