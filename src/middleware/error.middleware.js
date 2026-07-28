const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");
const { isProd } = require("../config/env");

function notFound(req, res, next) {
  next(ApiError.notFound(`Route not found — ${req.method} ${req.originalUrl}`));
}

// Normalizes Mongoose/JWT/Multer errors into ApiError so every response
// shares the same JSON shape, regardless of where the error originated.
function normalizeError(err) {
  if (err instanceof ApiError) return err;

  if (err.name === "ValidationError") {
    const details = Object.values(err.errors).map((e) => e.message);
    return ApiError.badRequest("Validation failed", details);
  }

  if (err.name === "CastError") {
    return ApiError.badRequest(`Invalid value for field "${err.path}"`);
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    return ApiError.conflict(`${field} already in use`);
  }

  if (err.name === "JsonWebTokenError") {
    return ApiError.unauthorized("Invalid token");
  }

  if (err.name === "TokenExpiredError") {
    return ApiError.unauthorized("Token has expired");
  }

  if (err.name === "MulterError") {
    return ApiError.badRequest(err.message);
  }

  return new ApiError(err.statusCode || 500, err.message || "Internal server error");
}

function errorHandler(err, req, res, next) {
  const normalized = normalizeError(err);

  if (!normalized.isOperational || normalized.statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} —`, err.stack || err.message);
  }

  res.status(normalized.statusCode).json({
    success: false,
    statusCode: normalized.statusCode,
    message: normalized.message,
    ...(normalized.details ? { errors: normalized.details } : {}),
    ...(isProd ? {} : { stack: err.stack }),
  });
}

module.exports = { notFound, errorHandler };
