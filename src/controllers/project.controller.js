const Project = require("../models/Project.model");
const ProjectMember = require("../models/ProjectMember.model");
const ProjectTask = require("../models/ProjectTask.model");
const ProjectFile = require("../models/ProjectFile.model");
const ProjectDiscussionMessage = require("../models/ProjectDiscussionMessage.model");
const Post = require("../models/Post.model");
const User = require("../models/User.model");
const catchAsync = require("../utils/catchAsync");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const slugify = require("../utils/slugify");
const { getPagination, buildMeta } = require("../utils/pagination");
const { getAcceptedMembership, isOwner, getMembershipRoleMap } = require("../services/project.service");
const { toggleLike } = require("../services/like.service");
const { createNotification } = require("../services/notification.service");
const { uploadImage, uploadProjectFile: uploadFileToCloudinary, deleteAsset } = require("../services/cloudinary.service");

const USER_SELECT = "name username avatarUrl role";

async function resolveProject(slug) {
  const project = await Project.findOne({ slug: slug.trim().toLowerCase(), status: "active" });
  if (!project) throw ApiError.notFound("Project not found");
  return project;
}

async function generateUniqueSlug(name) {
  const base = slugify(name) || "project";
  let slug = base;
  let suffix = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await Project.findOne({ slug })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

async function resolveMemberUser(username) {
  const user = await User.findOne({ username: username.trim().toLowerCase(), status: "active" });
  if (!user) throw ApiError.notFound("User not found");
  return user;
}

// =========================== Project CRUD ===========================

/**
 * POST /projects (authenticated)
 */
const createProject = catchAsync(async (req, res) => {
  const { name, tagline, description, stack, rolesNeeded, stage, repoUrl, liveUrl, visibility } = req.body;

  const slug = await generateUniqueSlug(name);

  const project = await Project.create({
    name: name.trim(),
    slug,
    tagline: tagline?.trim() || "",
    description: description?.trim() || "",
    owner: req.user._id,
    stack: Array.isArray(stack) ? stack.map((s) => s.trim()).filter(Boolean) : [],
    rolesNeeded: Array.isArray(rolesNeeded) ? rolesNeeded : [],
    stage: stage || "Idea",
    repoUrl: repoUrl || "",
    liveUrl: liveUrl || "",
    visibility: visibility === "private" ? "private" : "public",
  });

  await ProjectMember.create({
    project: project._id,
    user: req.user._id,
    role: "Owner",
    status: "accepted",
    respondedAt: new Date(),
  });

  return new ApiResponse(201, { project }, "Project created").send(res);
});

/**
 * GET /projects — search/filter/paginate
 * Query: q, role, stack, stage, sort, page, limit
 */
const listProjects = catchAsync(async (req, res) => {
  const { q, role, stack, stage, sort } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  const filter = { status: "active", visibility: "public" };
  if (role) filter.rolesNeeded = role;
  if (stack) filter.stack = new RegExp(stack.trim(), "i");
  if (stage) filter.stage = stage;
  if (q) {
    const regex = new RegExp(q.trim(), "i");
    filter.$or = [{ name: regex }, { tagline: regex }, { description: regex }];
  }

  const sortOption = sort === "recent" ? { createdAt: -1 } : { starsCount: -1, createdAt: -1 };

  const [projects, total] = await Promise.all([
    Project.find(filter).populate("owner", USER_SELECT).sort(sortOption).skip(skip).limit(limit),
    Project.countDocuments(filter),
  ]);

  let shaped = projects;
  if (req.user) {
    const roleMap = await getMembershipRoleMap(req.user._id, projects.map((p) => p._id));
    shaped = projects.map((p) => {
      const obj = p.toObject();
      obj.viewerRole = roleMap.get(p._id.toString()) || null;
      obj.isMember = roleMap.has(p._id.toString());
      return obj;
    });
  }

  return new ApiResponse(200, { projects: shaped }, "Projects fetched", buildMeta({ page, limit, total })).send(res);
});

/**
 * GET /projects/:slug
 */
const getProject = catchAsync(async (req, res) => {
  const project = await resolveProject(req.params.slug);
  await project.populate("owner", USER_SELECT);

  const membership = await getAcceptedMembership(project._id, req.user?._id);

  const payload = project.toObject();
  payload.viewerRole = membership?.role || null;
  payload.isMember = !!membership;

  return new ApiResponse(200, { project: payload }, "Project fetched").send(res);
});

/**
 * PATCH /projects/:slug (owner only)
 */
const updateProject = catchAsync(async (req, res) => {
  const project = await resolveProject(req.params.slug);
  if (!project.owner.equals(req.user._id)) throw ApiError.forbidden("Only the project owner can edit this project");

  const { name, tagline, description, stack, rolesNeeded, stage, repoUrl, liveUrl, visibility } = req.body;
  if (name !== undefined) project.name = name.trim();
  if (tagline !== undefined) project.tagline = tagline.trim();
  if (description !== undefined) project.description = description.trim();
  if (stack !== undefined) project.stack = stack.map((s) => s.trim()).filter(Boolean);
  if (rolesNeeded !== undefined) project.rolesNeeded = rolesNeeded;
  if (stage !== undefined) project.stage = stage;
  if (repoUrl !== undefined) project.repoUrl = repoUrl;
  if (liveUrl !== undefined) project.liveUrl = liveUrl;
  if (visibility !== undefined) project.visibility = visibility;

  await project.save();
  return new ApiResponse(200, { project }, "Project updated").send(res);
});

/**
 * DELETE /projects/:slug (owner or platform admin)
 */
const deleteProject = catchAsync(async (req, res) => {
  const project = await resolveProject(req.params.slug);
  const isPlatformAdmin = req.user.role === "admin";
  if (!project.owner.equals(req.user._id) && !isPlatformAdmin) {
    throw ApiError.forbidden("Only the project owner can delete this project");
  }

  const files = await ProjectFile.find({ project: project._id }).select("+publicId");
  await Promise.all(files.map((f) => deleteAsset(f.publicId, f.mimeType?.startsWith("image/") ? "image" : "raw")));
  if (project.coverImagePublicId) await deleteAsset(project.coverImagePublicId);

  await Promise.all([
    ProjectMember.deleteMany({ project: project._id }),
    ProjectTask.deleteMany({ project: project._id }),
    ProjectFile.deleteMany({ project: project._id }),
    ProjectDiscussionMessage.deleteMany({ project: project._id }),
    Post.updateMany({ project: project._id }, { $set: { project: null } }),
  ]);

  await project.deleteOne();

  return new ApiResponse(200, null, "Project deleted").send(res);
});

/**
 * POST /projects/:slug/cover (owner only, multipart "cover")
 */
const uploadProjectCover = catchAsync(async (req, res) => {
  if (!req.file) throw ApiError.badRequest("No image file provided");
  const project = await resolveProject(req.params.slug);
  if (!project.owner.equals(req.user._id)) throw ApiError.forbidden("Only the project owner can update the cover image");

  const { url, publicId } = await uploadImage(req.file.buffer, "project-covers", `project_${project._id}`);
  const oldPublicId = project.coverImagePublicId;
  project.coverImageUrl = url;
  project.coverImagePublicId = publicId;
  await project.save();
  if (oldPublicId && oldPublicId !== publicId) await deleteAsset(oldPublicId);

  return new ApiResponse(200, { coverImageUrl: url }, "Cover image updated").send(res);
});

/**
 * DELETE /projects/:slug/cover (owner only)
 */
const deleteProjectCover = catchAsync(async (req, res) => {
  const project = await resolveProject(req.params.slug);
  if (!project.owner.equals(req.user._id)) throw ApiError.forbidden("Only the project owner can remove the cover image");

  const fresh = await Project.findById(project._id).select("+coverImagePublicId");
  if (fresh.coverImagePublicId) await deleteAsset(fresh.coverImagePublicId);
  fresh.coverImageUrl = null;
  fresh.coverImagePublicId = null;
  await fresh.save();

  return new ApiResponse(200, null, "Cover image removed").send(res);
});

/**
 * POST /projects/:slug/star (toggle)
 */
const toggleStarProject = catchAsync(async (req, res) => {
  const project = await resolveProject(req.params.slug);
  const result = await toggleLike({
    userId: req.user._id,
    targetType: "Project",
    targetId: project._id,
    TargetModel: Project,
    countField: "starsCount",
  });
  return new ApiResponse(200, result, result.liked ? "Project starred" : "Project unstarred").send(res);
});

// =========================== Membership & Invites ===========================

/**
 * POST /projects/:slug/invite (owner only)
 */
const inviteMember = catchAsync(async (req, res) => {
  const project = await resolveProject(req.params.slug);
  if (!project.owner.equals(req.user._id)) throw ApiError.forbidden("Only the project owner can invite members");

  const { username, role } = req.body;
  const targetUser = await resolveMemberUser(username);

  if (targetUser._id.equals(req.user._id)) throw ApiError.badRequest("You are already the owner of this project");

  const existing = await ProjectMember.findOne({ project: project._id, user: targetUser._id });
  if (existing) {
    if (existing.status === "accepted") throw ApiError.conflict("This user is already a member");
    if (existing.status === "pending") throw ApiError.conflict("This user already has a pending invite");
    // Previously left/rejected/removed — re-invite by resetting the record.
    existing.role = role;
    existing.status = "pending";
    existing.invitedBy = req.user._id;
    existing.respondedAt = null;
    await existing.save();

    await createNotification(req.app.get("io"), {
      recipient: targetUser._id,
      actor: req.user._id,
      type: "project_invite",
      text: `invited you to collaborate on ${project.name} as ${role}`,
      entityType: "Project",
      entityId: project._id,
    });

    return new ApiResponse(200, { invite: existing }, `Invited @${targetUser.username}`).send(res);
  }

  const invite = await ProjectMember.create({
    project: project._id,
    user: targetUser._id,
    role,
    status: "pending",
    invitedBy: req.user._id,
  });

  await createNotification(req.app.get("io"), {
    recipient: targetUser._id,
    actor: req.user._id,
    type: "project_invite",
    text: `invited you to collaborate on ${project.name} as ${role}`,
    entityType: "Project",
    entityId: project._id,
  });

  return new ApiResponse(201, { invite }, `Invited @${targetUser.username}`).send(res);
});

/**
 * GET /projects/invites/mine (authenticated)
 */
const getMyInvites = catchAsync(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { user: req.user._id, status: "pending" };

  const [invites, total] = await Promise.all([
    ProjectMember.find(filter)
      .populate({ path: "project", select: "name slug tagline coverImageUrl owner", populate: { path: "owner", select: USER_SELECT } })
      .populate("invitedBy", USER_SELECT)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    ProjectMember.countDocuments(filter),
  ]);

  return new ApiResponse(200, { invites }, "Invites fetched", buildMeta({ page, limit, total })).send(res);
});

