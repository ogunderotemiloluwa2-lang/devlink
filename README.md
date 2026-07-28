# DevLink Backend

Production REST API for DevLink, built incrementally in phases. This phase covers the foundation: server setup, security middleware, database connection, error handling, and complete authentication.

## Stack

Node.js · Express.js (JavaScript, no TypeScript) · MongoDB + Mongoose · JWT · Socket.IO · Cloudinary · Multer · Nodemailer · Redis (optional) · Swagger

## Getting started

```bash
cp .env.example .env   # fill in real secrets/credentials
npm install
npm run dev             # nodemon, http://localhost:5000
```

- API docs: `http://localhost:5000/api-docs`
- Health check: `GET /api/v1/health`

MongoDB and Redis are not bundled — point `MONGO_URI` at a running instance (local or Atlas). Redis is optional; leave `REDIS_URL` blank and the app runs fine without it (`src/config/redis.js` no-ops safely).

## Architecture

```
src/
  config/       env, MongoDB, Cloudinary, Redis (all environment-driven)
  models/       Mongoose schemas
  controllers/  request handlers (thin — business logic only)
  routes/       Express routers + Swagger JSDoc annotations
  middleware/   auth, error handling, validation, rate limiting
  services/     email, and other cross-cutting integrations
  utils/        ApiError, ApiResponse, JWT helpers, logger, catchAsync
  sockets/      Socket.IO setup (expanded in the messaging phase)
  docs/         swagger.js — OpenAPI config generated from route JSDoc
  validators/   express-validator chains per resource
  app.js        Express app: security middleware, routes, error handlers
  server.js     entrypoint — connects DB, starts HTTP + Socket.IO server
```

### Conventions
- Every response uses the same envelope: `{ success, statusCode, message, data }`. See `utils/ApiResponse.js`.
- Every error — validation, Mongoose, JWT, Multer, or thrown manually — is normalized to the same shape by `middleware/error.middleware.js`.
- Route handlers are wrapped in `catchAsync` so no controller needs a try/catch.
- Auth uses short-lived JWT access tokens (returned in the response body, sent as `Authorization: Bearer <token>`) plus a long-lived refresh token stored in an httpOnly cookie scoped to `/api/v1/auth`. `refreshTokenVersion` on the User model lets us invalidate all refresh tokens at once (password change, "log out everywhere").

## Phase 1 — done ✅
- Project scaffolding, security middleware (helmet, cors, mongo-sanitize, xss-clean, hpp, rate limiting), centralized error handling
- `User` + `Profile` models
- Full auth flow: register, login, JWT access/refresh, email verification, resend verification, forgot/reset password, change password, logout / logout-all
- Nodemailer email service with verification/reset/password-changed templates
- Swagger scaffolding wired up and documenting the auth routes

## Phase 2 — done ✅
- `Skill` model (per-user tech-stack entries: category, level, years of experience, featured, order) — additive fields on `Profile` (about, country, experience, visibility, resume, portfolio link)
- Profile APIs: get/update own profile, change username (+ availability check), public profile by username (visibility-aware, tracks profile views), browse/search/filter developer directory (`q`, `skill`, `location`, `openToWork`, pagination, sort)
- Skill APIs: full CRUD scoped to the owner, public skills-by-username, autocomplete catalog aggregated across all users, level/category metadata endpoint
- Cloudinary integration via a reusable buffer-upload service (`services/cloudinary.service.js`) + Multer memory-storage middleware with mime/size validation — avatar, cover image, and resume (PDF) upload/delete, with automatic cleanup of the previous asset
- Reusable pagination helper (`utils/pagination.js`) now used everywhere lists are returned
- Swagger docs for every new route

## Phase 3 — done ✅
- `Post` model: text/project-update/poll/image/video/link/code types, embedded media, code snippets, link previews, polls with voting, reposts/quote-reposts, hashtags, mentions, denormalized counts
- `Comment` model: two-tier threading (top-level comments + one level of replies)
- `Like` model: polymorphic across Post/Comment via `targetType`/`targetId`, unique per (user, target)
- `Bookmark` model: saved posts with optional named collections
- Post APIs: create (with optional multi-image upload), cursor-paginated `/feed` (infinite scroll), `/trending` (engagement-decay scoring), hashtag browsing + trending hashtags, per-user posts, get/update/delete (cascades comments/likes/bookmarks + Cloudinary cleanup), like/unlike, bookmark/unbookmark, poll voting
- Comment APIs: list top-level + replies, create (with reply depth guard), edit, delete (cascades replies), like/unlike
- Bookmark APIs: list saved posts (filterable by collection), list collection names
- Shared `services/like.service.js` used by both posts and comments so like logic isn't duplicated
- `utils/textParsing.js` — hashtag extraction + mention resolution against real active users
- `utils/cursorPagination.js` — stable cursor pagination for the main feed (offset pagination still used for secondary lists)
- Every list endpoint returns `isLiked`/`isBookmarked` flags for the authenticated viewer without N+1 queries (batched Like/Bookmark lookups)
- Swagger docs for every new route

