const mongoose = require("mongoose");
const { Schema } = mongoose;

const POST_TYPES = ["text", "project-update", "poll", "image", "video", "link", "code"];

const mediaSchema = new Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true, select: false },
    type: { type: String, enum: ["image", "video"], default: "image" },
    width: Number,
    height: Number,
  },
  { _id: false }
);

const pollOptionSchema = new Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 80 },
    votes: { type: Number, default: 0, min: 0 },
  },
  { _id: true }
);

const postSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    type: { type: String, enum: POST_TYPES, default: "text" },

    content: { type: String, trim: true, maxlength: 3000, default: "" },

    media: [mediaSchema],

    codeSnippet: {
      language: { type: String, trim: true, default: "" },
      code: { type: String, maxlength: 6000, default: "" },
    },

    link: {
      url: { type: String, trim: true, default: "" },
      title: { type: String, trim: true, default: "" },
      description: { type: String, trim: true, default: "" },
      image: { type: String, trim: true, default: "" },
    },

    poll: {
      options: [pollOptionSchema],
      expiresAt: { type: Date, default: null },
      voters: [
        {
          user: { type: Schema.Types.ObjectId, ref: "User" },
          optionId: { type: Schema.Types.ObjectId },
          _id: false,
        },
      ],
    },

    // Optional links into other Phase modules — nullable until those
    // modules exist, kept here so the schema doesn't need another migration.
    project: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    community: { type: Schema.Types.ObjectId, ref: "Community", default: null },

    repostOf: { type: Schema.Types.ObjectId, ref: "Post", default: null, index: true },
    quoteContent: { type: String, trim: true, maxlength: 500, default: "" },

    hashtags: [{ type: String, lowercase: true, trim: true, index: true }],
    mentions: [{ type: Schema.Types.ObjectId, ref: "User" }],

    likesCount: { type: Number, default: 0, min: 0 },
    commentsCount: { type: Number, default: 0, min: 0 },
    sharesCount: { type: Number, default: 0, min: 0 },
    bookmarksCount: { type: Number, default: 0, min: 0 },
    viewsCount: { type: Number, default: 0, min: 0 },

    isPinned: { type: Boolean, default: false },
    isAnnouncement: { type: Boolean, default: false },
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },

    status: {
      type: String,
      enum: ["active", "removed", "reported"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true }
);

postSchema.index({ createdAt: -1 });
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ community: 1, isPinned: -1, createdAt: -1 });
postSchema.index({ hashtags: 1, createdAt: -1 });

// Simple, explainable trending score: recent engagement weighted higher
// than raw age. Recomputed on read (see post.controller#getTrendingPosts)
// rather than stored, so it always reflects current counts.
postSchema.methods.computeTrendingScore = function computeTrendingScore() {
  const ageHours = Math.max((Date.now() - this.createdAt.getTime()) / 36e5, 1);
  const engagement = this.likesCount * 1 + this.commentsCount * 2 + this.sharesCount * 3;
  return engagement / Math.pow(ageHours + 2, 1.5);
};

postSchema.statics.TYPES = POST_TYPES;

module.exports = mongoose.model("Post", postSchema);
