/**
 * Seed script for DevLink backend.
 *
 * Creates:
 *   - An admin user + profile
 *   - A few demo developer users + profiles
 *   - Sample skills for each user
 *   - Sample posts
 *   - Sample communities
 *   - Sample AI tools
 *
 * Usage:
 *   node src/utils/seed.js
 *   node src/utils/seed.js --clear   (clear all data first)
 */

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { env, mongoUri } = require("../config/env");
const User = require("../models/User.model");
const Profile = require("../models/Profile.model");
const Post = require("../models/Post.model");
const Skill = require("../models/Skill.model");
const Community = require("../models/Community.model");
const AITool = require("../models/AITool.model");
const Follow = require("../models/Follow.model");
const Bookmark = require("../models/Bookmark.model");
const Notification = require("../models/Notification.model");
const Like = require("../models/Like.model");
const Comment = require("../models/Comment.model");
const Review = require("../models/Review.model");

async function connect() {
  await mongoose.connect(mongoUri);
  console.log("✅ Connected to MongoDB");
}

async function clearAll() {
  const collections = [
    Review,
    Like,
    Comment,
    Notification,
    Bookmark,
    Follow,
    Post,
    Skill,
    Profile,
    Community,
    AITool,
    User,
  ];
  for (const Model of collections) {
    await Model.deleteMany({});
    console.log(`  🗑️  Cleared ${Model.modelName}`);
  }
}

