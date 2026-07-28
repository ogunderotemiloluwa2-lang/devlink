const jwt = require("jsonwebtoken");
const { jwt: jwtCfg } = require("../config/env");

function signAccessToken(payload) {
  return jwt.sign(payload, jwtCfg.accessSecret, { expiresIn: jwtCfg.accessExpiresIn });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, jwtCfg.refreshSecret, { expiresIn: jwtCfg.refreshExpiresIn });
}

function signEmailToken(payload) {
  return jwt.sign(payload, jwtCfg.emailSecret, { expiresIn: "1d" });
}

function signResetToken(payload) {
  return jwt.sign(payload, jwtCfg.resetSecret, { expiresIn: "1h" });
}

function verifyAccessToken(token) {
  return jwt.verify(token, jwtCfg.accessSecret);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, jwtCfg.refreshSecret);
}

function verifyEmailToken(token) {
  return jwt.verify(token, jwtCfg.emailSecret);
}

function verifyResetToken(token) {
  return jwt.verify(token, jwtCfg.resetSecret);
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  signEmailToken,
  signResetToken,
  verifyAccessToken,
  verifyRefreshToken,
  verifyEmailToken,
  verifyResetToken,
};
