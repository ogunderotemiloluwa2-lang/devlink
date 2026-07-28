const { body, param, query } = require("express-validator");
const Skill = require("../models/Skill.model");

const createSkillValidator = [
  body("name").trim().notEmpty().withMessage("Skill name is required").isLength({ max: 60 }),
  body("category").optional().isIn(Skill.CATEGORIES).withMessage("Invalid skill category"),
  body("level").optional().isIn(Skill.LEVELS).withMessage("Invalid skill level"),
  body("yearsOfExperience").optional().isFloat({ min: 0, max: 60 }),
  body("featured").optional().isBoolean(),
];

const updateSkillValidator = [
  param("id").isMongoId().withMessage("Invalid skill id"),
  body("name").optional().trim().isLength({ min: 1, max: 60 }),
  body("category").optional().isIn(Skill.CATEGORIES).withMessage("Invalid skill category"),
  body("level").optional().isIn(Skill.LEVELS).withMessage("Invalid skill level"),
  body("yearsOfExperience").optional().isFloat({ min: 0, max: 60 }),
  body("featured").optional().isBoolean(),
  body("order").optional().isInt(),
];

const skillIdValidator = [param("id").isMongoId().withMessage("Invalid skill id")];

const catalogQueryValidator = [query("q").optional().trim().isLength({ min: 1, max: 60 })];

module.exports = {
  createSkillValidator,
  updateSkillValidator,
  skillIdValidator,
  catalogQueryValidator,
};