async function seed() {
  const shouldClear = process.argv.includes("--clear");
  if (shouldClear) {
    console.log("🧹 Clearing all data...");
    await clearAll();
  }

  await connect();

  // ---- Users ----
  const usersData = [
    {
      name: "Admin DevLink",
      username: "admin",
      email: "admin@devlink.io",
      password: "admin12345",
      role: "admin",
      isEmailVerified: true,
    },
    {
      name: "Jordan Ellis",
      username: "jordanellis",
      email: "jordan@devlink.io",
      password: "password123",
      role: "user",
      isEmailVerified: true,
    },
    {
      name: "Amara Patel",
      username: "amarpatel",
      email: "amara@devlink.io",
      password: "password123",
      role: "user",
      isEmailVerified: true,
    },
    {
      name: "Kenji Oda",
      username: "kenji_oda",
      email: "kenji@devlink.io",
      password: "password123",
      role: "user",
      isEmailVerified: true,
    },
    {
      name: "Sofia Vargas",
      username: "sofiavargas",
      email: "sofia@devlink.io",
      password: "password123",
      role: "user",
      isEmailVerified: true,
    },
    {
      name: "Grace Okafor",
      username: "graceokafor",
      email: "grace@devlink.io",
      password: "password123",
      role: "user",
      isEmailVerified: true,
    },
  ];

  const createdUsers = [];
  for (const userData of usersData) {
    const existing = await User.findOne({ email: userData.email });
    if (existing) {
      console.log(`  ⏭️  User ${userData.email} already exists`);
      createdUsers.push(existing);
      continue;
    }
    const user = await User.create(userData);
    createdUsers.push(user);
    console.log(`  👤 Created user: ${user.name} (@${user.username})`);
  }

  // ---- Profiles ----
  const profilesData = [
    {
      user: createdUsers[1]._id, // jordanellis
      headline: "Full-Stack Engineer",
      company: "Open to opportunities",
      location: "Remote",
      bio: "Building side projects and looking for interesting collaborations.",
      about: "I'm a full-stack engineer with a passion for building developer tools and community platforms.",
      experience: { level: "Mid-level", years: 3 },
      openToWork: true,
      openToCollab: true,
      links: {
        github: "jordanellis",
        website: "jordan.dev",
        twitter: "jordan_dev",
        linkedin: "jordanellis",
      },
      pinnedRepo: "personal-site",
      skills: [],
    },
    {
      user: createdUsers[2]._id, // amarpatel
      headline: "Backend Engineer",
      company: "Stripe",
      location: "San Francisco, CA",
      bio: "Distributed systems and database scaling.",
      about: "Working on payment infrastructure and distributed systems.",
      experience: { level: "Senior", years: 6 },
      openToWork: false,
      openToCollab: true,
      links: { github: "amarpatel", website: "amara.dev" },
      pinnedRepo: "ledger-migration",
      skills: [],
    },
    {
      user: createdUsers[3]._id, // kenji_oda
      headline: "Frontend Engineer",
      company: "Framer",
      location: "Tokyo, JP",
      bio: "Building motion-primitives and animation libraries.",
      about: "Creator of motion-primitives. Passionate about smooth UI and performance.",
      experience: { level: "Senior", years: 5 },
      openToWork: false,
      openToCollab: true,
      links: { github: "kenji_oda", website: "kenji.dev" },
      pinnedRepo: "motion-primitives",
      skills: [],
    },
    {
      user: createdUsers[4]._id, // sofiavargas
      headline: "AI/ML Engineer",
      company: "Independent",
      location: "Austin, TX",
      bio: "Quantizing models for edge deployment.",
      about: "Working on making LLMs run on edge devices.",
      experience: { level: "Senior", years: 7 },
      openToWork: false,
      openToCollab: true,
      links: { github: "sofiavargas", website: "sofia.ai" },
      pinnedRepo: "edge-llm",
      skills: [],
    },
    {
      user: createdUsers[5]._id, // graceokafor
      headline: "Security Engineer",
      company: "Cloudflare",
      location: "Lagos, NG",
      bio: "Appsec by day, CTF player by night.",
      about: "Breaking things so you don't have to find out the hard way.",
      experience: { level: "Senior", years: 4 },
      openToWork: false,
      openToCollab: true,
      links: { github: "graceokafor", website: "grace.security" },
      pinnedRepo: "header-audit",
      skills: [],
    },
  ];

  const createdProfiles = [];
  for (const profileData of profilesData) {
    const profile = await Profile.create(profileData);
    createdProfiles.push(profile);
    console.log(`  📄 Created profile for: ${profile.user}`);
  }

  // ---- Skills ----
  const skillsData = [
    { user: createdUsers[1]._id, name: "React", category: "Framework", level: "Advanced", yearsOfExperience: 3, featured: true, order: 0 },
    { user: createdUsers[1]._id, name: "Node.js", category: "Runtime", level: "Intermediate", yearsOfExperience: 3, featured: true, order: 1 },
    { user: createdUsers[1]._id, name: "TypeScript", category: "Language", level: "Advanced", yearsOfExperience: 2, featured: true, order: 2 },
    { user: createdUsers[1]._id, name: "PostgreSQL", category: "Database", level: "Intermediate", yearsOfExperience: 2, featured: false, order: 3 },
    { user: createdUsers[2]._id, name: "Go", category: "Language", level: "Expert", yearsOfExperience: 6, featured: true, order: 0 },
    { user: createdUsers[2]._id, name: "PostgreSQL", category: "Database", level: "Advanced", yearsOfExperience: 5, featured: true, order: 1 },
    { user: createdUsers[2]._id, name: "Distributed Systems", category: "Other", level: "Advanced", yearsOfExperience: 4, featured: true, order: 2 },
    { user: createdUsers[3]._id, name: "React", category: "Framework", level: "Expert", yearsOfExperience: 5, featured: true, order: 0 },
    { user: createdUsers[3]._id, name: "TypeScript", category: "Language", level: "Advanced", yearsOfExperience: 4, featured: true, order: 1 },
    { user: createdUsers[3]._id, name: "Animation", category: "Design", level: "Expert", yearsOfExperience: 3, featured: true, order: 2 },
    { user: createdUsers[4]._id, name: "Python", category: "Language", level: "Expert", yearsOfExperience: 6, featured: true, order: 0 },
    { user: createdUsers[4]._id, name: "Machine Learning", category: "AI/ML", level: "Advanced", yearsOfExperience: 5, featured: true, order: 1 },
    { user: createdUsers[4]._id, name: "Rust", category: "Language", level: "Intermediate", yearsOfExperience: 2, featured: false, order: 2 },
    { user: createdUsers[5]._id, name: "Security", category: "Other", level: "Expert", yearsOfExperience: 4, featured: true, order: 0 },
    { user: createdUsers[5]._id, name: "Python", category: "Language", level: "Advanced", yearsOfExperience: 3, featured: true, order: 1 },
    { user: createdUsers[5]._id, name: "Go", category: "Language", level: "Intermediate", yearsOfExperience: 2, featured: false, order: 2 },
  ];

  for (const skillData of skillsData) {
    await Skill.create(skillData);
  }
  console.log(`  🛠️  Created ${skillsData.length} skills`);

  // Link skills to profiles
  const jordanSkills = await Skill.find({ user: createdUsers[1]._id });
  await Profile.findByIdAndUpdate(createdProfiles[0]._id, {
    skills: jordanSkills.map((s) => s._id),
  });

  const amaraSkills = await Skill.find({ user: createdUsers[2]._id });
  await Profile.findByIdAndUpdate(createdProfiles[1]._id, {
    skills: amaraSkills.map((s) => s._id),
  });

  const kenjiSkills = await Skill.find({ user: createdUsers[3]._id });
  await Profile.findByIdAndUpdate(createdProfiles[2]._id, {
    skills: kenjiSkills.map((s) => s._id),
  });

  const sofiaSkills = await Skill.find({ user: createdUsers[4]._id });
  await Profile.findByIdAndUpdate(createdProfiles[3]._id, {
    skills: sofiaSkills.map((s) => s._id),
  });

  const graceSkills = await Skill.find({ user: createdUsers[5]._id });
  await Profile.findByIdAndUpdate(createdProfiles[4]._id, {
    skills: graceSkills.map((s) => s._id),
  });

  // ---- Posts ----
  const postsData = [
    {
      author: createdUsers[2]._id, // amarpatel
      type: "text",
      content: "Spent the day migrating our ledger service off a single Postgres instance onto sharded writes. The hardest part wasn't the sharding logic — it was convincing myself the reconciliation job was actually idempotent.",
      hashtags: ["postgresql", "distributed-systems"],
    },
    {
      author: createdUsers[3]._id, // kenji_oda
      type: "project-update",
      content: "motion-primitives v3 is out. Rebuilt the spring physics engine from scratch — it's now 60% smaller and doesn't drop frames on low-power devices.",
      hashtags: ["react", "animation", "opensource"],
      project: null,
    },
    {
      author: createdUsers[4]._id, // sofiavargas
      type: "text",
      content: "Quantized a 7B model down to 4-bit and it still runs coherent conversations on a Raspberry Pi 5. Not fast, but it runs.",
      hashtags: ["machinelearning", "edge-ai"],
    },
    {
      author: createdUsers[5]._id, // graceokafor
      type: "text",
      content: "PSA: if your API keys are in a public repo's commit history, deleting the file doesn't help. Rotate the key.",
      hashtags: ["security", "appsec"],
    },
    {
      author: createdUsers[1]._id, // jordanellis
      type: "text",
      content: "Just finished wiring up the DevLink frontend to the backend API. The cursor pagination pattern is elegant — no more OFFSET headaches.",
      hashtags: ["webdev", "api", "react"],
    },
  ];

  const createdPosts = [];
  for (const postData of postsData) {
    const post = await Post.create(postData);
    createdPosts.push(post);
    // Increment the author's postsCount
    await Profile.findOneAndUpdate(
      { user: postData.author },
      { $inc: { postsCount: 1 } }
    );
  }
  console.log(`  📝 Created ${createdPosts.length} posts`);

  // ---- Follows ----
  // jordan follows amara, kenji, sofia, grace
  const followsData = [
    { follower: createdUsers[1]._id, following: createdUsers[2]._id }, // jordan -> amara
    { follower: createdUsers[1]._id, following: createdUsers[3]._id }, // jordan -> kenji
    { follower: createdUsers[1]._id, following: createdUsers[4]._id }, // jordan -> sofia
    { follower: createdUsers[1]._id, following: createdUsers[5]._id }, // jordan -> grace
    { follower: createdUsers[2]._id, following: createdUsers[1]._id }, // amara -> jordan
    { follower: createdUsers[3]._id, following: createdUsers[1]._id }, // kenji -> jordan
  ];

  for (const followData of followsData) {
    await Follow.create(followData);
  }
  // Update follower/following counts
  await Profile.findOneAndUpdate({ user: createdUsers[1]._id }, { $inc: { followingCount: 4, followersCount: 2 } });
  await Profile.findOneAndUpdate({ user: createdUsers[2]._id }, { $inc: { followersCount: 1, followingCount: 1 } });
  await Profile.findOneAndUpdate({ user: createdUsers[3]._id }, { $inc: { followersCount: 1, followingCount: 1 } });
  await Profile.findOneAndUpdate({ user: createdUsers[4]._id }, { $inc: { followersCount: 1 } });
  await Profile.findOneAndUpdate({ user: createdUsers[5]._id }, { $inc: { followersCount: 1 } });
  console.log(`  👥 Created ${followsData.length} follows`);

  // ---- Communities ----
  const communitiesData = [
    {
      name: "Frontend Craft",
      slug: "frontend-craft",
      description: "A community for frontend engineers to share techniques, tools, and tricks.",
      topics: ["frontend", "react", "css"],
      creator: createdUsers[3]._id, // kenji_oda
      rules: ["Be respectful", "Share real code", "No self-promotion without context"],
      membersCount: 1,
      visibility: "public",
    },
    {
      name: "Backend Builders",
      slug: "backend-builders",
      description: "Discussions about backend architecture, databases, and infrastructure.",
      topics: ["backend", "database", "infrastructure"],
      creator: createdUsers[2]._id, // amara_patel
      rules: ["Be respectful", "Cite sources when sharing benchmarks"],
      membersCount: 1,
      visibility: "public",
    },
    {
      name: "Security First",
      slug: "security-first",
      description: "Application security discussions, CTF writeups, and vulnerability research.",
      topics: ["security", "appsec", "ctf"],
      creator: createdUsers[5]._id, // graceokafor
      rules: ["No exploit sharing without context", "Be responsible"],
      membersCount: 1,
      visibility: "public",
    },
  ];

  for (const communityData of communitiesData) {
    await Community.create(communityData);
  }
  console.log(`  🌐 Created ${communitiesData.length} communities`);

  // ---- AI Tools ----
  const adminUser = createdUsers[0]; // admin
  const aiToolsData = [
    {
      name: "Vercel",
      slug: "vercel",
      tagline: "Develop, preview, and ship with the best frontend developer experience.",
      description: "The platform for frontend developers to build, deploy, and host with confidence.",
      category: "Deployment",
      pricing: "Freemium",
      websiteUrl: "https://vercel.com",
      tags: ["frontend", "deployment", "hosting"],
      ratingAvg: 4.8,
      reviewsCount: 1200,
      featured: true,
      submittedBy: adminUser._id,
    },
    {
      name: "Framer",
      slug: "framer",
      tagline: "The interactive design tool for modern teams.",
      description: "Design, prototype, and collaborate with real code components.",
      category: "Design",
      pricing: "Freemium",
      websiteUrl: "https://framer.com",
      tags: ["design", "prototyping", "ui"],
      ratingAvg: 4.6,
      reviewsCount: 890,
      featured: true,
      submittedBy: adminUser._id,
    },
    {
      name: "GitHub Copilot",
      slug: "github-copilot",
      tagline: "Your AI pair programmer.",
      description: "AI-powered code completion and suggestions across dozens of languages.",
      category: "AI Assistant",
      pricing: "Paid",
      websiteUrl: "https://github.com/features/copilot",
      tags: ["ai", "coding", "autocomplete"],
      ratingAvg: 4.5,
      reviewsCount: 2300,
      featured: true,
      submittedBy: adminUser._id,
    },
    {
      name: "Cloudflare",
      slug: "cloudflare",
      tagline: "Web infrastructure and security for developers.",
      description: "CDN, DNS, DDoS protection, and edge computing platform.",
      category: "Infrastructure",
      pricing: "Freemium",
      websiteUrl: "https://cloudflare.com",
      tags: ["infrastructure", "cdn", "security"],
      ratingAvg: 4.7,
      reviewsCount: 1500,
      featured: true,
      submittedBy: adminUser._id,
    },
    {
      name: "Supabase",
      slug: "supabase",
      tagline: "Database, auth, and backend for your frontend.",
      description: "Open-source Firebase alternative with PostgreSQL, auth, and real-time subscriptions.",
      category: "Backend",
      pricing: "Freemium",
      websiteUrl: "https://supabase.com",
      tags: ["backend", "database", "auth"],
      ratingAvg: 4.6,
      reviewsCount: 980,
      featured: false,
      submittedBy: adminUser._id,
    },
  ];

  for (const toolData of aiToolsData) {
    await AITool.create(toolData);
  }
  console.log(`  🤖 Created ${aiToolsData.length} AI tools`);

  // ---- Reviews ----
  const aiTool = await AITool.findOne({ slug: "github-copilot" });
  if (aiTool) {
    await Review.create({
      aiTool: aiTool._id,
      user: createdUsers[1]._id,
      rating: 5,
      content: "Incredibly productive — Copilot has cut my boilerplate time in half. The autocomplete is uncannily accurate for common patterns.",
      isVerified: true,
    });
    await AITool.findByIdAndUpdate(aiTool._id, {
      $inc: { reviewsCount: 1 },
    });
  }

  console.log("\n✅ Seed complete!");
  console.log(`   Users: ${createdUsers.length}`);
  console.log(`   Profiles: ${createdProfiles.length}`);
  console.log(`   Skills: ${skillsData.length}`);
  console.log(`   Posts: ${createdPosts.length}`);
  console.log(`   Follows: ${followsData.length}`);
  console.log(`   Communities: ${communitiesData.length}`);
  console.log(`   AI Tools: ${aiToolsData.length}`);
  console.log("\n📝 Demo credentials:");
  console.log("   Admin: admin@devlink.io / admin12345");
  console.log("   User:  jordan@devlink.io / password123");
  console.log("   User:  amara@devlink.io / password123");
}

seed()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(() => {
    mongoose.disconnect();
  });
