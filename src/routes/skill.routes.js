const express = require("express");
const skillController = require("../controllers/skill.controller");
const { protect } = require("../middleware/auth.middleware");
const validate = require("../middleware/validate.middleware");
const {
  createSkillValidator,
  updateSkillValidator,
  skillIdValidator,
  catalogQueryValidator,
} = require("../validators/skill.validator");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Skills
 *   description: A developer's tech-stack entries (level, years of experience, featured)
 */

/**
 * @swagger
 * /skills/meta:
 *   get:
 *     summary: Get available skill levels and categories
 *     tags: [Skills]
 *     responses:
 *       200: { description: Metadata fetched }
 */
router.get("/meta", skillController.getSkillMeta);

/**
 * @swagger
 * /skills/catalog:
 *   get:
 *     summary: Autocomplete skill suggestions across all users
 *     tags: [Skills]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *     responses:
 *       200: { description: Suggestions fetched }
 */
router.get("/catalog", catalogQueryValidator, validate, skillController.getSkillCatalog);

/**
 * @swagger
 * /skills:
 *   get:
 *     summary: Get the authenticated user's skills
 *     tags: [Skills]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: level
 *         schema: { type: string }
 *       - in: query
 *         name: featured
 *         schema: { type: boolean }
 *     responses:
 *       200: { description: Skills fetched }
 *   post:
 *     summary: Add a new skill to the authenticated user's profile
 *     tags: [Skills]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: TypeScript }
 *               category: { type: string, example: Language }
 *               level: { type: string, example: Advanced }
 *               yearsOfExperience: { type: number, example: 4 }
 *               featured: { type: boolean }
 *     responses:
 *       201: { description: Skill added }
 *       409: { description: Skill already exists on this profile }
 */
router.get("/", protect, skillController.getMySkills);
router.post("/", protect, createSkillValidator, validate, skillController.createSkill);

/**
 * @swagger
 * /skills/{id}:
 *   patch:
 *     summary: Update one of the authenticated user's skills
 *     tags: [Skills]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Skill updated }
 *       403: { description: Not the owner of this skill }
 *   delete:
 *     summary: Remove one of the authenticated user's skills
 *     tags: [Skills]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Skill removed }
 */
router.patch("/:id", protect, updateSkillValidator, validate, skillController.updateSkill);
router.delete("/:id", protect, skillIdValidator, validate, skillController.deleteSkill);

module.exports = router;
