const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const mongoSanitize = require("express-mongo-sanitize");
const swaggerUi = require("swagger-ui-express");

const { env, clientUrl, cookieSecret } = require("./config/env");
const swaggerSpec = require("./docs/swagger");
const routes = require("./routes");
const { notFound, errorHandler } = require("./middleware/error.middleware");
const { apiLimiter } = require("./middleware/rateLimiter.middleware");
const xssSanitize = require("./middleware/xss.middleware");
const hppSanitize = require("./middleware/hpp.middleware");
const logger = require("./utils/logger");

const app = express();

app.set("trust proxy", 1);

// ---- Security & parsing middleware ----
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        clientUrl,
        "http://localhost:5173",
        "http://localhost:3000",
        "https://devlink-frontend.vercel.app",
      ];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser(cookieSecret));
app.use(mongoSanitize());
app.use(xssSanitize);
app.use(hppSanitize);
app.use(compression());

if (env !== "test") {
  app.use(morgan(env === "production" ? "combined" : "dev", { stream: { write: (msg) => logger.info(msg.trim()) } }));
}

app.use("/api/v1", apiLimiter);

// ---- API docs ----
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: "DevLink API Docs" }));
app.get("/api-docs.json", (req, res) => res.json(swaggerSpec));

// ---- Routes ----
app.get("/", (req, res) => {
  res.json({ success: true, message: "DevLink API — see /api-docs for documentation" });
});
app.use("/api/v1", routes);

// ---- 404 + error handling (must be last) ----
app.use(notFound);
app.use(errorHandler);

module.exports = app;
