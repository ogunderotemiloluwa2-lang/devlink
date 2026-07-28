const mongoose = require("mongoose");

/**
 * Builds a Mongo filter fragment for cursor-based pagination on
 * (sortField, _id), which stays stable even as new documents are inserted
 * between requests — unlike skip/limit, which can skip or repeat items on
 * a live feed/conversation list.
 *
 * Cursor format: base64("<ISO date>_<_id>")
 * `field` defaults to "createdAt" (feed, hashtag posts, etc.); pass
 * "updatedAt" for lists that reorder on activity, like conversations.
 */
function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const decoded = Buffer.from(cursor, "base64").toString("utf8");
    const [dateStr, id] = decoded.split("_");
    if (!dateStr || !mongoose.isValidObjectId(id)) return null;
    return { date: new Date(dateStr), id };
  } catch {
    return null;
  }
}

function encodeCursor(doc, field = "createdAt") {
  if (!doc) return null;
  const raw = `${doc[field].toISOString()}_${doc._id.toString()}`;
  return Buffer.from(raw).toString("base64");
}

/**
 * Returns a Mongo query fragment to append to $and: items strictly "older"
 * than the cursor, ordered by `field` desc then _id desc.
 */
function cursorFilter(cursor, field = "createdAt") {
  const decoded = decodeCursor(cursor);
  if (!decoded) return {};
  return {
    $or: [{ [field]: { $lt: decoded.date } }, { [field]: decoded.date, _id: { $lt: decoded.id } }],
  };
}

module.exports = { decodeCursor, encodeCursor, cursorFilter };
