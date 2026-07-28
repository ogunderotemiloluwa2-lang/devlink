const User = require("../models/User.model");

const HASHTAG_REGEX = /#([a-zA-Z0-9_]{2,50})/g;
const MENTION_REGEX = /@([a-z0-9_]{3,30})/gi;

/**
 * Extracts unique, lowercased hashtags from a block of text.
 * @returns {string[]}
 */
function extractHashtags(text = "") {
  const matches = text.match(HASHTAG_REGEX) || [];
  const tags = matches.map((m) => m.slice(1).toLowerCase());
  return [...new Set(tags)];
}

/**
 * Extracts @handles from text and resolves them against real, active users.
 * Silently ignores handles that don't correspond to a real account.
 * @returns {Promise<import('mongoose').Types.ObjectId[]>}
 */
async function extractMentions(text = "") {
  const matches = text.match(MENTION_REGEX) || [];
  if (matches.length === 0) return [];

  const handles = [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
  const users = await User.find({ username: { $in: handles }, status: "active" }).select("_id");
  return users.map((u) => u._id);
}

module.exports = { extractHashtags, extractMentions };
