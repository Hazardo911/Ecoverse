# EcoVerse — A Gamified Digital Forest for Sustainable Living

**Your actions. Grow a world.**

EcoVerse helps people document sustainable habits, build trust through evidence, and visualize **verified participation** as a growing digital ecosystem. It is a Node/Express/MySQL application with a Vite multi-page frontend and an interactive Three.js forest.

## Problem and approach

A button labelled “I did this” is not a fair basis for a leaderboard. EcoVerse replaces instant self-reported rewards with a human-reviewed evidence workflow:

**Discover → Start → Perform IRL → Submit proof → Review → Earn points → Grow a forest.**

Photo review encourages accountability and reduces dishonest self-reporting. It **cannot perfectly prove an action happened**, measure its environmental impact, or certify carbon offsets. The digital forest is a representation of participation, not a claim that real trees have been planted by the platform.

## Run on this computer

The project is in `D:\Ecoversee`. Existing private database settings are in `.env`; do not publish that file.

```powershell
cd D:\Ecoversee
npm install
npm run db:local
npm run db:init
npm start
```

Open **http://localhost:3001**. `npm start` builds the frontend and serves it with Express. Stop an earlier instance with Ctrl+C before starting another one on the same port.

`db:local` connects to the configured database server or starts the previously installed Windows MySQL binary under `.local/`. It does not download or initialize a new database installation. That private installation is not included in Git.

For development with automatic reload:

```powershell
npm run db:local
npm run db:init
npm run dev
```

Frontend: **http://localhost:5173**. Backend: **http://localhost:3001**. Vite proxies `/api` to Express, keeping requests and session cookies same-origin. Separate terminals can run `npm run dev:web` and `npm run dev:api`.

## Fresh-machine setup

Requirements: Node.js 22.13+ and MySQL 8.0.16+ (tested with MySQL 8.4). Install dependencies, copy `.env.example` to `.env`, and configure a local MySQL database and user. Run these statements through your MySQL administrator client, using your own password:

```sql
CREATE DATABASE ecoverse CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'ecoverse'@'localhost' IDENTIFIED BY 'REPLACE_WITH_YOUR_OWN_PASSWORD';
GRANT ALL PRIVILEGES ON ecoverse.* TO 'ecoverse'@'localhost';
```

Then run `npm run db:init` followed by `npm start`. The development migration account needs DDL permissions. For an internet deployment, use a separate migration account and restrict the runtime account to the required data operations.

