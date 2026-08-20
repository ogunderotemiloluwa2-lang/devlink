const express = require("express");
const authController = require("../controllers/auth.controller");
const validate = require("../middleware/validate.middleware");
const { protect } = require("../middleware/auth.middleware");
const { apiLimiter, authLimiter, sensitiveActionLimiter } = require("../middleware/rateLimiter.middleware");
const {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  changePasswordValidator,
  resendVerificationValidator,
} = require("../validators/auth.validator");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Registration, login, tokens, email verification, password reset
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, username, email, password]
 *             properties:
 *               name: { type: string, example: Jordan Ellis }
 *               username: { type: string, example: jordanellis }
 *               email: { type: string, example: jordan@example.com }
 *               password: { type: string, example: password123 }
 *     responses:
 *       201: { description: User created }
 *       409: { description: Email or username already in use }
 */
router.post("/register", authLimiter, registerValidator, validate, authController.register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Log in with email/username and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [identifier, password]
 *             properties:
 *               identifier: { type: string, example: jordan@example.com }
 *               password: { type: string, example: password123 }
 *     responses:
 *       200: { description: Logged in }
 *       401: { description: Invalid credentials }
 */
router.post("/login", authLimiter, loginValidator, validate, authController.login);

/**
 * @swagger
 * /auth/verify-email:
 *   get:
 *     summary: Verify email address via token
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Email verified }
 */
router.get("/verify-email", authController.verifyEmail);
router.post("/verify-email", authController.verifyEmail);

router.post(
  "/resend-verification",
  sensitiveActionLimiter,
  resendVerificationValidator,
  validate,
  authController.resendVerification
);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Exchange a valid refresh token cookie for a new access token
 *     tags: [Auth]
 *     responses:
 *       200: { description: New access token issued }
 *       401: { description: Refresh token missing/invalid }
 */
router.post("/refresh", apiLimiter, authController.refresh);

router.post("/logout", authController.logout);
router.post("/logout-all", protect, authController.logoutAll);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request a password reset email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string }
 *     responses:
 *       200: { description: Reset email sent if account exists }
 */
router.post(
  "/forgot-password",
  sensitiveActionLimiter,
  forgotPasswordValidator,
  validate,
  authController.forgotPassword
);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset password using a valid reset token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: Password reset }
 */
router.post("/reset-password", resetPasswordValidator, validate, authController.resetPassword);

router.patch("/change-password", protect, changePasswordValidator, validate, authController.changePassword);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get the currently authenticated user
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Current user }
 *       401: { description: Not authenticated }
 */
router.get("/me", protect, authController.getMe);

/**
 * @swagger
 * /auth/account:
 *   delete:
 *     summary: Permanently delete the authenticated user's account
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Account deleted }
 *       401: { description: Not authenticated }
 */
router.delete("/account", protect, authController.deleteAccount);

module.exports = router;
