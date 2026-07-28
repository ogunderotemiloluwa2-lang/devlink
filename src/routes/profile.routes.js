const express = require("express");
const profileController = require("../controllers/profile.controller");
const skillController = require("../controllers/skill.controller");
const { protect, optionalAuth } = require("../middleware/auth.middleware");
const validate = require("../middleware/validate.middleware");
const { avatarUpload, coverUpload, resumeUpload } = require("../middleware/upload.middleware");
const {
  updateProfileValidator,
  updateUsernameValidator,
  usernameParamValidator,
  listProfilesValidator,
} = require("../validators/profile.validator");
const { sensitiveActionLimiter } = require("../middleware/rateLimiter.middleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Profiles
 *   description: Developer profile management, images, and directory search
 */

/**
 * @swagger
 * /profiles/me:
 *   get:
 *     summary: Get the authenticated user's own profile
 *     tags: [Profiles]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Profile fetched }
 *   patch:
 *     summary: Update the authenticated user's profile
 *     tags: [Profiles]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               headline: { type: string }
 *               company: { type: string }
 *               location: { type: string }
 *               country: { type: string }
 *               bio: { type: string }
 *               about: { type: string }
 *               openToWork: { type: boolean }
 *               openToCollab: { type: boolean }
 *               visibility: { type: string, enum: [public, private] }
 *               links:
 *                 type: object
 *                 properties:
 *                   github: { type: string }
 *                   website: { type: string }
 *                   portfolio: { type: string }
 *                   twitter: { type: string }
 *                   linkedin: { type: string }
 *     responses:
 *       200: { description: Profile updated }
 */
router.get("/me", protect, profileController.getMyProfile);
router.patch("/me", protect, updateProfileValidator, validate, profileController.updateMyProfile);

/**
 * @swagger
 * /profiles/username:
 *   patch:
 *     summary: Change the authenticated user's username
 *     tags: [Profiles]
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
 *       200: { description: Username updated }
 *       409: { description: Username already taken }
 */
router.patch("/username", protect, sensitiveActionLimiter, updateUsernameValidator, validate, profileController.updateUsername);

/**
 * @swagger
 * /profiles/username-check/{username}:
 *   get:
 *     summary: Check whether a username is available
 *     tags: [Profiles]
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Availability result }
 */
router.get("/username-check/:username", usernameParamValidator, validate, profileController.checkUsernameAvailability);

/**
 * @swagger
 * /profiles/me/avatar:
 *   post:
 *     summary: Upload/replace the authenticated user's avatar
 *     tags: [Profiles]
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
 *   delete:
 *     summary: Remove the authenticated user's avatar
 *     tags: [Profiles]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Avatar removed }
 */
router.post("/me/avatar", protect, avatarUpload, profileController.uploadAvatar);
router.delete("/me/avatar", protect, profileController.deleteAvatar);

/**
 * @swagger
 * /profiles/me/cover:
 *   post:
 *     summary: Upload/replace the authenticated user's cover image
 *     tags: [Profiles]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               cover: { type: string, format: binary }
 *     responses:
 *       200: { description: Cover image updated }
 *   delete:
 *     summary: Remove the authenticated user's cover image
 *     tags: [Profiles]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Cover image removed }
 */
router.post("/me/cover", protect, coverUpload, profileController.uploadCover);
router.delete("/me/cover", protect, profileController.deleteCover);

/**
 * @swagger
 * /profiles/me/resume:
 *   post:
 *     summary: Upload/replace the authenticated user's resume (PDF)
 *     tags: [Profiles]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               resume: { type: string, format: binary }
 *     responses:
 *       200: { description: Resume uploaded }
 *   delete:
 *     summary: Remove the authenticated user's resume
 *     tags: [Profiles]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Resume removed }
 */
router.post("/me/resume", protect, resumeUpload, profileController.uploadResume);
router.delete("/me/resume", protect, profileController.deleteResume);

/**
 * @swagger
 * /profiles:
 *   get:
 *     summary: Browse/search public developer profiles
 *     tags: [Profiles]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Search by name or username
 *       - in: query
 *         name: skill
 *         schema: { type: string }
 *       - in: query
 *         name: location
 *         schema: { type: string }
 *       - in: query
 *         name: openToWork
 *         schema: { type: boolean }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [popular, recent] }
 *     responses:
 *       200: { description: List of developer profiles }
 */
router.get("/", optionalAuth, listProfilesValidator, validate, profileController.listProfiles);

/**
 * @swagger
 * /profiles/{username}:
 *   get:
 *     summary: Get a public developer profile by username
 *     tags: [Profiles]
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Public profile }
 *       404: { description: Profile not found }
 */
router.get("/:username", optionalAuth, usernameParamValidator, validate, profileController.getPublicProfile);

/**
 * @swagger
 * /profiles/{username}/skills:
 *   get:
 *     summary: Get a user's public skills/tech stack
 *     tags: [Profiles]
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Skills fetched }
 */
router.get("/:username/skills", usernameParamValidator, validate, skillController.getUserSkills);

module.exports = router;
