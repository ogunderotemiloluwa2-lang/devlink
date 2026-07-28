const express = require("express");
const projectController = require("../controllers/project.controller");
const { protect, optionalAuth } = require("../middleware/auth.middleware");
const validate = require("../middleware/validate.middleware");
const { coverUpload, projectFileUpload } = require("../middleware/upload.middleware");
const {
  createProjectValidator,
  updateProjectValidator,
  slugParamValidator,
  inviteValidator,
  memberIdValidator,
  memberUsernameValidator,
  updateMemberRoleValidator,
  createTaskValidator,
  updateTaskValidator,
  taskIdValidator,
  discussionMessageValidator,
  messageIdValidator,
  listProjectsValidator,
} = require("../validators/project.validator");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Projects
 *   description: Collaboration hub — projects, invites, membership, tasks, discussion, files
 */

router.get("/", optionalAuth, listProjectsValidator, validate, projectController.listProjects);
router.post("/", protect, createProjectValidator, validate, projectController.createProject);

/**
 * @swagger
 * /projects/invites/mine:
 *   get:
 *     summary: Get the authenticated user's pending project invites
 *     tags: [Projects]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Invites fetched }
 */
router.get("/invites/mine", protect, projectController.getMyInvites);
router.post("/invites/:memberId/accept", protect, memberIdValidator, validate, projectController.acceptInvite);
router.post("/invites/:memberId/reject", protect, memberIdValidator, validate, projectController.rejectInvite);

/**
 * @swagger
 * /projects/{slug}:
 *   get:
 *     summary: Get a project by slug
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Project fetched }
 *       404: { description: Project not found }
 *   patch:
 *     summary: Edit a project (owner only)
 *     tags: [Projects]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Project updated }
 *   delete:
 *     summary: Delete a project (owner or platform admin)
 *     tags: [Projects]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Project deleted }
 */
router.get("/:slug", optionalAuth, slugParamValidator, validate, projectController.getProject);
router.patch("/:slug", protect, updateProjectValidator, validate, projectController.updateProject);
router.delete("/:slug", protect, slugParamValidator, validate, projectController.deleteProject);

router.post("/:slug/cover", protect, coverUpload, slugParamValidator, validate, projectController.uploadProjectCover);
router.delete("/:slug/cover", protect, slugParamValidator, validate, projectController.deleteProjectCover);
router.post("/:slug/star", protect, slugParamValidator, validate, projectController.toggleStarProject);

/**
 * @swagger
 * /projects/{slug}/invite:
 *   post:
 *     summary: Invite a user to join the project (owner only)
 *     tags: [Projects]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, role]
 *             properties:
 *               username: { type: string }
 *               role: { type: string, enum: [Frontend, Backend, Full Stack, UI Designer, DevOps, AI Engineer] }
 *     responses:
 *       201: { description: Invite sent }
 *       409: { description: Already a member or already invited }
 */
router.post("/:slug/invite", protect, inviteValidator, validate, projectController.inviteMember);
router.post("/:slug/leave", protect, slugParamValidator, validate, projectController.leaveProject);

router.get("/:slug/members", optionalAuth, slugParamValidator, validate, projectController.getProjectMembers);
router.delete(
  "/:slug/members/:username",
  protect,
  memberUsernameValidator,
  validate,
  projectController.removeMember
);
router.patch(
  "/:slug/members/:username/role",
  protect,
  updateMemberRoleValidator,
  validate,
  projectController.updateMemberRole
);

/**
 * @swagger
 * /projects/{slug}/tasks:
 *   get:
 *     summary: Get a project's tasks
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [todo, in-progress, done] }
 *       - in: query
 *         name: assignee
 *         schema: { type: string }
 *     responses:
 *       200: { description: Tasks fetched }
 *   post:
 *     summary: Create a task (members only)
 *     tags: [Projects]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               assignee: { type: string, description: "username" }
 *               dueDate: { type: string, format: date-time }
 *     responses:
 *       201: { description: Task created }
 */
router.get("/:slug/tasks", slugParamValidator, validate, projectController.getProjectTasks);
router.post("/:slug/tasks", protect, createTaskValidator, validate, projectController.createTask);

router.patch("/:slug/tasks/:taskId", protect, updateTaskValidator, validate, projectController.updateTask);
router.delete("/:slug/tasks/:taskId", protect, taskIdValidator, validate, projectController.deleteTask);

/**
 * @swagger
 * /projects/{slug}/discussion:
 *   get:
 *     summary: Get a project's discussion thread
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Discussion fetched }
 *   post:
 *     summary: Post a discussion message (members only)
 *     tags: [Projects]
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
 *       201: { description: Message posted }
 */
router.get("/:slug/discussion", slugParamValidator, validate, projectController.getProjectDiscussion);
router.post(
  "/:slug/discussion",
  protect,
  discussionMessageValidator,
  validate,
  projectController.postDiscussionMessage
);
router.patch(
  "/:slug/discussion/:messageId",
  protect,
  discussionMessageValidator,
  validate,
  projectController.updateDiscussionMessage
);
router.delete(
  "/:slug/discussion/:messageId",
  protect,
  messageIdValidator,
  validate,
  projectController.deleteDiscussionMessage
);

/**
 * @swagger
 * /projects/{slug}/files:
 *   get:
 *     summary: Get a project's files
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Files fetched }
 *   post:
 *     summary: Upload a file to the project (members only)
 *     tags: [Projects]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 *     responses:
 *       201: { description: File uploaded }
 */
router.get("/:slug/files", slugParamValidator, validate, projectController.getProjectFiles);
router.post(
  "/:slug/files",
  protect,
  projectFileUpload,
  slugParamValidator,
  validate,
  projectController.uploadProjectFile
);
router.delete("/:slug/files/:fileId", protect, slugParamValidator, validate, projectController.deleteProjectFile);

module.exports = router;