/**
 * POST /projects/invites/:memberId/accept (invitee only)
 */
const acceptInvite = catchAsync(async (req, res) => {
  const invite = await ProjectMember.findById(req.params.memberId);
  if (!invite || invite.status !== "pending") throw ApiError.notFound("Invite not found");
  if (!invite.user.equals(req.user._id)) throw ApiError.forbidden("This invite is not addressed to you");

  invite.status = "accepted";
  invite.respondedAt = new Date();
  await invite.save();

  await Project.findByIdAndUpdate(invite.project, { $inc: { membersCount: 1 } });

  return new ApiResponse(200, { invite }, "Invite accepted").send(res);
});

/**
 * POST /projects/invites/:memberId/reject (invitee only)
 */
const rejectInvite = catchAsync(async (req, res) => {
  const invite = await ProjectMember.findById(req.params.memberId);
  if (!invite || invite.status !== "pending") throw ApiError.notFound("Invite not found");
  if (!invite.user.equals(req.user._id)) throw ApiError.forbidden("This invite is not addressed to you");

  invite.status = "rejected";
  invite.respondedAt = new Date();
  await invite.save();

  return new ApiResponse(200, { invite }, "Invite declined").send(res);
});

/**
 * POST /projects/:slug/leave (member only, not the owner)
 */
