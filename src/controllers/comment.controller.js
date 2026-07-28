const Comment = require("../models/Comment.model");
const Post = require("../models/Post.model");
const Like = require("../models/Like.model");
const catchAsync = require("../utils/catchAsync");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const { getPagination, buildMeta } = require("../utils/pagination");
const { extractMentions } = require("../utils/textParsing");
const { toggleLike, getLikers } = require("../services/like.service");
const { createNotification } = require("../services/notification.service");

const AUTHOR_SELECT = "name username avatarUrl role";

async function attachViewerFlags(comments, viewerId) {
  if (!viewerId || comments.length === 0) return comments;
  const ids = comments.map((c) => c._id);
  const liked = await Like.find({ user: viewerId, targetType: "Comment", targetId: { $in: ids } }).select("targetId");
  const likedSet = new Set(liked.map((l) => l.targetId.toString()));

  return comments.map((c) => {
    const obj = c.toObject ? c.toObject() : c;
    obj.isLiked = likedSet.has(c._id.toString());
    return obj;
  });
}

/**
 * GET /posts/:postId/comments — top-level comments only, paginated
 */
const getPostComments = catchAsync(async (req, res) => {
  const { postId } = req.params;
  const { page, limit, skip } = getPagination(req.query);

  const filter = { post: postId, parentComment: null, status: "active" };
  const [comments, total] = await Promise.all([
    Comment.find(filter).populate("author", AUTHOR_SELECT).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Comment.countDocuments(filter),
  ]);

  const shaped = await attachViewerFlags(comments, req.user?._id);
  return new ApiResponse(200, { comments: shaped }, "Comments fetched", buildMeta({ page, limit, total })).send(res);
});

/**
 * GET /comments/:id/replies
 */
const getCommentReplies = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { page, limit, skip } = getPagination(req.query);

  const filter = { parentComment: id, status: "active" };
  const [replies, total] = await Promise.all([
    Comment.find(filter).populate("author", AUTHOR_SELECT).sort({ createdAt: 1 }).skip(skip).limit(limit),
    Comment.countDocuments(filter),
  ]);

  const shaped = await attachViewerFlags(replies, req.user?._id);
  return new ApiResponse(200, { replies: shaped }, "Replies fetched", buildMeta({ page, limit, total })).send(res);
});

/**
 * POST /posts/:postId/comments
 */
const createComment = catchAsync(async (req, res) => {
  const { postId } = req.params;
  const { content, parentComment } = req.body;

  const post = await Post.findById(postId);
  if (!post || post.status !== "active") throw ApiError.notFound("Post not found");

  let parent = null;
  if (parentComment) {
    parent = await Comment.findById(parentComment);
    if (!parent || parent.post.toString() !== postId) throw ApiError.notFound("Parent comment not found");
    if (parent.parentComment) throw ApiError.badRequest("Replies can only be one level deep");
  }

  const mentions = await extractMentions(content);

  const comment = await Comment.create({
    post: postId,
    author: req.user._id,
    content: content.trim(),
    parentComment: parentComment || null,
    mentions,
  });

  await Post.findByIdAndUpdate(postId, { $inc: { commentsCount: 1 } });
  if (parentComment) await Comment.findByIdAndUpdate(parentComment, { $inc: { repliesCount: 1 } });

  await comment.populate("author", AUTHOR_SELECT);

  const io = req.app.get("io");

  if (parent) {
    // Reply — notify the parent comment's author.
    await createNotification(io, {
      recipient: parent.author,
      actor: req.user._id,
      type: "reply",
      text: "replied to your comment",
      entityType: "Post",
      entityId: post._id,
    });
    // Also notify the post author, unless they're the same person we just notified.
    if (!post.author.equals(parent.author)) {
      await createNotification(io, {
        recipient: post.author,
        actor: req.user._id,
        type: "comment",
        text: "commented on your post",
        entityType: "Post",
        entityId: post._id,
      });
    }
  } else {
    await createNotification(io, {
      recipient: post.author,
      actor: req.user._id,
      type: "comment",
      text: "commented on your post",
      entityType: "Post",
      entityId: post._id,
    });
  }

  await Promise.all(
    mentions.map((mentionedUserId) =>
      createNotification(io, {
        recipient: mentionedUserId,
        actor: req.user._id,
        type: "mention",
        text: "mentioned you in a comment",
        entityType: "Post",
        entityId: post._id,
      })
    )
  );

  return new ApiResponse(201, { comment }, "Comment added").send(res);
});

