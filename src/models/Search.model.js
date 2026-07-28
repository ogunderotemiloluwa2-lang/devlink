const mongoose = require("mongoose");
const { Schema } = mongoose;

const searchSchema = new Schema(
  {
    // Nullable — anonymous searches still count toward trending, just not
    // toward any user's personal recent-searches list.
    user: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    query: { type: String, required: true, trim: true, lowercase: true, maxlength: 100 },
  },
  { timestamps: true }
);

searchSchema.index({ user: 1, createdAt: -1 });
searchSchema.index({ query: 1, createdAt: -1 });
// Auto-expire search history after 90 days so this collection never grows
// unbounded — trending/recent only ever care about recent activity anyway.
searchSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

module.exports = mongoose.model("Search", searchSchema);