const leaveProject = catchAsync(async (req, res) => {
  const project = await resolveProject(req.params.slug);
  if (project.owner.equals(req.user._id)) {
    throw ApiError.badRequest("The owner cannot leave their own project — delete it instead");
  }

  const membership = await ProjectMember.findOne({ project: project._id, user: req.user._id, status: "accepted" });
  if (!membership) throw ApiError.notFound("You are not a member of this project");

  membership.status = "left";
  membership.respondedAt = new Date();
  await membership.save();

  project.membersCount = Math.max(project.membersCount - 1, 0);
  await project.save();

  return new ApiResponse(200, null, `You left ${project.name}`).send(res);
});

/**
 * DELETE /projects/:slug/members/:username (owner only)
 */
const removeMember = catchAsync(async (req, res) => {
  const project = await resolveProject(req.params.slug);
  if (!project.owner.equals(req.user._id)) throw ApiError.forbidden("Only the project owner can remove members");

  const targetUser = await resolveMemberUser(req.params.username);
  if (targetUser._id.equals(project.owner)) throw ApiError.badRequest("The owner cannot be removed");

  const membership = await ProjectMember.findOne({ project: project._id, user: targetUser._id, status: "accepted" });
  if (!membership) throw ApiError.notFound("This user is not a member of the project");

  membership.status = "removed";
  membership.respondedAt = new Date();
  await membership.save();

  project.membersCount = Math.max(project.membersCount - 1, 0);
  await project.save();

  return new ApiResponse(200, null, "Member removed").send(res);
});

