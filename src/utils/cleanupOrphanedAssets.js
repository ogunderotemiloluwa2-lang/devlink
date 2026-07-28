/**
 * Finds Cloudinary assets under the "devlink/" prefix that no longer have
 * a matching publicId anywhere in the database, and reports (or deletes)
 * them. Assets can go orphaned if a request crashes between uploading to
 * Cloudinary and saving the publicId to Mongo, or if a delete step fails
 * silently (every delete in this codebase is wrapped in try/catch so it
 * can never block the primary action — see cloudinary.service.js).
 *
 * Usage:
 *   node src/utils/cleanupOrphanedAssets.js            # dry run — report only
 *   node src/utils/cleanupOrphanedAssets.js --force     # actually delete
 */

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const cloudinary = require("../config/cloudinary");
const logger = require("./logger");

const User = require("../models/User.model");
const Profile = require("../models/Profile.model");
const Community = require("../models/Community.model");
const Project = require("../models/Project.model");
const AITool = require("../models/AITool.model");
const Conversation = require("../models/Conversation.model");
const Message = require("../models/Message.model");

const FORCE = process.argv.includes("--force");

async function collectReferencedPublicIds() {
  const ids = new Set();

  const users = await User.find({ avatarPublicId: { $ne: null } }).select("avatarPublicId");
  users.forEach((u) => ids.add(u.avatarPublicId));

  const profiles = await Profile.find({
    $or: [{ coverImagePublicId: { $ne: null } }, { resumePublicId: { $ne: null } }],
  }).select("coverImagePublicId resumePublicId");
  profiles.forEach((p) => {
    if (p.coverImagePublicId) ids.add(p.coverImagePublicId);
    if (p.resumePublicId) ids.add(p.resumePublicId);
  });

  const communities = await Community.find({
    $or: [{ avatarPublicId: { $ne: null } }, { bannerPublicId: { $ne: null } }],
  }).select("avatarPublicId bannerPublicId");
  communities.forEach((c) => {
    if (c.avatarPublicId) ids.add(c.avatarPublicId);
    if (c.bannerPublicId) ids.add(c.bannerPublicId);
  });

  const projects = await Project.find({}).select("coverImagePublicId files.publicId");
  projects.forEach((p) => {
    if (p.coverImagePublicId) ids.add(p.coverImagePublicId);
    (p.files || []).forEach((f) => f.publicId && ids.add(f.publicId));
  });

  const tools = await AITool.find({ logoPublicId: { $ne: null } }).select("logoPublicId");
  tools.forEach((t) => ids.add(t.logoPublicId));

  const conversations = await Conversation.find({ groupAvatarPublicId: { $ne: null } }).select(
    "groupAvatarPublicId"
  );
  conversations.forEach((c) => ids.add(c.groupAvatarPublicId));

  const messages = await Message.find({ "attachments.0": { $exists: true } }).select("attachments.publicId");
  messages.forEach((m) => (m.attachments || []).forEach((a) => a.publicId && ids.add(a.publicId)));

  return ids;
}

async function listCloudinaryAssets(prefix = "devlink/") {
  const assets = [];

  // Cloudinary's admin API is scoped per resource_type (unlike
  // upload/destroy, which infer it) — image/raw/video must be listed separately.
  for (const resourceType of ["image", "raw", "video"]) {
    let nextCursor;
    do {
      // eslint-disable-next-line no-await-in-loop
      const page = await cloudinary.api.resources({
        type: "upload",
        prefix,
        max_results: 500,
        next_cursor: nextCursor,
        resource_type: resourceType,
      });
      assets.push(...page.resources.map((r) => ({ ...r, resource_type: resourceType })));
      nextCursor = page.next_cursor;
    } while (nextCursor);
  }

  return assets;
}

async function run() {
  await connectDB();
  logger.info(`Scanning for orphaned Cloudinary assets (${FORCE ? "FORCE DELETE" : "dry run"})...`);

  const referencedIds = await collectReferencedPublicIds();
  const assets = await listCloudinaryAssets();

  const orphaned = assets.filter((asset) => !referencedIds.has(asset.public_id));

  logger.info(`Found ${assets.length} total assets, ${referencedIds.size} referenced, ${orphaned.length} orphaned.`);

  for (const asset of orphaned) {
    if (FORCE) {
      // eslint-disable-next-line no-await-in-loop
      await cloudinary.uploader.destroy(asset.public_id, { resource_type: asset.resource_type });
      logger.info(`Deleted: ${asset.public_id}`);
    } else {
      logger.info(`Would delete: ${asset.public_id} (${asset.resource_type}, ${asset.bytes} bytes)`);
    }
  }

  if (!FORCE && orphaned.length > 0) {
    logger.info("Dry run complete. Re-run with --force to actually delete these assets.");
  }

  await mongoose.connection.close();
}

run().catch((err) => {
  logger.error("Cleanup script failed:", err.message);
  process.exit(1);
});
