const Redis = require("ioredis");
const { redisUrl } = require("./env");
const logger = require("../utils/logger");

let client = null;

if (redisUrl) {
  client = new Redis(redisUrl, {
    maxRetriesPerRequest: 2,
    retryStrategy: (times) => Math.min(times * 200, 2000),
  });

  client.on("connect", () => logger.info("Redis connected"));
  client.on("error", (err) => logger.warn("Redis error:", err.message));
} else {
  logger.info("REDIS_URL not set — Redis caching disabled, falling back to no-op cache");
}

// Safe wrapper: every method resolves gracefully even when Redis is disabled
// or unreachable, so Redis is truly optional and never breaks a request.
const cache = {
  isEnabled: () => !!client && client.status === "ready",

  async get(key) {
    if (!client) return null;
    try {
      const value = await client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (err) {
      logger.warn("Redis GET failed:", err.message);
      return null;
    }
  },

  async set(key, value, ttlSeconds = 60) {
    if (!client) return false;
    try {
      await client.set(key, JSON.stringify(value), "EX", ttlSeconds);
      return true;
    } catch (err) {
      logger.warn("Redis SET failed:", err.message);
      return false;
    }
  },

  async del(key) {
    if (!client) return false;
    try {
      await client.del(key);
      return true;
    } catch (err) {
      logger.warn("Redis DEL failed:", err.message);
      return false;
    }
  },

  async delByPrefix(prefix) {
    if (!client) return false;
    try {
      const keys = await client.keys(`${prefix}*`);
      if (keys.length) await client.del(keys);
      return true;
    } catch (err) {
      logger.warn("Redis DEL by prefix failed:", err.message);
      return false;
    }
  },
};

module.exports = { redisClient: client, cache };
