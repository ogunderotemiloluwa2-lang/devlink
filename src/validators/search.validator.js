const { query, param } = require("express-validator");

const searchQueryValidator = [
  query("q").optional().trim().isLength({ max: 100 }),
  query("limit").optional().isInt({ min: 1, max: 50 }),
  query("page").optional().isInt({ min: 1 }),
];

const trendingQueryValidator = [
  query("window").optional().isInt({ min: 1, max: 30 }),
  query("limit").optional().isInt({ min: 1, max: 30 }),
];

const recentQueryParamValidator = [param("query").trim().notEmpty().withMessage("Query is required")];

module.exports = { searchQueryValidator, trendingQueryValidator, recentQueryParamValidator };
