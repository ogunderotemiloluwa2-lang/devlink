const mongoose = require("mongoose");
const { mongoUri } = require("./env");
const logger = require("../utils/logger");

mongoose.set("strictQuery", true);

// Drop the legacy Post text index that caused "language override unsupported"
// errors on post creation. The index was removed from the schema, but it still
// exists in the database from a previous deployment, so we drop it explicitly.
async function dropLegacyPostTextIndex() {
  try {
    const posts = mongoose.connection.collection("posts");
    const indexes = await posts.indexes();
    for (const idx of indexes) {
      const keys = idx.key || {};
      const isTextIndex = Object.values(keys).some((v) => v === "text");
      if (isTextIndex) {
        await posts.dropIndex(idx.name);
        logger.info(`Dropped legacy text index: ${idx.name}`);
      }
    }
  } catch (err) {
    // Ignore errors (e.g. index already dropped) — this is best-effort cleanup.
    logger.warn(`Could not drop legacy Post text index: ${err.message}`);
  }
}

async function connectDB() {
  try {
    const conn = await mongoose.connect(mongoUri);
    logger.info(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);

    await dropLegacyPostTextIndex();

    mongoose.connection.on("error", (err) => {
      logger.error("MongoDB connection error:", err.message);
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected");
    });

    return conn;
  } catch (err) {
    logger.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
