const mongoose = require("mongoose");
const { mongoUri } = require("./env");
const logger = require("../utils/logger");

mongoose.set("strictQuery", true);

async function connectDB() {
  try {
    const conn = await mongoose.connect(mongoUri);
    logger.info(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);

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
