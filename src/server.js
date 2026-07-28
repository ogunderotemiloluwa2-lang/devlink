const http = require("http");
const app = require("./app");
const connectDB = require("./config/db");
const initSocket = require("./sockets");
const { port, env } = require("./config/env");
const logger = require("./utils/logger");

async function start() {
  await connectDB();

  const httpServer = http.createServer(app);
  const io = initSocket(httpServer);

  // Make io available to controllers/services via req.app.get("io") for
  // emitting real-time events (notifications, message delivery, etc.).
  app.set("io", io);

  httpServer.listen(port, () => {
    logger.info(`DevLink API running in ${env} mode on port ${port}`);
    logger.info(`Swagger docs: http://localhost:${port}/api-docs`);
  });

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled Rejection:", reason);
    httpServer.close(() => process.exit(1));
  });

  process.on("uncaughtException", (err) => {
    logger.error("Uncaught Exception:", err);
    process.exit(1);
  });

  process.on("SIGTERM", () => {
    logger.info("SIGTERM received, shutting down gracefully");
    httpServer.close(() => process.exit(0));
  });
}

start();
