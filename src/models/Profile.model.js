const mongoose = require("mongoose");
const { Schema } = mongoose;

const profileSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    headline: { type: String, trim: true, maxlength: 120, default: "" }, // e.g. "Senior Backend Engineer"
    company: { type: String, trim: true, maxlength: 120, default: "" },
    location: { type: String, trim: true, maxlength: 120, default: "" },
    country: { type: String, trim: true, maxlength: 80, default: "" },
    bio: { type: String, trim: true, maxlength: 500, default: "" },
    about: { type: String, trim: true, maxlength: 2000, default: "" },

    experience: {
      level: {
        type: String,
        enum: ["Student", "Junior", "Mid-level", "Senior", "Lead", "Executive"],
        default: null,
      },
      years: { type: Number, min: 0, max: 60, default: 0 },
    },

    coverImageUrl: { type: String, default: null },
    coverImagePublicId: { type: String, default: null, select: false },

    resumeUrl: { type: String, default: null },
    resumePublicId: { type: String, default: null, select: false },

    skills: [{ type: Schema.Types.ObjectId, ref: "Skill" }],

    links: {
      github: { type: String, trim: true, default: "" },
      website: { type: String, trim: true, default: "" },
      portfolio: { type: String, trim: true, default: "" },
      twitter: { type: String, trim: true, default: "" },
      linkedin: { type: String, trim: true, default: "" },
    },

    pinnedRepo: { type: String, trim: true, default: "" },

    openToWork: { type: Boolean, default: false },
    openToCollab: { type: Boolean, default: true },

    visibility: {
      type: String,
      enum: ["public", "private"],
      default: "public",
    },

    // Per-type opt-out — "system" is deliberately excluded from the schema
    // (system notifications aren't optional; they're used for account-level
    // and moderation communications).
    notificationPreferences: {
      follow: { type: Boolean, default: true },
      like: { type: Boolean, default: true },
      comment: { type: Boolean, default: true },
      reply: { type: Boolean, default: true },
      mention: { type: Boolean, default: true },
      projectInvite: { type: Boolean, default: true },
      communityInvite: { type: Boolean, default: true },
      message: { type: Boolean, default: true },
      emailDigest: { type: Boolean, default: false },
    },

    followersCount: { type: Number, default: 0, min: 0 },
    followingCount: { type: Number, default: 0, min: 0 },
    postsCount: { type: Number, default: 0, min: 0 },
    projectsCount: { type: Number, default: 0, min: 0 },

    profileViews: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

profileSchema.index({ headline: "text", company: "text", bio: "text", about: "text" });
profileSchema.index({ location: 1 });
profileSchema.index({ openToWork: 1 });
profileSchema.index({ visibility: 1 });

module.exports = mongoose.model("Profile", profileSchema);
