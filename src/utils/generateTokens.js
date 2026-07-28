const { signAccessToken, signRefreshToken } = require("./token");

function generateAuthTokens(user) {
  const accessToken = signAccessToken({ sub: user._id.toString(), role: user.role });
  const refreshToken = signRefreshToken({
    sub: user._id.toString(),
    v: user.refreshTokenVersion || 0,
  });
  return { accessToken, refreshToken };
}

module.exports = generateAuthTokens;
