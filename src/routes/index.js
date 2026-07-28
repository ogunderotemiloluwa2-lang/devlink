const express = require("express");
const authRoutes = require("./auth.routes");
const profileRoutes = require("./profile.routes");
const skillRoutes = require("./skill.routes");
const postRoutes = require("./post.routes");
const commentRoutes = require("./comment.routes");
const bookmarkRoutes = require("./bookmark.routes");
const followRoutes = require("./follow.routes");
const communityRoutes = require("./community.routes");
const projectRoutes = require("./project.routes");
const conversationRoutes = require("./conversation.routes");
const messageRoutes = require("./message.routes");
const aiToolRoutes = require("./aiTool.routes");
const notificationRoutes = require("./notification.routes");
const searchRoutes = require("./search.routes");

const router = express.Router();

// Phase 10 adds /search. Later phases mount /reports, /admin.
router.use("/auth", authRoutes);
router.use("/profiles", profileRoutes);
router.use("/skills", skillRoutes);
router.use("/posts", postRoutes);
router.use("/comments", commentRoutes);
router.use("/bookmarks", bookmarkRoutes);
router.use("/follow", followRoutes);
router.use("/communities", communityRoutes);
router.use("/projects", projectRoutes);
router.use("/conversations", conversationRoutes);
router.use("/messages", messageRoutes);
router.use("/ai-tools", aiToolRoutes);
router.use("/notifications", notificationRoutes);
router.use("/search", searchRoutes);

router.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "DevLink API is healthy", timestamp: new Date().toISOString() });
});

module.exports = router;
