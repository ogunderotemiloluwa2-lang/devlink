const multer = require("multer");
const ApiError = require("../utils/ApiError");
const {
  IMAGE_MIME_TYPES,
  DOCUMENT_MIME_TYPES,
  GENERAL_FILE_MIME_TYPES,
  ATTACHMENT_MIME_TYPES,
  LIMITS,
} = require("../config/fileUpload.config");

const storage = multer.memoryStorage();

function fileFilterFactory(allowedMimeTypes, label) {
  return (req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(ApiError.badRequest(`Invalid file type for ${label}. Allowed: ${allowedMimeTypes.join(", ")}`));
    }
    cb(null, true);
  };
}

// Single images: avatars, cover images, banners, logos.
const imageUpload = multer({
  storage,
  limits: { fileSize: LIMITS.IMAGE_BYTES },
  fileFilter: fileFilterFactory(IMAGE_MIME_TYPES, "image"),
});

// Resumes (PDF only).
const documentUpload = multer({
  storage,
  limits: { fileSize: LIMITS.DOCUMENT_BYTES },
  fileFilter: fileFilterFactory(DOCUMENT_MIME_TYPES, "document"),
});

// Multiple images at once — post galleries.
const multiImageUpload = multer({
  storage,
  limits: { fileSize: LIMITS.MULTI_IMAGE_BYTES, files: LIMITS.MULTI_IMAGE_MAX_COUNT },
  fileFilter: fileFilterFactory(IMAGE_MIME_TYPES, "image"),
});

// Project files: images, docs, archives, code/text.
const generalFileUpload = multer({
  storage,
  limits: { fileSize: LIMITS.GENERAL_FILE_BYTES },
  fileFilter: fileFilterFactory(GENERAL_FILE_MIME_TYPES, "file"),
});

// Message attachments: everything general files allow, plus audio/video —
// the broadest allowlist in the app, used for chat.
const attachmentUpload = multer({
  storage,
  limits: { fileSize: LIMITS.ATTACHMENT_BYTES, files: LIMITS.ATTACHMENT_MAX_COUNT },
  fileFilter: fileFilterFactory(ATTACHMENT_MIME_TYPES, "attachment"),
});

module.exports = {
  avatarUpload: imageUpload.single("avatar"),
  coverUpload: imageUpload.single("cover"),
  bannerUpload: imageUpload.single("banner"),
  resumeUpload: documentUpload.single("resume"),
  singleImageUpload: imageUpload.single("image"),
  multipleImageUpload: multiImageUpload.array("images", LIMITS.MULTI_IMAGE_MAX_COUNT),
  projectFileUpload: generalFileUpload.single("file"),
  messageAttachmentUpload: attachmentUpload.array("attachments", LIMITS.ATTACHMENT_MAX_COUNT),
};
