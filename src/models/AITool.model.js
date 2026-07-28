const mongoose = require("mongoose");
const { Schema } = mongoose;

const PRICING_OPTIONS = ["Free", "Freemium", "Paid"];

const aiToolSchema = new Schema(
  {
    name: { type: String, required: [true, "Tool name is required"], trim: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    tagline: { type: String, trim: true, maxlength: 150, default: "" },
    description: { type: String, trim: true, maxlength: 2000, default: "" },

    // Free-text rather than a fixed enum — tool categories in this space
    // change faster than a migration cycle. /ai-tools/categories exposes
    // the distinct values actually in use for filter UIs.
    category: { type: String, required: true, trim: true, maxlength: 60, index: true },

    pricing: { type: String, enum: PRICING_OPTIONS, default: "Freemium" },
    websiteUrl: { type: String, trim: true, default: "" },

    logoUrl: { type: String, default: null },
    logoPublicId: { type: String, default: null, select: false },

    tags: [{ type: String, trim: true, lowercase: true, maxlength: 40 }],

    submittedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    featured: { type: Boolean, default: false },

    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    reviewsCount: { type: Number, default: 0, min: 0 },
    bookmarksCount: { type: Number, default: 0, min: 0 },
    viewsCount: { type: Number, default: 0, min: 0 },

    status: { type: String, enum: ["approved", "pending", "rejected"], default: "approved", index: true },
  },
  { timestamps: true }
);

aiToolSchema.index({ name: "text", tagline: "text", description: "text", tags: "text" });
aiToolSchema.index({ status: 1, category: 1 });
aiToolSchema.index({ status: 1, featured: -1, ratingAvg: -1 });

aiToolSchema.statics.PRICING_OPTIONS = PRICING_OPTIONS;

module.exports = mongoose.model("AITool", aiToolSchema);
