const catchAsync = require("../utils/catchAsync");
const ApiError = require("../utils/ApiError");
const { verifyAccessToken } = require("../utils/token");
const User = require("../models/User.model");

function extractToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) return header.split(" ")[1];
  if (req.cookies?.accessToken) return req.cookies.accessToken;
  return null;
}

// Requires a valid access token. Attaches the authenticated user to req.user.
const protect = catchAsync(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized("You must be logged in to access this resource");

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (err) {
    throw ApiError.unauthorized(err.name === "TokenExpiredError" ? "Session expired, please log in again" : "Invalid session token");
  }

  const user = await User.findById(decoded.sub).select("+passwordChangedAt");
  if (!user) throw ApiError.unauthorized("The user for this session no longer exists");
  if (user.status !== "active") throw ApiError.forbidden("This account is not active");
  if (user.changedPasswordAfter(decoded.iat)) {
    throw ApiError.unauthorized("Password was changed recently, please log in again");
  }

  req.user = user;
  next();
});

// Attaches req.user if a valid token is present, but never rejects the
// request — used for endpoints whose response shape varies for guests
// (e.g. showing "isFollowing" only when authenticated).
const optionalAuth = catchAsync(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.sub);
    if (user && user.status === "active") req.user = user;
  } catch (err) {
    // Silently ignore invalid/expired tokens for optional auth.
  }
  next();
});

// Restricts access to the given roles, e.g. authorize("admin", "moderator")
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) {
    return next(ApiError.forbidden("You do not have permission to perform this action"));
  }
  next();
};

module.exports = { protect, optionalAuth, authorize };