/**
 * GET /projects/:slug/members
 * Query: status (default "accepted"), page, limit — only the owner can view non-accepted statuses.
 */
const getProjectMembers = catchAsync(async (req, res) => {
  const project = await resolveProject(req.params.slug);
  const { page, limit, skip } = getPagination(req.query);

  const isOwnerViewing = req.user && project.owner.equals(req.user._id);
  const requestedStatus = req.query.status;
  const status = isOwnerViewing && requestedStatus ? requestedStatus : "accepted";

  const filter = { project: project._id, status };
  const [members, total] = await Promise.all([
    ProjectMember.find(filter).populate("user", USER_SELECT).sort({ createdAt: 1 }).skip(skip).limit(limit),
    ProjectMember.countDocuments(filter),
  ]);

  return new ApiResponse(200, { members }, "Members fetched", buildMeta({ page, limit, total })).send(res);
});

/**
 * PATCH /projects/:slug/members/:username/role (owner only)
 */
const updateMemberRole = catchAsync(async (req, res) => {
  const project = await resolveProject(req.params.slug);
  if (!project.owner.equals(req.user._id)) throw ApiError.forbidden("Only the project owner can change member roles");

  const targetUser = await resolveMemberUser(req.params.username);
  const membership = await ProjectMember.findOne({ project: project._id, user: targetUser._id, status: "accepted" });
  if (!membership) throw ApiError.notFound("This user is not a member of the project");

  membership.role = req.body.role;
  await membership.save();
  await membership.populate("user", USER_SELECT);

  return new ApiResponse(200, { member: membership }, "Member role updated").send(res);
});

// =========================== Tasks ===========================

/**
 * GET /projects/:slug/tasks
 * Query: status, assignee (username), page, limit
 */
const getProjectTasks = catchAsync(async (req, res) => {
  const project = await resolveProject(req.params.slug);
  const { page, limit, skip } = getPagination(req.query);

  const filter = { project: project._id };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.assignee) {
    const assigneeUser = await resolveMemberUser(req.query.assignee);
    filter.assignee = assigneeUser._id;
  }

  const [tasks, total] = await Promise.all([
    ProjectTask.find(filter)
      .populate("assignee", USER_SELECT)
      .populate("createdBy", USER_SELECT)
      .sort({ order: 1, createdAt: 1 })
      .skip(skip)
      .limit(limit),
    ProjectTask.countDocuments(filter),
  ]);

  return new ApiResponse(200, { tasks }, "Tasks fetched", buildMeta({ page, limit, total })).send(res);
});

/**
 * POST /projects/:slug/tasks (accepted members only)
 */
const createTask = catchAsync(async (req, res) => {
  const project = await resolveProject(req.params.slug);
  const membership = await getAcceptedMembership(project._id, req.user._id);
  if (!membership) throw ApiError.forbidden("Only project members can create tasks");

  const { title, description, assignee, dueDate } = req.body;

  let assigneeId = null;
  if (assignee) {
    const assigneeUser = await resolveMemberUser(assignee);
    const assigneeMembership = await getAcceptedMembership(project._id, assigneeUser._id);
    if (!assigneeMembership) throw ApiError.badRequest("Assignee must be a member of this project");
    assigneeId = assigneeUser._id;
  }

  const task = await ProjectTask.create({
    project: project._id,
    title: title.trim(),
    description: description?.trim() || "",
    assignee: assigneeId,
    createdBy: req.user._id,
    dueDate: dueDate || null,
  });

  project.tasksCount += 1;
  project.openTasksCount += 1;
  await project.save();

  await task.populate("assignee", USER_SELECT);
  await task.populate("createdBy", USER_SELECT);

  return new ApiResponse(201, { task }, "Task created").send(res);
});

