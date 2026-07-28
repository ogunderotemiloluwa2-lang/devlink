const streamifier = require("streamifier");
const cloudinary = require("../config/cloudinary");
const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");

/**
 * Uploads an in-memory Multer buffer to Cloudinary via an upload stream.
 * @param {Buffer} buffer
 * @param {object} options - cloudinary upload options (folder, resource_type, etc.)
 */
function uploadBuffer(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: "auto", ...options },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

async function uploadImage(buffer, folder, publicId) {
  try {
    const result = await uploadBuffer(buffer, {
      folder: `devlink/${folder}`,
      public_id: publicId,
      resource_type: "image",
      overwrite: true,
      transformation: [{ width: 1600, height: 1600, crop: "limit" }, { quality: "auto:good" }],
    });
    return { url: result.secure_url, publicId: result.public_id };
  } catch (err) {
    logger.error("Cloudinary image upload failed:", err.message);
    throw ApiError.internal("Image upload failed, please try again");
  }
}

async function uploadRawFile(buffer, folder, publicId) {
  try {
    const result = await uploadBuffer(buffer, {
      folder: `devlink/${folder}`,
      public_id: publicId,
      resource_type: "raw",
      overwrite: true,
    });
    return { url: result.secure_url, publicId: result.public_id };
  } catch (err) {
    logger.error("Cloudinary file upload failed:", err.message);
    throw ApiError.internal("File upload failed, please try again");
  }
}

/**
 * Uploads a project attachment, choosing Cloudinary's image pipeline for
 * images (so thumbnails/transformations are available) and the raw
 * pipeline for everything else (zips, docs, code files).
 */
async function uploadProjectFile(buffer, mimeType, folder, publicId) {
  if (mimeType.startsWith("image/")) {
    const result = await uploadImage(buffer, folder, publicId);
    return { ...result, resourceType: "image" };
  }
  const result = await uploadRawFile(buffer, folder, publicId);
  return { ...result, resourceType: "raw" };
}

async function deleteAsset(publicId, resourceType = "image") {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    // Non-fatal: an orphaned Cloudinary asset shouldn't block the request.
    logger.warn(`Failed to delete Cloudinary asset ${publicId}:`, err.message);
  }
}

/**
 * Uploads a message attachment, classifying it into DevLink's attachment
 * taxonomy (image/audio/video/file) and picking the right Cloudinary
 * resource type. Audio/video go through Cloudinary's "video" pipeline
 * (Cloudinary treats audio as a video resource with no visual track).
 */
async function uploadMessageAttachment(buffer, mimeType, folder, publicId) {
  if (mimeType.startsWith("image/")) {
    const result = await uploadImage(buffer, folder, publicId);
    return { ...result, resourceType: "image", type: "image" };
  }
  if (mimeType.startsWith("audio/") || mimeType.startsWith("video/")) {
    try {
      const result = await uploadBuffer(buffer, {
        folder: `devlink/${folder}`,
        public_id: publicId,
        resource_type: "video", // Cloudinary's umbrella type for audio + video
        overwrite: true,
      });
      return {
        url: result.secure_url,
        publicId: result.public_id,
        resourceType: "video",
        type: mimeType.startsWith("audio/") ? "audio" : "video",
        duration: result.duration || null,
      };
    } catch (err) {
      logger.error("Cloudinary media upload failed:", err.message);
      throw ApiError.internal("Attachment upload failed, please try again");
    }
  }
  const result = await uploadRawFile(buffer, folder, publicId);
  return { ...result, resourceType: "raw", type: "file" };
}

module.exports = {
  uploadBuffer,
  uploadImage,
  uploadRawFile,
  uploadProjectFile,
  uploadMessageAttachment,
  deleteAsset,
};
