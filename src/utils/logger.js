const { env } = require("../config/env");

// Lightweight structured logger. Kept dependency-free (no winston) so the
// backend's dependency footprint stays close to what was requested.
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = env === "production" ? LEVELS.info : LEVELS.debug;

function timestamp() {
  return new Date().toISOString();
}

function log(level, ...args) {
  if (LEVELS[level] > currentLevel) return;
  const prefix = `[${timestamp()}] [${level.toUpperCase()}]`;
  if (level === "error") {
    console.error(prefix, ...args);
  } else if (level === "warn") {
    console.warn(prefix, ...args);
  } else {
    console.log(prefix, ...args);
  }
}

module.exports = {
  error: (...args) => log("error", ...args),
  warn: (...args) => log("warn", ...args),
  info: (...args) => log("info", ...args),
  debug: (...args) => log("debug", ...args),
};