### Environment

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | `development` locally; `production` requires secure HTTPS cookies |
| `PORT` | Express port, normally 3001 |
| `APP_ORIGIN` | Comma-separated trusted frontend origins, no trailing slash |
| `SESSION_SECRET` | Random secret, at least 32 characters in production |
| `TRUST_PROXY` | Set to `1` only behind a trusted single reverse proxy |
| `DB_HOST`, `DB_PORT` | MySQL host/port (this computer uses the existing private settings) |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Private MySQL connection settings |
| `PROOF_DIR` | Private photo directory, default `data/proofs` |
| `FOREST_THRESHOLDS` | Five increasing integer thresholds starting at zero; default `0,200,500,1000,2000` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | Optional review-email server configuration |
| `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | Optional private email credentials and sender identity |
| `DATA_FILE` | Old JSON file used only by the explicit account importer |
| `TEST_DB_USER`, `TEST_DB_PASSWORD` | Optional isolated-test database administrator credentials |

Generate a secret locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and keep it in `.env`. Never put credentials in frontend files. `.env`, `.local`, `data`, test output, and dependencies are ignored by Git.

## First demonstration

1. Register a normal member account.
2. Register a **separate** reviewer account.
3. Grant that reviewer administrator access locally:

   ```powershell
   npm run admin:grant -- reviewer@example.com
   ```

4. In the member session, open Challenges, choose a challenge, and click **Start challenge**.
5. Complete the real-world action. Upload a photo and a description of at least 20 characters. Location is optional and never collected automatically.
6. Submit for verification. The status becomes **PENDING**; points remain unchanged.
7. In another browser profile/private window, sign in as the reviewer and open `/admin.html`. Review the photo, description, requirements, flags, and previous review history.
8. Approve or reject. Administrators cannot review their own evidence.
9. Refresh the member dashboard. An approval adds the stored reward, raises trust by 2, grows the forest, checks badges, and updates rankings. A rejection awards nothing and lowers trust by 5. The member can correct and resubmit rejected proof.

No admin password or demo user is seeded. The twelve challenge templates are real catalog data; no fabricated members, points, or leaderboard entries are created.

## Product surfaces

- **Landing:** Three.js woodland, GSAP/ScrollTrigger growth story, Lenis smooth scrolling, six-step evidence journey. Scroll-driven growth is explicitly an illustrative demo, not an account reward.
- **Dashboard:** verified points, Eco Score, trust, approved actions, forest stage, pending/in-progress counts, recent activity, badges, rank.
- **Challenges and detail:** six categories, instructions, environmental benefit, time, difficulty, evidence requirements, start/submit/resubmit states.
- **Admin:** aggregate statistics, pending queue, private evidence dialog, historical decisions, approve/reject, challenge creation/editing/disabling and optional impact coefficients.
- **My Forest:** scanned/textured trees and terrain, ferns, rocks, river, atmosphere, rigged birds/butterflies, day/sunset/night, fireflies, object inspection and earned decoration placements.
- **Impact and leaderboard:** approved-only totals, category counts, activity, global/rolling seven-day/rolling thirty-day rankings with trust.
- **Explore:** seven sustainability topics and server-checked quizzes. Passing all topics earns a separate learning badge with **zero** Eco Points and no trust change.
- **Profile:** editable display name, trust explanation, earned and locked badges.
- **Journey:** approved-action calendar/streaks, personal goals, weekly quests, private journal, downloadable printable HTML report. Open the report and Print → Save as PDF when desired.
- **Workshop:** cosmetic purchases use a separate spendable balance. Verified-action quest bonuses are cosmetic-only. Neither purchases nor these bonuses change lifetime Eco Points, forest progression, or leaderboard rank.
- **Community:** opt-in posts from approved actions, optional public evidence photos, reactions, comments, personal recommendations, review notifications, campaigns and verified team rankings.
- **Campaigns and teams:** the seeded Plastic-Free Month campaign and every team total use approved database records. Members can create a team or join with an eight-character code.
- **Public showcase:** disabled by default. Settings can enable a read-only forest revealing display name, trust, verified totals and badges only.
- **Account centre:** password change, development reset-token flow, data export, reviewed-evidence deletion, public-profile control and confirmed permanent deletion.
- **PWA:** installable manifest, cached public shell/learning routes, and browser-only text drafts for proof forms. Evidence photos are never cached as drafts.
- **Forest atmosphere:** seasonal color treatments, day/sunset/night, user-triggered ambient sound and a performance-quality control complement earned wildlife.
- **Demo mode:** `/demo.html` provides a guided architecture and product walkthrough for presentations.

## State and trust rules

`NOT_STARTED` is a derived display state; a record is created on start.

```text
NOT_STARTED → IN_PROGRESS → PENDING → APPROVED
                               ↓
                            REJECTED → PENDING (new evidence)
```

- A new user starts at **50 trust**.
- Each review approval adds **2**. Each rejection subtracts **5**.
- Clamp the score to **0–100**. Each review has an audit record with the actual delta.
- Below 30, require a photo even for otherwise optional-photo challenges and flag the evidence for additional scrutiny. No automatic ban.
- Identical normalized images reused in another submission are flagged, not automatically convicted as fraud. This is exact-image matching, not AI or robust perceptual duplicate detection.
- A user can have only one active attempt per challenge. Approved challenges can be started again on a new UTC day. The original attempt date is used for goal/calendar credit after approval; leaderboard periods use award time.
- Challenge points, photo requirement, and optional impact assumptions are snapshotted on start. Later catalog changes do not silently change existing rewards.
- The retired `/complete` route returns **410**. Extra client-supplied reward/status fields are rejected.

### Forest stages

| Verified Eco Points | Stage |
| --- | --- |
| 0–199 | Seed |
| 200–499 | Sprout |
| 500–999 | Young Forest |
| 1000–1999 | Thriving Forest |
| 2000+ | Living Ecosystem |

The backend returns stage, within-stage percentage, normalized visual growth, unlocked tree/wildlife counts, and next threshold. Three.js renders that response; it does not award progress. Eco Score is `min(100, floor(verified points / 25))`.

Badges: First Seed (1 approval), Growing Strong (500 points), Forest Keeper (1000), Ecosystem Builder (20 approvals), Planet Friend (2000), Trust Keeper (90 trust and at least 20 approvals). Badges record an earned milestone; a later trust decrease does not erase its history.

## Architecture

```text
HTML / CSS / JavaScript / Three.js
             ↓ same-origin JSON + session cookie
