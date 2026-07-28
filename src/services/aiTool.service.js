const Review = require("../models/Review.model");
const AITool = require("../models/AITool.model");

/**
 * Recomputes ratingAvg/reviewsCount from the Review collection and writes
 * it back to the AITool doc. Called after any review create/update/delete
 * so the denormalized aggregate can never drift out of sync — recomputing
 * is simpler and safer than incremental running-average math.
 */
async function recomputeToolRating(aiToolId) {
  const [stats] = await Review.aggregate([
    { $match: { aiTool: aiToolId } },
    { $group: { _id: "$aiTool", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);

  await AITool.findByIdAndUpdate(aiToolId, {
    ratingAvg: stats ? Math.round(stats.avg * 10) / 10 : 0,
    reviewsCount: stats ? stats.count : 0,
  });
}

module.exports = { recomputeToolRating };
