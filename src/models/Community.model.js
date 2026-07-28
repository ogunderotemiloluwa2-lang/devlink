const mongoose = require("mongoose");
const { Schema } = mongoose;

const communitySchema = new Schema(
  {
    name: { type: String, required: [true, "Community name is required"], trim: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    description: { type: String, trim: true, maxlength: 500, default: "" },

    topics: [{ type: String, trim: true, lowercase: true, maxlength: 40 }],

    avatarUrl: { type: String, default: null },
    avatarPublicId: { type: String, default: null, select: false },
    bannerUrl: { type: String, default: null },
    bannerPublicId: { type: String, default: null, select: false },

    rules: [{ type: String, trim: true, maxlength: 200 }],

    creator: { type: Schema.Types.ObjectId, ref: "User", required: true },

    visibility: { type: String, enum: ["public", "private"], default: "public" },

    membersCount: { type: Number, default: 0, min: 0 },
    postsCount: { type: Number, default: 0, min: 0 },

    status: { type: String, enum: ["active", "archived"], default: "active", index: true },
  },
  { timestamps: true }
);

communitySchema.index({ name: "text", description: "text", topics: "text" });
communitySchema.index({ status: 1, membersCount: -1 });

module.exports = mongoose.model("Community", communitySchema);
