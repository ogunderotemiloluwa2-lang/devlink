/**
 * Converts a display name into a URL-safe slug: lowercase, hyphenated,
 * alphanumerics only. Used for Community slugs (and any future
 * slugged resource — Project names, etc).
 */
function slugify(text = "") {
  return text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

module.exports = slugify;
