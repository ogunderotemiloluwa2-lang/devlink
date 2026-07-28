const crypto = require("crypto");
const User = require("../models/User.model");
const Profile = require("../models/Profile.model");
const catchAsync = require("../utils/catchAsync");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const generateAuthTokens = require("../utils/generateTokens");
const { setRefreshCookie, clearRefreshCookie } = require("../utils/cookies");
const {
  signEmailToken,
  verifyEmailToken,
  signResetToken,
  verifyResetToken,
  verifyRefreshToken,
} = require("../utils/token");
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
} = require("../services/email.service");

/**
 * POST /auth/register
 * Creates a user + an empty linked profile, sends a verification email.
 */
const register = catchAsync(async (req, res) => {
  const { name, username, email, password } = req.body;

  const existing = await User.findOne({ $or: [{ email }, { username }] });
  if (existing) {
    const field = existing.email === email ? "Email" : "Username";
    throw ApiError.conflict(`${field} is already in use`);
  }

  const user = await User.create({ name, username, email, password });
  await Profile.create({ user: user._id });

  const emailToken = signEmailToken({ sub: user._id.toString() });
  const emailSent = await sendVerificationEmail(user, emailToken);

  const { accessToken, refreshToken } = generateAuthTokens(user);
  setRefreshCookie(res, refreshToken);

  return new ApiResponse(
    201,
    { user: user.toSafeObject(), accessToken, emailSent },
    "Account created. Check your email to verify your address."
  ).send(res);
});

/**
 * GET /auth/verify-email?token=...
 */
const verifyEmail = catchAsync(async (req, res) => {
  const { token } = req.query.token ? req.query : req.body;
  if (!token) throw ApiError.badRequest("Verification token is required");

  let decoded;
  try {
    decoded = verifyEmailToken(token);
  } catch (err) {
    throw ApiError.badRequest("Verification link is invalid or has expired");
  }

  const user = await User.findById(decoded.sub);
  if (!user) throw ApiError.notFound("User not found");
  if (user.isEmailVerified) {
    return new ApiResponse(200, { user: user.toSafeObject() }, "Email already verified").send(res);
  }

  user.isEmailVerified = true;
  await user.save({ validateBeforeSave: false });

  return new ApiResponse(200, { user: user.toSafeObject() }, "Email verified successfully").send(res);
});

/**
 * POST /auth/resend-verification
 */
const resendVerification = catchAsync(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  // Always respond the same way to avoid leaking which emails are registered.
  const genericResponse = new ApiResponse(
    200,
    null,
    "If an account with that email exists and is unverified, a new link has been sent."
  );

  if (!user || user.isEmailVerified) return genericResponse.send(res);

  const emailToken = signEmailToken({ sub: user._id.toString() });
  await sendVerificationEmail(user, emailToken);

  return genericResponse.send(res);
});

/**
 * POST /auth/login
 * identifier can be an email or username.
 */
const login = catchAsync(async (req, res) => {
  const { identifier, password } = req.body;

  const query = identifier.includes("@") ? { email: identifier.toLowerCase() } : { username: identifier.toLowerCase() };
  const user = await User.findOne(query).select("+password");

  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized("Incorrect email/username or password");
  }
  if (user.status !== "active") {
    throw ApiError.forbidden("This account has been suspended or deactivated");
  }

  user.lastLoginAt = new Date();
  user.lastActiveAt = new Date();
  await user.save({ validateBeforeSave: false });

  const { accessToken, refreshToken } = generateAuthTokens(user);
  setRefreshCookie(res, refreshToken);

  return new ApiResponse(200, { user: user.toSafeObject(), accessToken }, "Logged in successfully").send(res);
});

/**
 * POST /auth/refresh
 * Reads the refresh token from the httpOnly cookie and issues a new pair.
 */
const refresh = catchAsync(async (req, res) => {
  const token = req.cookies?.devlink_refresh_token;
  if (!token) throw ApiError.unauthorized("No refresh token provided");

  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch (err) {
    clearRefreshCookie(res);
    throw ApiError.unauthorized("Refresh token is invalid or has expired");
  }

  const user = await User.findById(decoded.sub).select("+refreshTokenVersion");
  if (!user) throw ApiError.unauthorized("User no longer exists");
  if ((user.refreshTokenVersion || 0) !== decoded.v) {
    clearRefreshCookie(res);
    throw ApiError.unauthorized("Refresh token has been revoked, please log in again");
  }

  const { accessToken, refreshToken } = generateAuthTokens(user);
  setRefreshCookie(res, refreshToken);

  return new ApiResponse(200, { accessToken }, "Token refreshed").send(res);
});

/**
 * POST /auth/logout
 * Clears the refresh cookie. Does not revoke the token version, so other
 * devices stay logged in (use logout-all for that).
 */
const logout = catchAsync(async (req, res) => {
  clearRefreshCookie(res);
  return new ApiResponse(200, null, "Logged out successfully").send(res);
});

/**
 * POST /auth/logout-all
 * Bumps refreshTokenVersion, invalidating every refresh token for this user.
 */
const logoutAll = catchAsync(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { $inc: { refreshTokenVersion: 1 } });
  clearRefreshCookie(res);
  return new ApiResponse(200, null, "Logged out from all devices").send(res);
});

/**
 * POST /auth/forgot-password
 */
const forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  const genericResponse = new ApiResponse(
    200,
    null,
    "If an account with that email exists, a reset link has been sent."
  );

  if (!user) return genericResponse.send(res);

  const resetToken = signResetToken({ sub: user._id.toString(), v: user.passwordResetTokenVersion || 0 });
  await sendPasswordResetEmail(user, resetToken);

  return genericResponse.send(res);
});

/**
 * POST /auth/reset-password
 */
const resetPassword = catchAsync(async (req, res) => {
  const { token, password } = req.body;

  let decoded;
  try {
    decoded = verifyResetToken(token);
  } catch (err) {
    throw ApiError.badRequest("Reset link is invalid or has expired");
  }

  const user = await User.findById(decoded.sub).select("+passwordResetTokenVersion");
  if (!user) throw ApiError.notFound("User not found");
  if ((user.passwordResetTokenVersion || 0) !== decoded.v) {
    throw ApiError.badRequest("This reset link has already been used");
  }

  user.password = password;
  user.passwordResetTokenVersion = (user.passwordResetTokenVersion || 0) + 1;
  user.refreshTokenVersion = (user.refreshTokenVersion || 0) + 1; // log out all sessions
  await user.save();

  await sendPasswordChangedEmail(user);

  return new ApiResponse(200, null, "Password reset successfully. Please log in again.").send(res);
});

/**
 * PATCH /auth/change-password (authenticated)
 */
const changePassword = catchAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select("+password");
  if (!(await user.comparePassword(currentPassword))) {
    throw ApiError.badRequest("Current password is incorrect");
  }

  user.password = newPassword;
  user.refreshTokenVersion = (user.refreshTokenVersion || 0) + 1;
  await user.save();

  await sendPasswordChangedEmail(user);

  const { accessToken, refreshToken } = generateAuthTokens(user);
  setRefreshCookie(res, refreshToken);

  return new ApiResponse(200, { accessToken }, "Password changed successfully").send(res);
});

/**
 * GET /auth/me (authenticated)
 */
const getMe = catchAsync(async (req, res) => {
  return new ApiResponse(200, { user: req.user.toSafeObject() }, "Current user fetched").send(res);
});

module.exports = {
  register,
  verifyEmail,
  resendVerification,
  login,
  refresh,
  logout,
  logoutAll,
  forgotPassword,
  resetPassword,
  changePassword,
  getMe,
};