Express: authentication, authorization, validation
             ↓
Verification business logic → MySQL InnoDB transactions
             ↓                         ↓
Private re-encoded photos       relational progress + audit
             ↓
API response → UI / visual forest
```

### Database architecture

`server/schema.sql` defines the schema; `server/migrate.js` upgrades the original tables in place and seeds missing challenges/badges. Existing MySQL accounts are preserved. Old SQL self-reported completions are marked `LEGACY` and excluded from verified calculations; their old ledger rows remain available for historical inspection. Old badges are marked legacy.

| Table | Responsibility |
| --- | --- |
| `users` | Identity, scrypt hash, role, cached points/score, trust |
| `challenges` | Catalog, instructions, proof requirement, reward, optional estimate |
| `challenge_completions` | Attempt, evidence reference, state, immutable reward/estimate snapshot, reviewer |
| `point_transactions` | Verified award ledger; unique completion reference prevents double rewards |
| `forest_progress` | Materialized forest state updated with approval |
| `badges`, `user_badges` | Catalog and backend-awarded milestones; separate learning kind |
| `submission_reviews` | Append-only review history, reason, trust delta and reviewed evidence snapshot |
| `sessions` | Persistent server-side login sessions |
| `quiz_results` | Per-user/topic learning results |
| `user_extras` | Per-user JSON document for non-core goals/journal/cosmetic workshop state |
| `schema_migrations` | Applied migration versions |

Core ownership uses foreign keys. Unique keys enforce daily attempts and one ledger reward per completion. User row locks serialize starts, submissions, reviews and spending. An approval transaction locks the user and completion, checks PENDING, writes the decision/audit, awards from the stored snapshot, updates trust/score/forest, evaluates badges, and commits. Any failure rolls back the complete operation. The ledger joined to APPROVED completions is the source for verified totals.

### Legacy JSON migration

`npm run db:init` imports missing accounts and their password hashes from the earlier JSON app, matching by email. It preserves safe personal goals and records the legacy action count. **The original JSON is never overwritten or deleted.** Old completions, journal photos, purchases, and rewards remain archived in that file and are not represented as verified achievements. Existing SQL accounts with the same email are not overwritten. The importer is repeatable; it does not grant old points or duplicate accounts.

Back up both MySQL and the private proof directory together. The earlier JSON is an archive, not the current live database.

## API overview

Responses are `{ data: ... }` or `{ error: { message } }`. Authenticated endpoints use the HttpOnly `eco.sid` cookie.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register`, `/login`, `/logout` | Session authentication (login/logout use the `/api/auth` prefix) |
| GET | `/api/auth/me` | Current account |
| GET | `/api/challenges`, `/api/challenges/:id` | Catalog with current attempt status |
| POST | `/api/challenges/:id/start` | Start with an empty JSON body |
| POST | `/api/challenges/:id/submit` | `{ photo, description, location? }`; photo is a data URL |
| GET | `/api/admin/submissions/pending` | Protected review queue |
| GET | `/api/admin/submissions/:id` | Private evidence and user review history |
| POST | `/api/admin/submissions/:id/approve`, `/reject` | Atomic review, optional `{ reason }` |
| GET | `/api/admin/stats`, `/users`, `/challenges`, `/completions` | Admin views (all use `/api/admin`) |
| POST/PATCH | `/api/admin/challenges`, `/api/admin/challenges/:id` | Catalog management |
| GET/PATCH | `/api/user/profile` | Read profile / edit name |
| GET | `/api/user/progress`, `/forest`, `/impact`, `/activity`, `/badges` | Personal state (all use `/api/user`) |
| GET | `/api/leaderboard?period=global\|weekly\|monthly` | Approved-only ranking |
| GET | `/api/proofs/:filename` | Owner/admin-only JPEG access |
| GET/POST | `/api/learn`, `/api/learn/:topic/quiz` | Educational content / check answer |

