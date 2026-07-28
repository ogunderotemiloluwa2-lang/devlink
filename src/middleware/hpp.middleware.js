/**
 * Custom HTTP Parameter Pollution (HPP) middleware.
 * Replaces the deprecated/broken `hpp` package.
 * When a query string contains duplicate keys, this keeps only the last value
 * (or first value, depending on preference) to prevent parameter pollution.
 */
function hppMiddleware(req, res, next) {
  if (req.query) {
    const cleanQuery = {};
    for (const [key, value] of Object.entries(req.query)) {
      // If value is an array (duplicate keys), take the last value
      if (Array.isArray(value)) {
        cleanQuery[key] = value[value.length - 1];
      } else {
        cleanQuery[key] = value;
      }
    }
    req.query = cleanQuery;
  }
  next();
}

module.exports = hppMiddleware;