/**
 * PATCH /comments/:id (owner only)
 */
const updateComment = catchAsync(async (req, res) => {
  const comment = await Comment.findById(req.params.id);
  if (!comment || comment.status !== "active") throw ApiError.notFound("Comment not found");
  if (!comment.author.equals(req.user._id)) throw ApiError.forbidden("You can only edit your own comments");

  comment.content = req.body.content.trim();
  comment.mentions = await extractMentions(req.body.content);
  comment.isEdited = true;
  comment.editedAt = new Date();
  await comment.save();

  await comment.populate("author", AUTHOR_SELECT);
  return new ApiResponse(200, { comment }, "Comment updated").send(res);
});

/**
 * DELETE /comments/:id (owner, post owner, or admin/moderator)
 */
const deleteComment = catchAsync(async (req, res) => {
  const comment = await Comment.findById(req.params.id);
  if (!comment) throw ApiError.notFound("Comment not found");

  const post = await Post.findById(comment.post);
  const isCommentOwner = comment.author.equals(req.user._id);
  const isPostOwner = post && post.author.equals(req.user._id);
  const isModerator = ["admin", "moderator"].includes(req.user.role);

  if (!isCommentOwner && !isPostOwner && !isModerator) {
    throw ApiError.forbidden("You do not have permission to delete this comment");
  }

  // Cascade-delete direct replies (comments are only one level deep).
  const replies = await Comment.find({ parentComment: comment._id }).select("_id");
  const replyIds = replies.map((r) => r._id);

  await Promise.all([
    Comment.deleteMany({ _id: { $in: [comment._id, ...replyIds] } }),
    Like.deleteMany({ targetType: "Comment", targetId: { $in: [comment._id, ...replyIds] } }),
  ]);

  const totalRemoved = 1 + replyIds.length;
  if (post) await Post.findByIdAndUpdate(post._id, { $inc: { commentsCount: -totalRemoved } });
  if (comment.parentComment) await Comment.findByIdAndUpdate(comment.parentComment, { $inc: { repliesCount: -1 } });

  return new ApiResponse(200, null, "Comment deleted").send(res);
});

/**
 * POST /comments/:id/like (toggle)
 */
const toggleLikeComment = catchAsync(async (req, res) => {
  const comment = await Comment.findById(req.params.id);
  if (!comment || comment.status !== "active") throw ApiError.notFound("Comment not found");

  const result = await toggleLike({
    userId: req.user._id,
    targetType: "Comment",
    targetId: comment._id,
    TargetModel: Comment,
  });

  if (result.liked) {
    await createNotification(req.app.get("io"), {
      recipient: comment.author,
      actor: req.user._id,
      type: "like",
      text: "liked your comment",
      entityType: "Post",
      entityId: comment.post,
    });
  }

  return new ApiResponse(200, result, result.liked ? "Comment liked" : "Comment unliked").send(res);
});

/**
 * GET /comments/:id/likes
 */
const getCommentLikers = catchAsync(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { users, total } = await getLikers({ targetType: "Comment", targetId: req.params.id, skip, limit });
  return new ApiResponse(200, { users }, "Likers fetched", buildMeta({ page, limit, total })).send(res);
});

module.exports = {
  getPostComments,
  getCommentReplies,
  createComment,
  updateComment,
  deleteComment,
  toggleLikeComment,
  getCommentLikers,
};