## Phase 4 — done ✅
- `Follow` model: directed relationship, unique per (follower, following)
- Follow APIs: follow/unfollow (self-follow blocked, idempotent), followers/following lists (with `isFollowing` computed for the viewer), mutual connections between viewer and any user, suggested developers
- **Suggestion algorithm** (`GET /follow/suggestions`), layered so it degrades gracefully for brand-new accounts with no graph yet:
  1. 2nd-degree connections — accounts followed by people you follow, ranked by overlap count
  2. Shared skills — accounts with overlapping tech-stack entries, ranked by overlap count
  3. Popularity fallback — highest-`followersCount` public profiles, used to fill remaining slots
- **Promise kept from Phase 3**: `GET /posts/feed` now accepts `?mode=following` to restrict the feed to people you follow (plus your own posts); default stays the global feed so nothing existing breaks
- **Promise kept from Phase 2**: public profile responses (`GET /profiles/:username`) and the developer directory (`GET /profiles`) now include an `isFollowing` flag for authenticated viewers, computed with batched queries (no N+1)
- `Profile.followersCount`/`followingCount` (already on the model since Phase 1) are now actually maintained on every follow/unfollow
- Swagger docs for every new route

## Phase 5 — done ✅
- `Community` model: slug (auto-generated + collision-safe), topics, rules, avatar/banner, visibility (public/private), member/post counts
- `CommunityMember` model: join table with `admin`/`moderator`/`member` roles, unique per (community, user)
- Additive `Post` field: `isAnnouncement` (pairs with the existing `isPinned` from Phase 3 — announcements are auto-pinned)
- Community APIs: create (creator auto-becomes admin), search/browse (`q`, `topic`, sort, paginated, `isMember`/`viewerRole` for authenticated viewers), get/edit/delete, avatar/banner upload via Cloudinary
- Membership APIs: join/leave (creator is blocked from leaving — must transfer or delete instead), list members (filterable by role), promote/demote a member's role (admin only, creator's admin role is protected), remove a member (moderators can only remove regular members, not other mods/admins)
- Community posts: reuses the existing `Post` model's `community` field from Phase 3 — list (pinned-first), create (membership required; announcements require moderator+), toggle pin (moderator+). Liking/commenting/bookmarking a community post is already covered by the generic `/posts/:id/*` routes from Phase 3 — no duplicated logic.
- Consistency fixes carried back into Phase 3: deleting a post now decrements `Community.postsCount` when applicable; posting in a community now increments the author's `Profile.postsCount` just like a normal post
- Swagger docs for every new route

