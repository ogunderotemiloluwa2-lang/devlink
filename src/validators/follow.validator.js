const { param, query } = require("express-validator");

const usernameParamValidator = [param("username").trim().notEmpty().withMessage("Username is required")];

const paginationValidator = [
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
];

const suggestionsQueryValidator = [query("limit").optional().isInt({ min: 1, max: 30 })];

module.exports = { usernameParamValidator, paginationValidator, suggestionsQueryValidator };