/**
 * PATCH /projects/:slug/tasks/:taskId (owner, task creator, or assignee)
 */
const updateTask = catchAsync(async (req, res) => {
  const project = await resolveProject(req.params.slug);
  const task = await ProjectTask.findOne({ _id: req.params.taskId, project: project._id });
  if (!task) throw ApiError.notFound("Task not found");

  const isProjectOwner = project.owner.equals(req.user._id);
  const isTaskCreator = task.createdBy.equals(req.user._id);
  const isAssignee = task.assignee && task.assignee.equals(req.user._id);
  if (!isProjectOwner && !isTaskCreator && !isAssignee) {
    throw ApiError.forbidden("Only the project owner, task creator, or assignee can update this task");
  }

  const { title, description, status, assignee, dueDate, order } = req.body;
  const wasOpen = task.status !== "done";

  if (title !== undefined) task.title = title.trim();
  if (description !== undefined) task.description = description.trim();
  if (dueDate !== undefined) task.dueDate = dueDate || null;
  if (order !== undefined) task.order = order;

  if (assignee !== undefined) {
    if (!assignee) {
      task.assignee = null;
    } else {
      const assigneeUser = await resolveMemberUser(assignee);
      const assigneeMembership = await getAcceptedMembership(project._id, assigneeUser._id);
      if (!assigneeMembership) throw ApiError.badRequest("Assignee must be a member of this project");
      task.assignee = assigneeUser._id;
    }
  }

  if (status !== undefined) task.status = status;

  await task.save();

  const isOpenNow = task.status !== "done";
  if (wasOpen && !isOpenNow) await Project.findByIdAndUpdate(project._id, { $inc: { openTasksCount: -1 } });
  if (!wasOpen && isOpenNow) await Project.findByIdAndUpdate(project._id, { $inc: { openTasksCount: 1 } });

  await task.populate("assignee", USER_SELECT);
  await task.populate("createdBy", USER_SELECT);

  return new ApiResponse(200, { task }, "Task updated").send(res);
});

/**
 * DELETE /projects/:slug/tasks/:taskId (owner or task creator)
 */
const deleteTask = catchAsync(async (req, res) => {
  const project = await resolveProject(req.params.slug);
  const task = await ProjectTask.findOne({ _id: req.params.taskId, project: project._id });
  if (!task) throw ApiError.notFound("Task not found");

  const isProjectOwner = project.owner.equals(req.user._id);
  const isTaskCreator = task.createdBy.equals(req.user._id);
  if (!isProjectOwner && !isTaskCreator) {
    throw ApiError.forbidden("Only the project owner or task creator can delete this task");
  }

  const wasOpen = task.status !== "done";
  await task.deleteOne();

  const decrement = { tasksCount: -1 };
  if (wasOpen) decrement.openTasksCount = -1;
  await Project.findByIdAndUpdate(project._id, { $inc: decrement });

  return new ApiResponse(200, null, "Task deleted").send(res);
});

// =========================== Discussion ===========================

/**
 * GET /projects/:slug/discussion
 */
const getProjectDiscussion = catchAsync(async (req, res) => {
  const project = await resolveProject(req.params.slug);
  const { page, limit, skip } = getPagination(req.query);

  const filter = { project: project._id };
  const [messages, total] = await Promise.all([
    ProjectDiscussionMessage.find(filter)
      .populate("author", USER_SELECT)
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit),
    ProjectDiscussionMessage.countDocuments(filter),
  ]);

  return new ApiResponse(200, { messages }, "Discussion fetched", buildMeta({ page, limit, total })).send(res);
});

/**
 * POST /projects/:slug/discussion (accepted members only)
 */
const postDiscussionMessage = catchAsync(async (req, res) => {
  const project = await resolveProject(req.params.slug);
  const membership = await getAcceptedMembership(project._id, req.user._id);
  if (!membership) throw ApiError.forbidden("Only project members can post in the discussion");

  const message = await ProjectDiscussionMessage.create({
    project: project._id,
    author: req.user._id,
    content: req.body.content.trim(),
  });
  await message.populate("author", USER_SELECT);

  return new ApiResponse(201, { message }, "Message posted").send(res);
});