## Phase 6 — done ✅
- `Project` model: slug, tagline/description, stack, `rolesNeeded` (constrained to the 6 collaboration roles), stage (Idea → Archived), repo/live URLs, cover image, visibility, denormalized counts (`membersCount`, `starsCount`, `tasksCount`, `openTasksCount`)
- `ProjectMember` model: unified role field — one of the 6 collaboration roles (`Frontend`, `Backend`, `Full Stack`, `UI Designer`, `DevOps`, `AI Engineer`) or `Owner`; status lifecycle `pending → accepted/rejected`, plus `left`/`removed`
- `ProjectTask` model: simple Kanban-style board (`todo`/`in-progress`/`done`), assignee, due date, order
- `ProjectDiscussionMessage` model: a project-scoped discussion thread, separate from the main feed (unlike community posts, which reuse `Post` — a project's internal discussion is deliberately private-feeling and not part of the public feed/hashtag system)
- `ProjectFile` model: dedicated collection (not embedded) for attachments — images get Cloudinary's image pipeline, everything else (zips, docs, code) goes through the raw pipeline via a new mime-aware `uploadProjectFile` helper
- Reused the Phase 3 `Like` model for **starring** (`targetType: "Project"`) — generalized `like.service.toggleLike` to accept a `countField` so it can increment `starsCount` instead of `likesCount`, while keeping the exact same response shape for the existing Post/Comment endpoints (verified no breaking change)
- Full CRUD + cover image upload, invite/accept/reject/leave, member management (owner-only role changes, owner can't be removed or leave without deleting), tasks, discussion, and files — all permission-checked per role
- Swagger docs for every new route

## Phase 8 — done ✅ (built out of order — see note below)
> **Sequencing note:** the original phase order is Profiles(2) → Feed(3) → Follow(4) → Communities(5) → Collaboration Hub(6) → **AI Hub(7)** → **Messaging(8)** → Notifications(9) → Search(10)...
> I skipped Phase 7 (AI Hub) and built Phase 8 (Messaging) first — a real sequencing mistake on my part, not intentional reordering. The messaging work itself is complete and correct (verified below), so rather than throw it away I'm keeping it and building **Phase 7 (AI Hub) next** to fill the gap. From here on, phase numbers in this README match the original spec exactly.

- `Conversation` model: direct + group chats, embedded participant state (role, status, `unreadCount`, `lastReadAt`) for O(1) unread badges with no extra query, denormalized `lastMessage` preview, dedicated `lastActivityAt` (bumped only on new messages, so marking a thread "read" doesn't reorder the conversation list)
- `Message` model: text and/or up to 5 attachments (image/file/audio/video — audio/video share Cloudinary's video pipeline and carry a `duration` field, so voice messages are fully supported at the data layer), replies, per-user reactions (one active reaction per user, re-sending the same emoji clears it), read receipts, edit/soft-delete
- Conversation APIs: create (direct chats dedupe automatically — starting a second conversation with the same person returns the existing one), cursor-paginated list with online-presence flags, group management (name/avatar, add/remove participants, admin-only, auto-promotes a new admin if the last one leaves), mark-as-read, total unread count badge
- Message APIs: cursor-paginated history (loads older messages, returned oldest-first for natural rendering), send (multipart, text and/or attachments, optional reply-to), edit, delete-for-everyone (soft delete + Cloudinary cleanup), react
- **Socket.IO fully wired**: `sockets/index.js` (a Phase 1 placeholder, now filled in as originally planned) handles authenticated connections and online presence — scoped only to users who actually share a conversation, not a global broadcast; `sockets/chat.socket.js` handles room join/leave and typing indicators. Message send/edit/delete/reaction/read-receipt events are emitted from the REST controllers after a successful DB write (`req.app.get("io")`), so there's one source of truth and the socket layer can never drift from the database
- Presence tracked via a documented in-memory service (`presence.service.js`) — correct for a single instance, with an explicit note that multi-instance deployment needs a shared store (flagged as Phase 14 scope, not silently ignored)
- **Bug caught and fixed during this phase**: `getParticipant`/`isActiveParticipant` compared `participant.user.toString()`, which is correct for an unpopulated ObjectId but silently broken once `.populate("participants.user")` runs (a populated Mongoose document's `.toString()` doesn't return its id). Fixed with an `idOf()` helper that handles both cases; verified the fix against every call site
- Generalized `utils/cursorPagination.js` to accept a sort field (default `createdAt`, unchanged for existing callers) so conversations can paginate by `lastActivityAt` while posts keep using `createdAt`
- Swagger docs for every new route

## Phase 7 — done ✅ (filling the gap from the sequencing mistake above)
- `AITool` model: name/slug, free-text category (an enum would fight reality in a fast-moving space — `/ai-tools/categories` exposes distinct values actually in use for filter UIs instead), pricing (Free/Freemium/Paid), tags, submitter, denormalized `ratingAvg`/`reviewsCount`/`bookmarksCount`/`viewsCount`, `featured` flag (editorial, admin/moderator-only to set)
- `Review` model: 1-5 rating + optional written review, one per user per tool (resubmitting is an edit, not a duplicate)
- Reused the Phase 6 generalized `Like`/toggle infrastructure twice more: tool bookmarking (`targetType: "AITool"`, counts into `bookmarksCount`) and review "helpful" voting (`targetType: "Review"`, counts into `helpfulCount`) — no new toggle logic written, just two more target types on the same polymorphic model
- `aiTool.service.js` recomputes `ratingAvg`/`reviewsCount` via aggregation after every review create/update/delete, rather than incremental running-average math that could drift
- Tool APIs: submit (any authenticated user), search/filter (`q`, `category`, `pricing`, `tag`, `featured`, sort), categories, featured, trending (recent review velocity + bookmarks + rating, age-decayed — same shape as the Phase 3 post-trending algorithm), get/edit/delete (submitter or platform admin), logo upload, bookmark toggle
- Review APIs: list, create, edit own, delete (author or platform admin), helpful-vote toggle
- Cascade cleanup on delete: deleting a tool removes its reviews and all associated `Like` records (bookmarks + helpful votes); deleting a single review cleans up its helpful-vote likes too
- Swagger docs for every new route

## Phase 9 — done ✅
- `Notification` model: `recipient`/`actor` (nullable, for system notifications), 9 types matching the spec exactly (`follow`, `like`, `comment`, `reply`, `mention`, `project_invite`, `community_invite`, `message`, `system`), polymorphic `entityType`/`entityId` for deep-linking, read state
- `notification.service.js` — the single place every trigger calls through: `createNotification()` (skips self-notifications, respects per-type preferences, persists, then emits `notification:new` over the recipient's personal socket room) and `createOrTouchMessageNotification()` (throttled — refreshes one unread row per conversation instead of spamming a new notification per message)
- **Wired into every existing trigger point**, not just built and left dangling:
  - Follow → new-follower notification
  - Post/comment like → like notification to the content's author
  - New comment → comment notification to the post author; new reply → reply notification to the parent comment's author (deduped if they're the same person)
  - `@mentions` in posts and comments → mention notifications, reusing the Phase 3 mention-resolution logic
  - Project invite → project_invite notification
  - **Community invite is a new feature added in this phase** — communities were join-only before (Phase 5 had no invite concept), so I extended `CommunityMember.status` with an `invited` state and added `POST /communities/:slug/invite` + `GET /communities/invites/mine`, mirroring the existing Project invite pattern. `joinCommunity` now also accepts a pending invite.
  - New message → throttled message notification (skipped entirely for read participants who are actively viewing — the existing unread-count/socket push already covers that case)
- Notification preferences live on `Profile.notificationPreferences` (additive field) — per-type opt-out, checked before every notification is created; `system` notifications are deliberately never gated
- Notification APIs: list (filterable by type/read state), unread count, mark-one-read, mark-all-read, delete-one, clear (all or read-only), get/update preferences
- Swagger docs for every new route

## Phase 10 — done ✅
- `Search` model: lightweight query log (`user` nullable for anonymous searches, `query`), with a **TTL index auto-expiring entries after 90 days** so the collection never grows unbounded
- Combined search: `GET /search?q=` — small per-category limit (default 5) across all seven content types in parallel, shaped for a command-palette-style "search everything" UI
- Per-type paginated search: `/search/developers`, `/projects`, `/communities`, `/posts`, `/tools`, `/skills`, `/companies` — same query logic as the combined endpoint, just with full pagination for a dedicated results page
- Skills and companies aren't separate searchable collections — they're aggregated directly from `Skill`/`Profile` (grouped by slug/company name with counts), consistent with how the Phase 2 skill catalog autocomplete already worked
- Recent searches: per-user history via aggregation (`GET /search/recent`), delete-one/clear-all
- Trending searches: `GET /search/trending` — aggregated across all users in a configurable window, with a minimum-count-of-2 threshold so a single one-off query doesn't show up as "trending" noise
- Search recording is fire-and-forget (`recordSearch()` never blocks or fails the actual search response) and happens on every search call, typed or combined
- Swagger docs for every new route

## Phase 11 — done ✅ (consolidation/audit pass, not new endpoints)
Cloudinary/Multer was built incrementally into every phase (avatars, covers, resumes, community avatars/banners, project covers/files, message attachments, AI tool logos), so this phase audited that work holistically instead of inventing a parallel file system:

- **Gap found and fixed**: 4 of the 8 image-upload paths (community avatar, community banner, project cover, group avatar, AI tool logo — 5 actually) had no DELETE/remove counterpart, only Profile's avatar/cover/resume did. Added `deleteCommunityAvatar`, `deleteCommunityBanner`, `deleteProjectCover`, `deleteGroupAvatar`, `deleteToolLogo` + matching routes, all following the exact pattern already established by `profile.controller.js`.
- **Centralized `config/fileUpload.config.js`** — every mime allowlist and size limit that used to be scattered as magic numbers across `upload.middleware.js` now lives in one table (5MB images, 8MB multi-image/resume, 15MB project files, 20MB/5-file message attachments). `upload.middleware.js` was refactored to reference it; no export names changed, so nothing downstream broke.
- **New maintenance script**: `npm run cleanup:assets` (dry run) / `cleanup:assets:force` — scans every model with a Cloudinary reference (`User`, `Profile`, `Community`, `Project`, `AITool`, `Conversation`, `Message`), builds the set of every `publicId` actually in use, lists everything under the `devlink/` prefix on Cloudinary, and reports (or deletes) anything orphaned. Assets can go orphaned if a request crashes between the Cloudinary upload and the Mongo save — every delete call in this codebase is already wrapped in try/catch precisely so a failed cleanup never blocks the primary action, which means orphans are an expected, bounded edge case that this script now catches.
- **Confirmed already correct** (audited, no changes needed): every "replace" upload (avatar, cover, resume, community avatar/banner, project cover, group avatar, tool logo) already deleted the previous asset before this phase; every hard-delete cascade (post, comment, community, project, tool, message) already cleaned up its associated Cloudinary assets.
- **Known pending item, flagged honestly**: `package.json` has referenced an `npm run seed` script since Phase 1's scaffolding, but `src/utils/seed.js` doesn't exist yet — it's realistically Phase 16 (Documentation) scope alongside the installation guide, not silently forgotten.

## Roadmap (subsequent phases, matching the original spec numbering)
12. Admin dashboard APIs
13. Security hardening pass
14. Performance (Redis caching, index review)
15. Testing
16. Documentation (including the seed script noted above)
17. Deployment

Say "continue" to move to the next phase.
