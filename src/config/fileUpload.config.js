/**
 * Every size limit and mime allowlist used by Multer/Cloudinary uploads
 * lives here, so a policy change (e.g. "allow bigger avatars") happens in
 * one place instead of being hunted down across controllers.
 */

const MB = 1024 * 1024;

const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const DOCUMENT_MIME_TYPES = ["application/pdf"];

const OFFICE_DOCUMENT_MIME_TYPES = [
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const ARCHIVE_MIME_TYPES = ["application/zip", "application/x-zip-compressed"];
const PLAINTEXT_MIME_TYPES = ["text/plain", "text/markdown", "application/json"];

const AUDIO_MIME_TYPES = ["audio/mpeg", "audio/mp4", "audio/wav", "audio/webm", "audio/ogg"];
const VIDEO_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

const GENERAL_FILE_MIME_TYPES = [
  ...IMAGE_MIME_TYPES,
  ...DOCUMENT_MIME_TYPES,
  ...ARCHIVE_MIME_TYPES,
  ...PLAINTEXT_MIME_TYPES,
  ...OFFICE_DOCUMENT_MIME_TYPES,
];

const ATTACHMENT_MIME_TYPES = [...GENERAL_FILE_MIME_TYPES, ...AUDIO_MIME_TYPES, ...VIDEO_MIME_TYPES];

// Size limits, in bytes. Kept as a single table so it's easy to audit at a
// glance whether the limits make sense relative to each other.
const LIMITS = {
  IMAGE_BYTES: 5 * MB, // avatars, covers, banners, logos, post/project images
  MULTI_IMAGE_BYTES: 8 * MB, // per-file limit when several images are attached at once
  MULTI_IMAGE_MAX_COUNT: 6,
  DOCUMENT_BYTES: 8 * MB, // resumes
  GENERAL_FILE_BYTES: 15 * MB, // project files (zips, docs, code)
  ATTACHMENT_BYTES: 20 * MB, // message attachments (may include audio/video)
  ATTACHMENT_MAX_COUNT: 5,
};

module.exports = {
  IMAGE_MIME_TYPES,
  DOCUMENT_MIME_TYPES,
  OFFICE_DOCUMENT_MIME_TYPES,
  ARCHIVE_MIME_TYPES,
  PLAINTEXT_MIME_TYPES,
  AUDIO_MIME_TYPES,
  VIDEO_MIME_TYPES,
  GENERAL_FILE_MIME_TYPES,
  ATTACHMENT_MIME_TYPES,
  LIMITS,
};
