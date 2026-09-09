# Verified-participation redesign audit

## Baseline inspected

- Vite multi-page HTML, plain JavaScript and CSS; Express 5 API.
- Scrypt passwords and cookie-based authentication, but a memory session store.
- Active storage was a serialized local JSON file. The earlier local MySQL 8.4 installation and eight-table schema still existed. Its users/completions/ledger were empty; twelve catalog challenges remained.
- The old `/api/challenges/:id/complete` route immediately issued points. Dashboard totals, forest growth, badges, shop and leaderboard all depended on that self-report loop.
- Reusable Three.js tree LODs, scanned ground/ferns/moss/rocks, water shader, rigged birds/butterflies, GSAP/ScrollTrigger, Lenis, responsive shared shell, goals/journal/shop/report functionality.
- Existing automated tests assumed instant completion and temporary JSON storage.

## Decisions

| Disposition | Scope |
| --- | --- |
| Keep | Plain JS/Vite/Express architecture, scrypt credentials, visual identity, models and attribution, interactive forest, cinematic scroll, journal/goals/workshop/report |
| Modify | Landing story, navigation, challenges, impact, leaderboard, forest inputs, badges, educational content, accessible/loading/error states |
| Replace | Live JSON reward storage with relational MySQL; memory sessions with MySQL sessions; immediate completion with start/evidence/review; old API/browser tests |
| Remove from rewards | Self-reported legacy actions, old badge eligibility, client-side completion controls and reward animation |
| Add | Dashboard/profile/detail pages, private normalized photo uploads, admin verification, review audit history, explainable trust, duplicate-proof flags, transactional rewards, learning-only quizzes |
| Expand | Opt-in community, comments/reactions, campaigns, teams, notifications/email adapter, recommendations, public showcases, PWA/offline drafts, account privacy, moderation analytics/assignment/export, demo mode and seasonal forest controls |

## Migration boundaries

The old MySQL tables are upgraded, not duplicated or dropped. The original JSON is retained unchanged. Missing JSON accounts are imported by email, with password hashes and safe personal goals; old rewards/photos/cosmetic purchases remain in that archive rather than being presented as verified. Two local accounts were imported during the first migration; subsequent migrations imported zero duplicates.

No fake demonstration users, approved submissions or point totals are added to the live database. Test accounts use isolated databases and temporary proof directories.

## Safety and integration checks

- Strict server validation rejects client-supplied points and status.
- Starts, reviews and cosmetic spending lock the owning user. Transactions use READ COMMITTED to avoid stale aggregate reads after concurrent approvals.
- Pending/rejected records cannot count toward verified totals. A unique ledger reference prevents a second reward.
- Approval rollback, concurrent same-record reviews and concurrent different-record reviews are covered by tests.
- Owner/admin-only photo retrieval; admins cannot self-review; missing/invalid photos rejected; metadata stripped by re-encoding.
- Trust is bounded, with no low-trust ban. Learning badges never change verified points or trust.
- Software-only WebGL caused unresponsive interactions with full scanned foliage in browser testing. Hardware rendering is retained; software renderers now receive a textured accessible fallback. Mobile/reduced-motion work is reduced independently.
- End-to-end browser checks exercise both review outcomes, dashboard, forest metrics, badge, leaderboard, quiz, profile, report and responsive pages. Scanned geometry and wildlife rigs retain their separate asset tests.

## Deliberate limits

Manual review, not AI certainty; disclosed estimates, not measured CO₂; college-scale queue/leaderboard, not a high-volume service. The existing Sites metadata is preserved, but this Node/TCP-MySQL runtime cannot be correctly published as a static frontend. Public hosting needs a compatible Node host and private storage.