/**
 * PATCH /projects/:slug/discussion/:messageId (author only)
 */
const updateDiscussionMessage = catchAsync(async (req, res) => {
  const message = await ProjectDiscussionMessage.findOne({
    _id: req.params.messageId,
    project: (await resolveProject(req.params.slug))._id,
  });
  if (!message) throw ApiError.notFound("Message not found");
  if (!message.author.equals(req.user._id)) throw ApiError.forbidden("You can only edit your own messages");

  message.content = req.body.content.trim();
  message.isEdited = true;
  message.editedAt = new Date();
  await message.save();
  await message.populate("author", USER_SELECT);

  return new ApiResponse(200, { message }, "Message updated").send(res);
});

/**
 * DELETE /projects/:slug/discussion/:messageId (author or project owner)
 */
const deleteDiscussionMessage = catchAsync(async (req, res) => {
  const project = await resolveProject(req.params.slug);
  const message = await ProjectDiscussionMessage.findOne({ _id: req.params.messageId, project: project._id });
  if (!message) throw ApiError.notFound("Message not found");

  const isAuthor = message.author.equals(req.user._id);
  const isProjectOwner = project.owner.equals(req.user._id);
  if (!isAuthor && !isProjectOwner) throw ApiError.forbidden("You do not have permission to delete this message");

  await message.deleteOne();
  return new ApiResponse(200, null, "Message deleted").send(res);
});

// =========================== Files ===========================

/**
 * GET /projects/:slug/files
 */
const getProjectFiles = catchAsync(async (req, res) => {
  const project = await resolveProject(req.params.slug);
  const files = await ProjectFile.find({ project: project._id })
    .populate("uploadedBy", USER_SELECT)
    .sort({ createdAt: -1 });
  return new ApiResponse(200, { files }, "Files fetched").send(res);
});

/**
 * POST /projects/:slug/files (accepted members only, multipart "file")
 */
const uploadProjectFile = catchAsync(async (req, res) => {
  if (!req.file) throw ApiError.badRequest("No file provided");
  const project = await resolveProject(req.params.slug);
  const membership = await getAcceptedMembership(project._id, req.user._id);
  if (!membership) throw ApiError.forbidden("Only project members can upload files");

  const { url, publicId } = await uploadFileToCloudinary(
    req.file.buffer,
    req.file.mimetype,
    "project-files",
    `project_${project._id}_${Date.now()}`
  );

  const file = await ProjectFile.create({
    project: project._id,
    uploadedBy: req.user._id,
    name: req.file.originalname,
    url,
    publicId,
    mimeType: req.file.mimetype,
    size: req.file.size,
  });
  await file.populate("uploadedBy", USER_SELECT);

  return new ApiResponse(201, { file }, "File uploaded").send(res);
});

/**
 * DELETE /projects/:slug/files/:fileId (uploader or project owner)
 */
const deleteProjectFile = catchAsync(async (req, res) => {
  const project = await resolveProject(req.params.slug);
  const file = await ProjectFile.findOne({ _id: req.params.fileId, project: project._id }).select("+publicId");
  if (!file) throw ApiError.notFound("File not found");

  const isUploader = file.uploadedBy.equals(req.user._id);
  const isProjectOwner = project.owner.equals(req.user._id);
  if (!isUploader && !isProjectOwner) throw ApiError.forbidden("You do not have permission to delete this file");

  await deleteAsset(file.publicId, file.mimeType?.startsWith("image/") ? "image" : "raw");
  await file.deleteOne();

  return new ApiResponse(200, null, "File deleted").send(res);
});

module.exports = {
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
  uploadProjectCover,
  deleteProjectCover,
  toggleStarProject,
  inviteMember,
  getMyInvites,
  acceptInvite,
  rejectInvite,
  leaveProject,
  removeMember,
  getProjectMembers,
  updateMemberRole,
  getProjectTasks,
  createTask,
  updateTask,
  deleteTask,
  getProjectDiscussion,
  postDiscussionMessage,
  updateDiscussionMessage,
  deleteDiscussionMessage,
  getProjectFiles,
  uploadProjectFile,
  deleteProjectFile,
};
