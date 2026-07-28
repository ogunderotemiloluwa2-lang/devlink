const Skill = require("../models/Skill.model");
const Profile = require("../models/Profile.model");
const User = require("../models/User.model");
const catchAsync = require("../utils/catchAsync");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");

async function syncProfileSkillRef(userId, skillId, action) {
  const update = action === "add" ? { $addToSet: { skills: skillId } } : { $pull: { skills: skillId } };
  await Profile.findOneAndUpdate({ user: userId }, update);
}

/**
 * GET /skills (authenticated) — the current user's own skills
 * Query: category, level, featured
 */
const getMySkills = catchAsync(async (req, res) => {
  const { category, level, featured } = req.query;
  const filter = { user: req.user._id };
  if (category) filter.category = category;
  if (level) filter.level = level;
  if (featured !== undefined) filter.featured = featured === "true";

  const skills = await Skill.find(filter).sort({ featured: -1, order: 1, createdAt: -1 });
  return new ApiResponse(200, { skills }, "Skills fetched").send(res);
});

/**
 * GET /profiles/:username/skills (public)
 */
const getUserSkills = catchAsync(async (req, res) => {
  const username = req.params.username.trim().toLowerCase();
  const user = await User.findOne({ username, status: "active" });
  if (!user) throw ApiError.notFound("User not found");

  const skills = await Skill.find({ user: user._id }).sort({ featured: -1, order: 1, createdAt: -1 });
  return new ApiResponse(200, { skills }, "Skills fetched").send(res);
});

/**
 * POST /skills (authenticated)
 */
const createSkill = catchAsync(async (req, res) => {
  const { name, category, level, yearsOfExperience, featured } = req.body;

  const slug = name.trim().toLowerCase();
  const existing = await Skill.findOne({ user: req.user._id, slug });
  if (existing) throw ApiError.conflict("You already have this skill on your profile");

  const skill = await Skill.create({
    user: req.user._id,
    name: name.trim(),
    category,
    level,
    yearsOfExperience,
    featured: !!featured,
  });

  await syncProfileSkillRef(req.user._id, skill._id, "add");

  return new ApiResponse(201, { skill }, "Skill added").send(res);
});

/**
 * PATCH /skills/:id (authenticated, owner only)
 */
const updateSkill = catchAsync(async (req, res) => {
  const skill = await Skill.findById(req.params.id);
  if (!skill) throw ApiError.notFound("Skill not found");
  if (!skill.user.equals(req.user._id)) throw ApiError.forbidden("You can only edit your own skills");

  const { name, category, level, yearsOfExperience, featured, order } = req.body;

  if (name !== undefined) {
    const slug = name.trim().toLowerCase();
    if (slug !== skill.slug) {
      const duplicate = await Skill.findOne({ user: req.user._id, slug, _id: { $ne: skill._id } });
      if (duplicate) throw ApiError.conflict("You already have this skill on your profile");
    }
    skill.name = name.trim();
  }
  if (category !== undefined) skill.category = category;
  if (level !== undefined) skill.level = level;
  if (yearsOfExperience !== undefined) skill.yearsOfExperience = yearsOfExperience;
  if (featured !== undefined) skill.featured = featured;
  if (order !== undefined) skill.order = order;

  await skill.save();

  return new ApiResponse(200, { skill }, "Skill updated").send(res);
});

/**
 * DELETE /skills/:id (authenticated, owner only)
 */
const deleteSkill = catchAsync(async (req, res) => {
  const skill = await Skill.findById(req.params.id);
  if (!skill) throw ApiError.notFound("Skill not found");
  if (!skill.user.equals(req.user._id)) throw ApiError.forbidden("You can only delete your own skills");

  await skill.deleteOne();
  await syncProfileSkillRef(req.user._id, skill._id, "remove");

  return new ApiResponse(200, null, "Skill removed").send(res);
});

/**
 * GET /skills/catalog?q= (public) — autocomplete suggestions across all users
 */
const getSkillCatalog = catchAsync(async (req, res) => {
  const { q } = req.query;
  const filter = q ? { slug: new RegExp(`^${q.trim().toLowerCase()}`, "i") } : {};

  const results = await Skill.aggregate([
    { $match: filter },
    { $group: { _id: "$slug", name: { $first: "$name" }, category: { $first: "$category" }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 15 },
    { $project: { _id: 0, name: 1, category: 1, count: 1 } },
  ]);

  return new ApiResponse(200, { suggestions: results }, "Catalog fetched").send(res);
});

/**
 * GET /skills/meta — enum values for level/category, used to build form selects
 */
const getSkillMeta = catchAsync(async (req, res) => {
  return new ApiResponse(200, { levels: Skill.LEVELS, categories: Skill.CATEGORIES }, "Skill metadata fetched").send(res);
});

module.exports = {
  getMySkills,
  getUserSkills,
  createSkill,
  updateSkill,
  deleteSkill,
  getSkillCatalog,
  getSkillMeta,
};
