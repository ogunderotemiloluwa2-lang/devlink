const mongoose = require("mongoose");
const { Schema } = mongoose;

const SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced", "Expert"];
const SKILL_CATEGORIES = [
  "Language",
  "Framework",
  "Database",
  "Cloud",
  "DevOps",
  "Design",
  "Mobile",
  "AI/ML",
  "Testing",
  "Tool",
  "Other",
];

const skillSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Skill name is required"],
      trim: true,
      maxlength: 60,
    },
    // Lowercased mirror of `name`, used for case-insensitive uniqueness and
    // for the catalog/autocomplete search — avoids a collation-aware index.
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    category: {
      type: String,
      enum: SKILL_CATEGORIES,
      default: "Other",
    },
    level: {
      type: String,
      enum: SKILL_LEVELS,
      default: "Intermediate",
    },
    yearsOfExperience: {
      type: Number,
      min: 0,
      max: 60,
      default: 0,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

skillSchema.index({ user: 1, slug: 1 }, { unique: true });
skillSchema.index({ user: 1, featured: -1, order: 1 });

skillSchema.pre("validate", function setSlug(next) {
  if (this.name) this.slug = this.name.trim().toLowerCase();
  next();
});

skillSchema.statics.LEVELS = SKILL_LEVELS;
skillSchema.statics.CATEGORIES = SKILL_CATEGORIES;

module.exports = mongoose.model("Skill", skillSchema);
