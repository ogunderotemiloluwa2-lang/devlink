const { body, query, param } = require("express-validator");
const Profile = require("../models/Profile.model");

const updateProfileValidator = [
  body("headline").optional().trim().isLength({ max: 120 }).withMessage("Headline must be under 120 characters"),
  body("company").optional().trim().isLength({ max: 120 }).withMessage("Company must be under 120 characters"),
  body("location").optional().trim().isLength({ max: 120 }).withMessage("Location must be under 120 characters"),
  body("country").optional().trim().isLength({ max: 80 }).withMessage("Country must be under 80 characters"),
  body("bio").optional().trim().isLength({ max: 500 }).withMessage("Bio must be under 500 characters"),
  body("about").optional().trim().isLength({ max: 2000 }).withMessage("About must be under 2000 characters"),
  body("pinnedRepo").optional().trim().isLength({ max: 120 }),

  body("experience.level")
    .optional()
    .isIn(Profile.schema.path("experience.level").enumValues)
    .withMessage("Invalid experience level"),
  body("experience.years").optional().isInt({ min: 0, max: 60 }).withMessage("Years must be between 0 and 60"),

  body("links.github").optional({ checkFalsy: true }).trim().isURL().withMessage("GitHub link must be a valid URL"),
  body("links.website").optional({ checkFalsy: true }).trim().isURL().withMessage("Website link must be a valid URL"),
  body("links.portfolio").optional({ checkFalsy: true }).trim().isURL().withMessage("Portfolio link must be a valid URL"),
  body("links.twitter").optional({ checkFalsy: true }).trim().isURL().withMessage("Twitter link must be a valid URL"),
  body("links.linkedin").optional({ checkFalsy: true }).trim().isURL().withMessage("LinkedIn link must be a valid URL"),

  body("openToWork").optional().isBoolean().withMessage("openToWork must be true or false"),
  body("openToCollab").optional().isBoolean().withMessage("openToCollab must be true or false"),
  body("visibility").optional().isIn(["public", "private"]).withMessage("Visibility must be public or private"),
];

const updateUsernameValidator = [
  body("username")
    .trim()
    .toLowerCase()
    .matches(/^[a-z0-9_]{3,30}$/)
    .withMessage("Username must be 3-30 characters: lowercase letters, numbers, underscores only"),
];

const usernameParamValidator = [param("username").trim().notEmpty().withMessage("Username is required")];

const listProfilesValidator = [
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("openToWork").optional().isBoolean(),
];

module.exports = {
  updateProfileValidator,
  updateUsernameValidator,
  usernameParamValidator,
  listProfilesValidator,
};
