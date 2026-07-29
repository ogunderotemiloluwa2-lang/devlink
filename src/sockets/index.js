const { Server } = require("socket.io");
const { verifyAccessToken } = require("../utils/token");
const { clientUrl } = require("../config/env");
const logger = require("../utils/logger");
const Conversation = require("../models/Conversation.model");
const presence = require("../services/presence.service");
const registerChatHandlers = require("./chat.socket");

/**
 * Initializes Socket.IO on top of the existing HTTP server. Handles
 * authenticated connections, online presence, and delegates chat-specific
 * events (room join/leave, typing indicators) to chat.socket.js.
 * Message send/edit/delete/reaction/read-receipt events are emitted from
 * the REST controllers after a successful DB write — see conversation and
 * message controllers.
 */
function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        const allowedOrigins = [
          clientUrl,
          "http://localhost:5173",
          "http://localhost:3000",
          "https://devlink-frontend.vercel.app",
          "https://devlink-frontend-950rz0k5a-samson24434.vercel.app",
          "https://devlinkconnect.vercel.app",
          "https://devlink-31v3.onrender.com",
        ];
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(" ")[1];
      if (!token) return next(new Error("Authentication required"));

      const decoded = verifyAccessToken(token);
      socket.userId = decoded.sub;
      next();
    } catch (err) {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", async (socket) => {
    logger.debug(`Socket connected: user ${socket.userId} (${socket.id})`);
    socket.join(`user:${socket.userId}`);

    const wentOnline = presence.addConnection(socket.userId, socket.id);

    if (wentOnline) {
      // Only tell people who actually share a conversation with this user —
      // presence is not broadcast globally.
      try {
        const conversations = await Conversation.find({ "participants.user": socket.userId }).select(
          "participants.user"
        );
        const counterpartIds = new Set();
        conversations.forEach((c) =>
          c.participants.forEach((p) => {
            if (p.user.toString() !== socket.userId) counterpartIds.add(p.user.toString());
          })
        );
        counterpartIds.forEach((id) => io.to(`user:${id}`).emit("presence:update", { userId: socket.userId, online: true }));
      } catch (err) {
        logger.warn("Failed to broadcast presence:online:", err.message);
      }
    }

    registerChatHandlers(io, socket);

    socket.on("disconnect", async () => {
      logger.debug(`Socket disconnected: user ${socket.userId} (${socket.id})`);
      const wentOffline = presence.removeConnection(socket.userId, socket.id);

      if (wentOffline) {
        try {
          const conversations = await Conversation.find({ "participants.user": socket.userId }).select(
            "participants.user"
          );
          const counterpartIds = new Set();
          conversations.forEach((c) =>
            c.participants.forEach((p) => {
              if (p.user.toString() !== socket.userId) counterpartIds.add(p.user.toString());
            })
          );
          counterpartIds.forEach((id) =>
            io.to(`user:${id}`).emit("presence:update", { userId: socket.userId, online: false })
          );
        } catch (err) {
          logger.warn("Failed to broadcast presence:offline:", err.message);
        }
      }
    });
  });

  return io;
}

module.exports = initSocket;
