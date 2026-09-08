# EcoVerse — frontend + backend, no database

EcoVerse is a sustainability app with a Three.js forest, daily challenges, Eco Points, badges, impact tracking, and rankings. The frontend communicates with an Express backend. **No MySQL, database installation, migrations, or database service is required.**

## Run

Install Node.js 22.13+ and run in the project directory:

```powershell
cd D:\Ecoversee
npm install
npm start
```

Open **http://localhost:3001**. `npm start` builds the frontend and serves both frontend and API through one Express server.

For development with automatic reload:

```powershell
npm run dev
```

Then open **http://localhost:5173**. Local development accepts both localhost and 127.0.0.1 on ports 5173 and 3001, preventing the previous registration-origin mismatch.

## Woodland visuals

The shared Three.js scene uses a locally optimized, textured GLB tree model,
photographic forest-floor textures, HDR environment lighting, leaf wind, soft
desktop shadows, and animated stream highlights. The camera looks into continuous
terrain instead of a floating island. Mobile devices use fewer background trees,
lower pixel density, and no dynamic shadows. Reduced-motion settings stop wind
and ambient animation. Earned foreground trees and purchased placements still
follow your existing progress; distant woodland is scenery, not unlocked trees.

The ground now combines contoured terrain with moss/leaf-litter PBR maps and
instanced scanned fern, moss, and rock models. Fern shop placements use the same
scanned model. Near desktop trees use a higher-detail LOD; mobile devices retain
the lightweight tree model. The old cone grass and round placeholder flowers
are removed from the landscape. Source variations and asset budgets are tested.

Butterflies use an approximately 85 KB textured, rigged GLB with its original
wing animation. They wander above the planted banks instead of orbiting as flat
rectangles, respect reduced motion, and retain the sixth-and-later wildlife
unlock slots (the first butterfly appears at 1,200 Eco Points).

Birds use a locally hosted, feather-textured shrike GLB with project-authored
Flight and Perch clips, independent Three.js AnimationMixers, curved flight
paths, gliding intervals, and rests on fallen branches. At most five birds are
rendered; existing wildlife unlock counts are unchanged. Reduced-motion mode
keeps unlocked birds resting. Failed bird loading does not block the forest.

All assets are included under `public/assets/woodland`; source and CC0 license
details are in `public/assets/woodland/CREDITS.md`. No asset downloads or API keys
are needed after installation. This is a real-time 3D scene, not a photographic
capture, and decorative tree species use a shared model.

## How data works

- The backend creates `data/ecoverse.json` automatically on first start.
- Accounts, password hashes, challenge edits, completion history, points, and badges persist in that file.
- Server-side sessions are in memory; restarting the backend signs users out but does not erase their accounts or progress.
- Passwords use salted scrypt hashes. Cookies are HttpOnly and SameSite.
- The backend awards points using its challenge catalog. Duplicate completion is blocked per challenge per UTC day.
- Writes are serialized and saved through an atomic file replacement, so concurrent requests in the same server process cannot double-award points.
- This simple file storage is intended for one local Node process. Do not run multiple backend processes against the same file.
- No fake users or leaderboard scores are seeded.
- Previous MySQL files under `.local/` are untouched but are no longer used. Old MySQL accounts are not automatically imported; create an account in this version.
- CO₂ measurements remain unavailable until action quantities are collected; category and activity counts are real.

Back up `data/ecoverse.json` to retain progress. It contains private account data and must not be committed or publicly shared. The frontend's public folder never serves this file.

## Configuration

No `.env` is required for local use. Optional settings are documented in `.env.example`:

- `PORT`: backend port, default 3001
- `DATA_FILE`: JSON path, default `data/ecoverse.json`
- `APP_ORIGIN`: additional comma-separated allowed frontend origins
- `SESSION_SECRET`: optional locally; required with at least 32 random characters in production
- `NODE_ENV`: defaults to development behavior
- `TRUST_PROXY=1`: only when behind one trusted reverse proxy

Production requires HTTPS for secure cookies. This memory-session/file-storage setup is for a local project or single-process demonstration, not a multi-instance deployment. The old hosted Sites URL still shows the earlier version.

## Administrator access

Register your account, stop the backend, then run:

```powershell
npm run admin:grant -- your-email@example.com
npm start
```

Open `/admin.html` to view users, completions, and statistics, or create/edit/disable challenges. Stop the backend before using the grant command so two processes do not write the data file.


## New project features

- **Journey → Calendar:** current/best streaks, month navigation, and actions for a selected date. UTC days are used; your streak remains alive until the day after your last active day ends.
- **Journey → Goals:** choose a category, target, and deadline. Progress includes actions from the creation date through the deadline. Completed/expired status is calculated automatically; archive goals you no longer need.
- **Journey → Quests:** Monday-to-Sunday quests for category variety, five actions, and three active days. Claim each reward once per week.
- **My Forest → Workshop:** purchase six collectible decorations and place them in six clearings. Move or remove owned items freely. The saved layout appears in the 3D forest after reload.
- **Journey → Journal:** add/edit private notes and a JPEG/PNG photo for a recorded action. Browser-side resizing reduces image size before saving; each stored photo is capped at roughly 375 KB. Photos are stored with other private account data in the JSON file.
- **Impact / Journey → Download report:** download a standalone printable HTML report. Open it in a browser and use Print → Save as PDF for a PDF copy.

**Point accounting:** lifetime action points determine forest levels and rankings. Spendable balance = lifetime action points + claimed quest bonuses − purchases. Spending never reduces lifetime progress. Quest bonuses cannot inflate leaderboard scores.

Existing JSON accounts are upgraded additively on load. Goals, journal entries, purchases, placements, and quest claims are saved alongside existing records; no reset or database migration is needed.

New private endpoints:

- `GET /api/user/journey`
- `POST /api/user/goals`, `DELETE /api/user/goals/:id` (archive)
- `POST /api/user/quests/:id/claim`
- `GET /api/user/shop`, `POST /api/user/shop/:id/buy`
- `PUT /api/user/forest/layout`
- `GET /api/user/journal`, `PUT /api/user/journal/:id`
- `GET /api/user/report`

## Core API

All routes remain compatible with the frontend:

- `POST /api/auth/register`, `/api/auth/login`, `/api/auth/logout`
- `GET /api/auth/me`, `/api/user/profile`
- `GET /api/challenges`, `/api/challenges/:id`
- `POST /api/challenges/:id/complete` with `{}`; points are determined by the server
- `GET /api/user/progress`, `/api/user/forest`, `/api/user/impact`
- `GET /api/leaderboard?period=global|weekly|monthly`
- `GET /api/badges`, `/api/user/badges`
- Admin routes: `/api/admin/users`, `/api/admin/completions`, `/api/admin/stats`, `/api/admin/challenges`
- `GET /api/health`

Responses use `{data: ...}` or `{error: {message: ...}}`. Private routes require the session cookie.

## Verify

```powershell
npm test
npm run build
npx playwright install chromium
node tests/browser-check.js
```

Tests launch their own backend with isolated temporary JSON files. They require no database and do not modify real accounts.
