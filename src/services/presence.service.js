/**
 * Tracks which users currently have at least one open socket connection.
 *
 * This is an in-memory, per-process store. It's sufficient for a single
 * Node instance. If DevLink is ever deployed across multiple instances,
 * presence needs to move to a shared store (e.g. Redis SETs + pub/sub, or
 * the Socket.IO Redis adapter) so all instances agree on who's online —
 * that's a Phase 14 (performance/scaling) concern, not a Phase 7 one.
 */

// userId (string) -> Set of socket ids
const onlineUsers = new Map();

function addConnection(userId, socketId) {
  const id = userId.toString();
  if (!onlineUsers.has(id)) onlineUsers.set(id, new Set());
  onlineUsers.get(id).add(socketId);
  return onlineUsers.get(id).size === 1; // true if this is the user's first connection (went online)
}

function removeConnection(userId, socketId) {
  const id = userId.toString();
  const sockets = onlineUsers.get(id);
  if (!sockets) return false;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    onlineUsers.delete(id);
    return true; // true if the user has no more connections (went offline)
  }
  return false;
}

function isOnline(userId) {
  return onlineUsers.has(userId.toString());
}

function getOnlineUserIds(userIds) {
  return userIds.map((id) => id.toString()).filter((id) => onlineUsers.has(id));
}

module.exports = { addConnection, removeConnection, isOnline, getOnlineUserIds };
