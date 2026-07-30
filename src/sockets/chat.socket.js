const Conversation = require("../models/Conversation.model");
const Message = require("../models/Message.model");
const { isActiveParticipant } = require("../services/conversation.service");
const logger = require("../utils/logger");

/**
 * Registers chat-related event handlers on a single authenticated socket.
 * Message persistence happens over REST (see conversation.controller.js);
 * these handlers cover the purely real-time, non-persisted concerns:
 * room membership, typing indicators. Message delivery/read-receipt/
 * reaction/edit/delete events are emitted from the REST controllers via
 * `req.app.get("io")` once the DB write succeeds, so there's a single
 * source of truth and no risk of the socket and database disagreeing.
 */
function registerChatHandlers(io, socket) {
  socket.on("conversation:join", async (conversationId, ack) => {
    try {
      const conversation = await Conversation.findById(conversationId).select("participants type");
      if (!conversation || !isActiveParticipant(conversation, socket.userId)) {
        return ack?.({ ok: false, error: "Not a participant of this conversation" });
      }
      socket.join(`conversation:${conversationId}`);

      // Mark all messages in this conversation as delivered to this user
      await Message.updateMany(
        {
          conversation: conversation._id,
          sender: { $ne: socket.userId },
          "deliveredTo.user": { $ne: socket.userId },
        },
        { $addToSet: { deliveredTo: { user: socket.userId, deliveredAt: new Date() } } }
      );

      ack?.({ ok: true });
    } catch (err) {
      logger.warn("conversation:join failed:", err.message);
      ack?.({ ok: false, error: "Could not join conversation" });
    }
  });

  socket.on("conversation:leave", (conversationId) => {
    socket.leave(`conversation:${conversationId}`);
  });

  socket.on("typing:start", ({ conversationId }) => {
    if (!conversationId) return;
    socket.to(`conversation:${conversationId}`).emit("typing:update", {
      conversationId,
      userId: socket.userId,
      isTyping: true,
    });
  });

  socket.on("typing:stop", ({ conversationId }) => {
    if (!conversationId) return;
    socket.to(`conversation:${conversationId}`).emit("typing:update", {
      conversationId,
      userId: socket.userId,
      isTyping: false,
    });
  });
}

module.exports = registerChatHandlers;
