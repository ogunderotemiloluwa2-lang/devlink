const { validationResult } = require("express-validator");
const ApiError = require("../utils/ApiError");

// Runs after an array of express-validator chains; collects all failures
// into a single ApiError so every validation error uses the same response shape.
function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  const details = errors.array().map((e) => ({ field: e.path, message: e.msg }));
  next(ApiError.badRequest("Validation failed", details));
}

module.exports = validate;
