const rateLimit = require("express-rate-limit");
const { rateLimit: cfg } = require("../config/env");

// General API limiter applied globally.
const apiLimiter = rateLimit({
  windowMs: cfg.windowMs,
  max: cfg.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, statusCode: 429, message: "Too many requests, please try again later" },
});

// Tighter limiter for brute-force-sensitive auth endpoints.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, statusCode: 429, message: "Too many attempts, please try again later" },
});

// Very tight limiter for password reset / email verification requests to
// prevent email-bombing a target address.
const sensitiveActionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, statusCode: 429, message: "Too many requests. Try again in an hour." },
});

module.exports = { apiLimiter, authLimiter, sensitiveActionLimiter };
