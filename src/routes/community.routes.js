const express = require("express");
const communityController = require("../controllers/community.controller");
const { protect, optionalAuth } = require("../middleware/auth.middleware");
const validate = require("../middleware/validate.middleware");
const { avatarUpload, bannerUpload } = require("../middleware/upload.middleware");
const {
  createCommunityValidator,
  updateCommunityValidator,
  slugParamValidator,
  memberUsernameValidator,
  inviteValidator,
  updateRoleValidator,
  createCommunityPostValidator,
  listCommunitiesValidator,
} = require("../validators/community.validator");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Communities
 *   description: Community creation, membership, roles, and community-scoped posts
 */

/**
 * @swagger
 * /communities:
 *   get:
 *     summary: Search/browse communities
 *     tags: [Communities]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: topic
 *         schema: { type: string }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [popular, recent] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Communities fetched }
 *   post:
 *     summary: Create a community (creator becomes its first admin)
 *     tags: [Communities]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               topics: { type: array, items: { type: string } }
 *               rules: { type: array, items: { type: string } }
 *               visibility: { type: string, enum: [public, private] }
 *     responses:
 *       201: { description: Community created }
 */
router.get("/", optionalAuth, listCommunitiesValidator, validate, communityController.listCommunities);
router.post("/", protect, createCommunityValidator, validate, communityController.createCommunity);

/**
 * @swagger
 * /communities/invites/mine:
 *   get:
 *     summary: Get the authenticated user's pending community invites
 *     tags: [Communities]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Invites fetched }
 */
router.get("/invites/mine", protect, communityController.getMyCommunityInvites);

/**
 * @swagger
 * /communities/{slug}:
 *   get:
 *     summary: Get a community by slug
 *     tags: [Communities]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Community fetched }
 *       404: { description: Community not found }
 *   patch:
 *     summary: Edit a community (admin only)
 *     tags: [Communities]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Community updated }
 *   delete:
 *     summary: Delete a community (admin or platform admin)
 *     tags: [Communities]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Community deleted }
 */
router.get("/:slug", optionalAuth, slugParamValidator, validate, communityController.getCommunity);
router.patch("/:slug", protect, updateCommunityValidator, validate, communityController.updateCommunity);
router.delete("/:slug", protect, slugParamValidator, validate, communityController.deleteCommunity);

/**
 * @swagger
 * /communities/{slug}/avatar:
 *   post:
 *     summary: Upload a community's avatar (admin only)
 *     tags: [Communities]
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
router.post("/:slug/avatar", protect, avatarUpload, slugParamValidator, validate, communityController.uploadCommunityAvatar);
router.delete("/:slug/avatar", protect, slugParamValidator, validate, communityController.deleteCommunityAvatar);

/**
 * @swagger
 * /communities/{slug}/banner:
 *   post:
 *     summary: Upload a community's banner (admin only)
 *     tags: [Communities]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               banner: { type: string, format: binary }
 *     responses:
 *       200: { description: Banner updated }
 */
router.post("/:slug/banner", protect, bannerUpload, slugParamValidator, validate, communityController.uploadCommunityBanner);
router.delete("/:slug/banner", protect, slugParamValidator, validate, communityController.deleteCommunityBanner);

/**
 * @swagger
 * /communities/{slug}/invite:
 *   post:
 *     summary: Invite a user to join the community (admin/moderator only)
 *     tags: [Communities]
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
 *       201: { description: Invite sent }
 */
router.post("/:slug/invite", protect, inviteValidator, validate, communityController.inviteToCommunity);

/**
 * @swagger
 * /communities/{slug}/join:
 *   post:
 *     summary: Join a community
 *     tags: [Communities]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Joined }
 *       403: { description: Community is private }
 */
router.post("/:slug/join", protect, slugParamValidator, validate, communityController.joinCommunity);

/**
 * @swagger
 * /communities/{slug}/leave:
 *   post:
 *     summary: Leave a community
 *     tags: [Communities]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Left the community }
 */
router.post("/:slug/leave", protect, slugParamValidator, validate, communityController.leaveCommunity);

/**
 * @swagger
 * /communities/{slug}/members:
 *   get:
 *     summary: List a community's members
 *     tags: [Communities]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [admin, moderator, member] }
 *     responses:
 *       200: { description: Members fetched }
 */
router.get("/:slug/members", slugParamValidator, validate, communityController.getCommunityMembers);

/**
 * @swagger
 * /communities/{slug}/members/{username}/role:
 *   patch:
 *     summary: Change a member's role (admin only)
 *     tags: [Communities]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role: { type: string, enum: [admin, moderator, member] }
 *     responses:
 *       200: { description: Role updated }
 */
router.patch(
  "/:slug/members/:username/role",
  protect,
  updateRoleValidator,
  validate,
  communityController.updateMemberRole
);

/**
 * @swagger
 * /communities/{slug}/members/{username}:
 *   delete:
 *     summary: Remove a member (admin/moderator — moderators can only remove regular members)
 *     tags: [Communities]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Member removed }
 */
router.delete(
  "/:slug/members/:username",
  protect,
  memberUsernameValidator,
  validate,
  communityController.removeMember
);

/**
 * @swagger
 * /communities/{slug}/posts:
 *   get:
 *     summary: Get a community's posts (pinned first)
 *     tags: [Communities]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Community posts fetched }
 *   post:
 *     summary: Post in a community (members only; moderators/admins can post announcements)
 *     tags: [Communities]
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
 *               isAnnouncement: { type: boolean }
 *     responses:
 *       201: { description: Post created }
 *       403: { description: Not a member of this community }
 */
router.get("/:slug/posts", slugParamValidator, validate, communityController.getCommunityPosts);
router.post(
  "/:slug/posts",
  protect,
  createCommunityPostValidator,
  validate,
  communityController.createCommunityPost
);

/**
 * @swagger
 * /communities/{slug}/posts/{postId}/pin:
 *   post:
 *     summary: Toggle pin on a community post (admin/moderator only)
 *     tags: [Communities]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Pin toggled }
 */
router.post("/:slug/posts/:postId/pin", protect, slugParamValidator, validate, communityController.togglePinPost);

module.exports = router;
