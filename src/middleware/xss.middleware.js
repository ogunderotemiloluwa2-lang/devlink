/**
 * Custom XSS sanitization middleware.
 * Replaces the deprecated/broken `xss-clean` package.
 * Strips common XSS patterns from request body, query, and params.
 */
const logger = require("../utils/logger");

// Patterns that indicate XSS attempts
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /on\w+\s*=\s*["'][^"']*["']/gi,
  /javascript\s*:/gi,
  /<\s*\/?\s*(script|iframe|embed|object|applet|meta|link|style|form|input)\s*[^>]*>/gi,
  /eval\s*\(/gi,
  /expression\s*\(/gi,
  /vbscript\s*:/gi,
  /onload\s*=/gi,
  /onerror\s*=/gi,
  /onclick\s*=/gi,
  /onmouseover\s*=/gi,
  /onfocus\s*=/gi,
  /onblur\s*=/gi,
  /onchange\s*=/gi,
  /onsubmit\s*=/gi,
  /onreset\s*=/gi,
  /onselect\s*=/gi,
  /onabort\s*=/gi,
];

function containsXSS(value) {
  if (typeof value === "string") {
    for (const pattern of XSS_PATTERNS) {
      if (pattern.test(value)) {
        return true;
      }
    }
  }
  return false;
}

function sanitizeValue(value) {
  if (typeof value === "string") {
    for (const pattern of XSS_PATTERNS) {
      if (pattern.test(value)) {
        // Replace XSS patterns with empty string
        value = value.replace(pattern, "");
      }
    }
    return value;
  }
  return value;
}

function deepSanitize(obj) {
  if (Array.isArray(obj)) {
    return obj.map((item) => deepSanitize(item));
  }
  if (obj && typeof obj === "object") {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = deepSanitize(value);
    }
    return sanitized;
  }
  return sanitizeValue(obj);
}

function xssMiddleware(req, res, next) {
  try {
    if (req.body) req.body = deepSanitize(req.body);
    if (req.query) req.query = deepSanitize(req.query);
    if (req.params) req.params = deepSanitize(req.params);
    next();
  } catch (err) {
    logger.warn("XSS sanitization error:", err.message);
    next();
  }
}

module.exports = xssMiddleware;
