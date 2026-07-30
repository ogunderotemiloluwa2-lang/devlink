require("dotenv").config();

function required(name, fallback = undefined) {
  const value = process.env[name] ?? fallback;
  return value;
}

module.exports = {
  env: process.env.NODE_ENV || "development",
  isProd: process.env.NODE_ENV === "production",
  port: parseInt(process.env.PORT, 10) || 5000,
  clientUrl: required("CLIENT_URL", "http://localhost:5173"),
  apiUrl: required("API_URL", "http://localhost:5000"),

  mongoUri: required("MONGO_URI", "mongodb://127.0.0.1:27017/devlink"),

  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET"),
    refreshSecret: required("JWT_REFRESH_SECRET"),
    accessExpiresIn: required("JWT_ACCESS_EXPIRES_IN", "15m"),
    refreshExpiresIn: required("JWT_REFRESH_EXPIRES_IN", "30d"),
    emailSecret: required("JWT_EMAIL_SECRET"),
    resetSecret: required("JWT_RESET_SECRET"),
  },

  cookieSecret: required("COOKIE_SECRET", "devlink_cookie_secret"),

  cloudinary: {
    cloudName: required("CLOUDINARY_CLOUD_NAME"),
    apiKey: required("CLOUDINARY_API_KEY"),
    apiSecret: required("CLOUDINARY_API_SECRET"),
  },

  smtp: {
    host: required("SMTP_HOST"),
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === "true",
    user: required("SMTP_USER"),
    pass: required("SMTP_PASS"),
    from: required("EMAIL_FROM", "DevLink <no-reply@devlink.io>"),
  },

  redisUrl: required("REDIS_URL", ""),

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 1000,
  },
};