Existing `/api/user/journey`, `/goals`, `/quests/:id/claim`, `/shop`, `/shop/:id/buy`, `/forest/layout`, `/journal`, `/journal/:id`, and `/report` remain available with approved-only inputs.

## Privacy, security and limitations

- Passwords use random-salt scrypt; sessions regenerate on login and persist in MySQL. Login/register and proof uploads are rate-limited.
- Same-origin API use, trusted-origin checking, SameSite cookies and JSON-only mutating endpoints reduce CSRF exposure. HTTPS and production cookie settings are required before internet use.
- Photos are limited to 4 MB and 24 megapixels, decoded and re-encoded with Sharp, resized to at most 1600 px, and stripped of metadata. Files live outside the public frontend with random filenames. Owner/admin authorization applies to every photo response.
- Location is a voluntary text field. There is no background tracking, face recognition, or sensor access.
- Proof review is manual. Queue loading is bounded to 200; activity views show the latest 100 attempts and review detail shows 30 decisions. The college-scale leaderboard currently calculates all ranked members; paginate/aggregate it before scaling widely.
- Optional impact coefficients live in MySQL and require an explicit assumption. Refill, Reuse illustrates one avoided single-use bottle per approved refill, clearly labelled as an assumption rather than a measurement. There are no arbitrary CO₂ coefficients. Missing estimates are shown honestly, not replaced with fake precision.
- Software-only graphics renderers receive a lightweight textured fallback; lessons, proof forms, and all progress remain usable. Mobile reduces graphics quality, and My Forest provides a graphics-quality toggle. Reduced-motion mode disables ambient movement and reduces rendering work.
- Private journal photos are notes, not replacement verification evidence. Reviewed evidence snapshots are retained separately.
- This is a college-scale implementation, not an independently audited production service. Public deployment should add operational monitoring, backup/restore drills, explicit retention/deletion policy, password recovery, stronger CSP and dependency review, and abuse handling.
- In-app review notifications always work. Email delivery activates only when SMTP variables are configured; local development never pretends an email was sent. Reset tokens are displayed only in development because an email provider is not bundled.

## Tests

```powershell
npm test
npm run build
npm run test:browser
```

Database tests create a uniquely named **`ecoverse_test_*`** database and delete only that database afterward. They do not change real member records. Locally, the existing ignored `.local/root.env` provides test administration; elsewhere set `TEST_DB_USER` and `TEST_DB_PASSWORD` for a test-only account allowed to create/drop test databases. Do not run integration tests against a production database server.

The suite covers the full approval journey, strict validation, origin rejection, private proof access, concurrent duplicate approval, rejection/resubmission, trust bounds, exact-image flags, self-review denial, intentional transaction rollback, separated quiz badges, cosmetic spending and goals. Asset tests cover tree geometry/materials, terrain, bird rigs/routes, and butterflies. Browser checks cover registration, proof upload, approval, dashboard/forest/badge/leaderboard updates, rejection feedback, profile editing, quizzes, report download, and mobile overflow. Install the Playwright Chromium browser if absent: `npx playwright install chromium`.

## Source map and assets

- Root `*.html`: page entry points. `js/`: frontend modules. `css/`: shared visual system.
- `server/app.js`: routes/auth/middleware. `server/verification.js`: review/reward business logic.
- `server/db.js`, `schema.sql`, `migrate.js`: SQL access and migration.
- `js/world.js`, `birds.js`, `butterflies.js`, `forest-floor.js`, `woodland-materials.js`: preserved ecosystem rendering.
- `public/assets/woodland/CREDITS.md`: model/texture attribution and licenses. Preserve it with the assets. Export/download scripts remain under `scripts/`.
- `app/` is not the active source folder. This project uses plain JavaScript, not TypeScript or React.

The existing `.openai/hosting.json` is retained from earlier static hosting. **This Express + TCP MySQL application must not be deployed as frontend-only static output.** Use a Node-capable host, MySQL, private file storage, HTTPS and proper environment configuration for public deployment; no deployment is performed by the local run commands.

## Future scope — not implemented

AI-assisted triage, computer vision, perceptual duplicate detection, community verification, IoT measurements, Google Fit / Apple Health / Strava integrations, stronger anti-fraud rules, and externally validated impact coefficients. These are future ideas, not current verification guarantees.
