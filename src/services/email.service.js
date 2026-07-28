const nodemailer = require("nodemailer");
const { smtp, clientUrl } = require("../config/env");
const logger = require("../utils/logger");

const transporter = nodemailer.createTransport({
  host: smtp.host,
  port: smtp.port,
  secure: smtp.secure,
  auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
});

async function sendMail({ to, subject, html, text }) {
  try {
    await transporter.sendMail({
      from: smtp.from,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, ""),
    });
    return true;
  } catch (err) {
    // Email delivery failures should not crash request handling — log and
    // let the caller decide whether to surface a warning to the client.
    logger.error("Email send failed:", err.message);
    return false;
  }
}

function baseTemplate(title, bodyHtml) {
  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #111827;">
    <div style="display:flex; align-items:center; gap:8px; margin-bottom:24px;">
      <div style="width:28px;height:28px;border-radius:6px;background:#0B6FDA;"></div>
      <span style="font-weight:600; font-size:16px;">DevLink</span>
    </div>
    <h1 style="font-size:18px; font-weight:600; margin-bottom:12px;">${title}</h1>
    ${bodyHtml}
    <p style="margin-top:32px; font-size:12px; color:#6b7280;">
      © ${new Date().getFullYear()} DevLink. If you didn't request this, you can safely ignore this email.
    </p>
  </div>`;
}

async function sendVerificationEmail(user, token) {
  const link = `${clientUrl}/verify-email?token=${token}`;
  const html = baseTemplate(
    "Verify your email address",
    `<p style="font-size:14px; line-height:1.6;">Hi ${user.name || user.username},</p>
     <p style="font-size:14px; line-height:1.6;">Confirm your email to finish setting up your DevLink account.</p>
     <a href="${link}" style="display:inline-block; margin-top:12px; padding:10px 20px; background:#0B6FDA; color:#fff; text-decoration:none; border-radius:6px; font-size:14px; font-weight:500;">Verify email</a>
     <p style="margin-top:16px; font-size:12px; color:#6b7280;">Or paste this link into your browser: ${link}</p>`
  );
  return sendMail({ to: user.email, subject: "Verify your DevLink email", html });
}

async function sendPasswordResetEmail(user, token) {
  const link = `${clientUrl}/reset-password?token=${token}`;
  const html = baseTemplate(
    "Reset your password",
    `<p style="font-size:14px; line-height:1.6;">Hi ${user.name || user.username},</p>
     <p style="font-size:14px; line-height:1.6;">We received a request to reset your DevLink password. This link expires in 1 hour.</p>
     <a href="${link}" style="display:inline-block; margin-top:12px; padding:10px 20px; background:#0B6FDA; color:#fff; text-decoration:none; border-radius:6px; font-size:14px; font-weight:500;">Reset password</a>
     <p style="margin-top:16px; font-size:12px; color:#6b7280;">Or paste this link into your browser: ${link}</p>`
  );
  return sendMail({ to: user.email, subject: "Reset your DevLink password", html });
}

async function sendPasswordChangedEmail(user) {
  const html = baseTemplate(
    "Your password was changed",
    `<p style="font-size:14px; line-height:1.6;">Hi ${user.name || user.username},</p>
     <p style="font-size:14px; line-height:1.6;">This is a confirmation that your DevLink password was just changed. If this wasn't you, contact support immediately.</p>`
  );
  return sendMail({ to: user.email, subject: "Your DevLink password was changed", html });
}

module.exports = {
  sendMail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
};
