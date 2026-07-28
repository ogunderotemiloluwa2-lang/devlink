const { body, param, query } = require("express-validator");
const Project = require("../models/Project.model");
const ProjectMember = require("../models/ProjectMember.model");
const ProjectTask = require("../models/ProjectTask.model");

const createProjectValidator = [
  body("name").trim().notEmpty().withMessage("Project name is required").isLength({ max: 100 }),
  body("tagline").optional().trim().isLength({ max: 150 }),
  body("description").optional().trim().isLength({ max: 3000 }),
  body("stack").optional().isArray({ max: 20 }),
  body("rolesNeeded").optional().isArray({ max: 6 }),
  body("rolesNeeded.*").optional().isIn(Project.ROLES).withMessage("Invalid role"),
  body("stage").optional().isIn(Project.STAGES),
  body("repoUrl").optional({ checkFalsy: true }).trim().isURL(),
  body("liveUrl").optional({ checkFalsy: true }).trim().isURL(),
  body("visibility").optional().isIn(["public", "private"]),
];

const updateProjectValidator = [
  param("slug").trim().notEmpty(),
  body("name").optional().trim().isLength({ min: 1, max: 100 }),
  body("tagline").optional().trim().isLength({ max: 150 }),
  body("description").optional().trim().isLength({ max: 3000 }),
  body("stack").optional().isArray({ max: 20 }),
  body("rolesNeeded").optional().isArray({ max: 6 }),
  body("rolesNeeded.*").optional().isIn(Project.ROLES).withMessage("Invalid role"),
  body("stage").optional().isIn(Project.STAGES),
  body("repoUrl").optional({ checkFalsy: true }).trim().isURL(),
  body("liveUrl").optional({ checkFalsy: true }).trim().isURL(),
  body("visibility").optional().isIn(["public", "private"]),
];

const slugParamValidator = [param("slug").trim().notEmpty().withMessage("Project slug is required")];

const inviteValidator = [
  param("slug").trim().notEmpty(),
  body("username").trim().notEmpty().withMessage("Username is required"),
  body("role").isIn(Project.ROLES).withMessage("Invalid role"),
];

const memberIdValidator = [param("memberId").isMongoId().withMessage("Invalid invite id")];

const memberUsernameValidator = [
  param("slug").trim().notEmpty(),
  param("username").trim().notEmpty().withMessage("Username is required"),
];

const updateMemberRoleValidator = [
  ...memberUsernameValidator,
  body("role").isIn(Project.ROLES).withMessage("Invalid role"),
];

const createTaskValidator = [
  param("slug").trim().notEmpty(),
  body("title").trim().notEmpty().withMessage("Task title is required").isLength({ max: 150 }),
  body("description").optional().trim().isLength({ max: 1000 }),
  body("assignee").optional({ checkFalsy: true }).trim(),
  body("dueDate").optional({ checkFalsy: true }).isISO8601().withMessage("Invalid due date"),
];

const updateTaskValidator = [
  param("slug").trim().notEmpty(),
  param("taskId").isMongoId().withMessage("Invalid task id"),
  body("title").optional().trim().isLength({ min: 1, max: 150 }),
  body("description").optional().trim().isLength({ max: 1000 }),
  body("status").optional().isIn(ProjectTask.STATUSES).withMessage("Invalid status"),
  body("assignee").optional({ checkFalsy: true }).trim(),
  body("dueDate").optional({ checkFalsy: true }).isISO8601(),
];

const taskIdValidator = [
  param("slug").trim().notEmpty(),
  param("taskId").isMongoId().withMessage("Invalid task id"),
];

const discussionMessageValidator = [
  param("slug").trim().notEmpty(),
  body("content").trim().notEmpty().withMessage("Message content is required").isLength({ max: 2000 }),
];

const messageIdValidator = [
  param("slug").trim().notEmpty(),
  param("messageId").isMongoId().withMessage("Invalid message id"),
];

const listProjectsValidator = [
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("role").optional().isIn(Project.ROLES),
];

module.exports = {
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
};
