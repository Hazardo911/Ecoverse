import "dotenv/config";
import express from "express";
import session from "express-session";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { z } from "zod";
import { rows, fail } from "./db.js";
import { MySQLSessionStore } from "./sessions.js";
import {
  progress,
  leaderboard,
  listChallenges,
  startChallenge,
  submitProof,
  reviewSubmission,
  submissionDetail,
  publicUser,
  idSchema,
  proofDirectory,
  trustExplanation,
} from "./verification.js";
import { featureRoutes } from "./features.js";
import { learningRoutes } from "./learning.js";
import { communityRoutes } from "./community.js";
import { accountRoutes } from "./account.js";
const scrypt = promisify(scryptCallback),
  app = express(),
  production = process.env.NODE_ENV === "production";
if (
  production &&
  (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)
)
  throw new Error(
    "Production requires SESSION_SECRET with at least 32 characters.",
  );
app.disable("x-powered-by");
if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  session({
    store: new MySQLSessionStore(),
    name: "eco.sid",
    secret: process.env.SESSION_SECRET || randomBytes(32).toString("hex"),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: production,
      maxAge: 7 * 86400000,
    },
  }),
);
const ok = (res, data, status = 200) => res.status(status).json({ data });
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const allowed = new Set(
      (process.env.APP_ORIGIN || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
    if (!production)
      for (const host of ["localhost", "127.0.0.1"])
        for (const port of [5173, Number(process.env.PORT || 3001)])
          allowed.add(`http://${host}:${port}`);
    if (req.get("origin") && !allowed.has(req.get("origin")))
      return next(fail(403, "Request origin is not allowed."));
    if (req.get("sec-fetch-site") === "cross-site")
      return next(fail(403, "Cross-site request blocked."));
    if (!req.is("application/json"))
      return next(fail(415, "Use application/json."));
  }
  next();
});
app.use(express.json({ limit: "6mb" }));
async function auth(req, res, next) {
  const [u] = await rows("SELECT * FROM users WHERE id=?", [
    req.session.userId || 0,
  ]);
  if (!u) throw fail(401, "Please sign in to continue.");
  req.user = u;
  next();
}
function admin(req, res, next) {
  if (req.user.role !== "admin")
    throw fail(403, "Administrator access required.");
  next();
}
async function hash(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${(await scrypt(password, salt, 64)).toString("hex")}`;
}
async function verify(password, stored) {
  const [salt, digest] = stored.split(":");
  if (!salt || !digest) return false;
  const actual = await scrypt(password, salt, 64),
    expected = Buffer.from(digest, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
const credentials = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((s) => s.toLowerCase()),
    password: z.string().min(10).max(128),
  })
  .strict();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { message: "Too many attempts. Try again later." } },
});
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: (req) => String(req.user.id),
  message: {
    error: { message: "Please wait before submitting more evidence." },
  },
});
async function signIn(req, id) {
  await new Promise((r, j) => req.session.regenerate((e) => (e ? j(e) : r())));
  req.session.userId = id;
  await new Promise((r, j) => req.session.save((e) => (e ? j(e) : r())));
}
app.get("/api/health", async (req, res) => {
  await rows("SELECT 1");
  ok(res, {
    status: "ok",
    storage: "mysql",
    verification: "manual-proof-review",
  });
});
app.post("/api/auth/register", authLimiter, async (req, res) => {
  const input = credentials
      .extend({ name: z.string().trim().min(2).max(80) })
      .parse(req.body),
    passwordHash = await hash(input.password);
  let r;
  try {
    r = await rows(
      "INSERT INTO users(name,email,password_hash) VALUES (?,?,?)",
      [input.name, input.email, passwordHash],
    );
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY")
      throw fail(409, "An account with this email already exists.");
    throw e;
  }
  await signIn(req, r.insertId);
  const [u] = await rows("SELECT * FROM users WHERE id=?", [r.insertId]);
  ok(res, publicUser(u), 201);
});
app.post("/api/auth/login", authLimiter, async (req, res) => {
  const input = credentials.parse(req.body),
    [u] = await rows("SELECT * FROM users WHERE email=?", [input.email]);
  if (!u || !(await verify(input.password, u.password_hash)))
    throw fail(401, "Email or password is incorrect.");
  await signIn(req, u.id);
  ok(res, publicUser(u));
});
app.post("/api/auth/logout", auth, (req, res, next) =>
  req.session.destroy((e) => {
    if (e) return next(e);
    res.clearCookie("eco.sid", {
      httpOnly: true,
      sameSite: "lax",
      secure: production,
    });
    ok(res, { signedOut: true });
  }),
);
app.get(["/api/auth/me", "/api/user/profile"], auth, (req, res) =>
  ok(res, { ...publicUser(req.user), trustExplanation }),
);
app.patch("/api/user/profile", auth, async (req, res) => {
  const input = z
    .object({ name: z.string().trim().min(2).max(80) })
    .strict()
    .parse(req.body);
  await rows("UPDATE users SET name=? WHERE id=?", [input.name, req.user.id]);
  ok(res, { updated: true });
});
app.get("/api/challenges", async (req, res) =>
  ok(res, await listChallenges(req.session.userId)),
);
app.get("/api/challenges/:id", async (req, res) => {
  const c = (await listChallenges(req.session.userId)).find(
    (c) => c.id === idSchema.parse(req.params.id),
  );
  if (!c) throw fail(404, "Challenge not found.");
  ok(res, c);
});
app.post("/api/challenges/:id/start", auth, async (req, res) =>
  ok(
    res,
    await startChallenge(req.user.id, idSchema.parse(req.params.id), req.body),
    201,
  ),
);
app.post("/api/challenges/:id/submit", auth, submitLimiter, async (req, res) =>
  ok(
    res,
    await submitProof(req.user.id, idSchema.parse(req.params.id), req.body),
    201,
  ),
);
app.post("/api/challenges/:id/complete", auth, () => {
  throw fail(
    410,
    "Instant completion has been retired. Start a challenge and submit proof for review.",
  );
});
app.get(["/api/user/progress", "/api/user/forest"], auth, async (req, res) =>
  ok(res, await progress(req.user.id)),
);
app.get("/api/user/activity", auth, async (req, res) =>
  ok(res, (await progress(req.user.id)).activity),
);
app.get("/api/user/impact", auth, async (req, res) => {
  const categories = await rows(
    "SELECT ch.category,COUNT(*) actions FROM challenge_completions c JOIN challenges ch ON ch.id=c.challenge_id WHERE c.user_id=? AND c.status='APPROVED' GROUP BY ch.category",
    [req.user.id],
  );
  const activity = await rows(
    "SELECT DATE_FORMAT(completion_day,'%Y-%m-%d') date,COUNT(*) actions FROM challenge_completions WHERE user_id=? AND status='APPROVED' AND completion_day>=UTC_DATE()-INTERVAL 6 DAY GROUP BY completion_day ORDER BY completion_day",
    [req.user.id],
  );
  const estimates = await rows(
    "SELECT impact_type type,impact_unit unit,impact_note note,SUM(impact_value) value,COUNT(*) actions FROM challenge_completions WHERE user_id=? AND status='APPROVED' AND impact_value IS NOT NULL GROUP BY impact_type,impact_unit,impact_note",
    [req.user.id],
  );
  ok(res, {
    ...(await progress(req.user.id)),
    categories,
    activity,
    estimates,
    estimatedCO2Kg: null,
    estimateNote:
      "Approved evidence documents participation, not measured environmental savings. Challenge estimates, when configured, use disclosed assumptions and are not precise measurements. No CO₂ total is claimed without an appropriate coefficient.",
  });
});
app.get("/api/leaderboard", async (req, res) =>
  ok(
    res,
    await leaderboard(
      z
        .enum(["global", "weekly", "monthly"])
        .parse(req.query.period || "global"),
    ),
  ),
);
app.use("/api/community", communityRoutes(auth));
app.get("/api/public/forest/:id", async (req, res) => {
  const userId = idSchema.parse(req.params.id),
    [u] = await rows(
      "SELECT id,name,avatar FROM users WHERE id=? AND public_forest=TRUE",
      [userId],
    );
  if (!u) throw fail(404, "Forest not found.");
  const s = await progress(userId);
  ok(res, {
    name: u.name,
    avatar: u.avatar,
    ecoPoints: s.ecoPoints,
    ecoScore: s.ecoScore,
    trustScore: s.trustScore,
    verifiedActions: s.verifiedActions,
    forestLevel: s.forestLevel,
    forestName: s.forestName,
    treesUnlocked: s.treesUnlocked,
    wildlifeUnlocked: s.wildlifeUnlocked,
    badges: s.badges,
  });
});
app.get("/api/badges", async (req, res) =>
  ok(res, await rows("SELECT * FROM badges")),
);
app.get("/api/user/badges", auth, async (req, res) =>
  ok(res, (await progress(req.user.id)).badges),
);
app.get("/api/proofs/:filename", auth, async (req, res) => {
  const file = z
    .string()
    .regex(/^[a-f0-9-]{36}\.jpg$/)
    .parse(req.params.filename);
  const [owner] = await rows(
    "SELECT user_id FROM challenge_completions WHERE proof_url=? UNION SELECT c.user_id FROM submission_reviews r JOIN challenge_completions c ON c.id=r.completion_id WHERE r.proof_url=?",
    [file, file],
  );
  if (!owner || (owner.user_id !== req.user.id && req.user.role !== "admin"))
    throw fail(404, "Photo not found.");
  res.set({
    "Cache-Control": "private, no-store",
    "Content-Type": "image/jpeg",
    "Content-Disposition": "inline",
  });
  res.sendFile(file, { root: proofDirectory });
});
app.use("/api/admin", auth, admin);
app.get("/api/admin/stats", async (req, res) => {
  const [s] = await rows(
    "SELECT COUNT(*) submissions,COALESCE(SUM(status='PENDING'),0) pending,COALESCE(SUM(status='APPROVED'),0) approved,COALESCE(SUM(status='REJECTED'),0) rejected FROM challenge_completions WHERE status<>'LEGACY'",
  );
  const [u] = await rows("SELECT COUNT(*) users FROM users"),
    [c] = await rows("SELECT COUNT(*) challenges FROM challenges"),
    [p] = await rows(
      "SELECT COALESCE(SUM(t.points),0) points FROM point_transactions t JOIN challenge_completions c ON c.id=t.reference_id AND c.status='APPROVED' WHERE t.type='verified_action'",
    );
  ok(res, { ...u, ...c, ...s, ...p });
});
app.get("/api/admin/submissions/pending", async (req, res) =>
  ok(
    res,
    await rows(
      "SELECT c.id,c.user_id,c.submitted_at,c.review_flags,c.description,ch.title,u.name,u.trust_score trustScore FROM challenge_completions c JOIN challenges ch ON ch.id=c.challenge_id JOIN users u ON u.id=c.user_id WHERE c.status='PENDING' ORDER BY c.submitted_at LIMIT 200",
    ),
  ),
);
app.get("/api/admin/submissions/:id", async (req, res) =>
  ok(res, await submissionDetail(idSchema.parse(req.params.id))),
);
for (const action of ["approve", "reject"])
  app.post(`/api/admin/submissions/:id/${action}`, async (req, res) =>
    ok(
      res,
      await reviewSubmission(
        req.user.id,
        idSchema.parse(req.params.id),
        action === "approve" ? "APPROVED" : "REJECTED",
        req.body,
      ),
    ),
  );
app.get("/api/admin/users", async (req, res) =>
  ok(
    res,
    (await rows("SELECT * FROM users ORDER BY id DESC LIMIT 200")).map(
      publicUser,
    ),
  ),
);
app.get("/api/admin/challenges", async (req, res) =>
  ok(res, await rows("SELECT * FROM challenges ORDER BY id")),
);
app.get("/api/admin/completions", async (req, res) =>
  ok(
    res,
    await rows(
      "SELECT c.id,c.status,c.reviewed_at,ch.title,u.name FROM challenge_completions c JOIN challenges ch ON ch.id=c.challenge_id JOIN users u ON u.id=c.user_id WHERE c.status<>'LEGACY' ORDER BY c.id DESC LIMIT 200",
    ),
  ),
);
app.get("/api/admin/analytics", async (req, res) => {
  const activity = await rows(
      "SELECT DATE_FORMAT(reviewed_at,'%Y-%m-%d') day,SUM(status='APPROVED') approved,SUM(status='REJECTED') rejected FROM challenge_completions WHERE reviewed_at>=UTC_DATE()-INTERVAL 29 DAY GROUP BY DATE_FORMAT(reviewed_at,'%Y-%m-%d') ORDER BY day",
    ),
    categories = await rows(
      "SELECT ch.category,COUNT(*) submissions,SUM(c.status='APPROVED') approved FROM challenge_completions c JOIN challenges ch ON ch.id=c.challenge_id WHERE c.status IN ('APPROVED','REJECTED') GROUP BY ch.category",
    ),
    trust = await rows(
      "SELECT FLOOR(trust_score/10)*10 band,COUNT(*) users FROM users GROUP BY band ORDER BY band",
    );
  ok(res, { activity, categories, trust });
});
app.post("/api/admin/submissions/:id/assign", async (req, res) => {
  await rows(
    "INSERT INTO review_assignments(completion_id,reviewer_id) VALUES (?,?) ON DUPLICATE KEY UPDATE reviewer_id=VALUES(reviewer_id),assigned_at=UTC_TIMESTAMP()",
    [idSchema.parse(req.params.id), req.user.id],
  );
  ok(res, { assigned: true });
});
app.get("/api/admin/audit.csv", async (req, res) => {
  const data = await rows(
      "SELECT id,completion_id,reviewer_id,decision,reason,trust_delta,reviewed_at FROM submission_reviews ORDER BY id DESC LIMIT 5000",
    ),
    quote = (v) => '"' + String(v ?? "").replaceAll('"', '""') + '"';
  res
    .set({
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="ecoverse-review-audit.csv"',
    })
    .send(
      [
        "id,completion_id,reviewer_id,decision,reason,trust_delta,reviewed_at",
        ...data.map((x) => Object.values(x).map(quote).join(",")),
      ].join("\n"),
    );
});
const challengeSchema = z
  .object({
    title: z.string().trim().min(3).max(100),
    description: z.string().trim().min(10).max(500),
    category: z.enum([
      "energy",
      "water",
      "waste",
      "transport",
      "lifestyle",
      "nature",
    ]),
    difficulty: z.enum(["Easy", "Medium", "Bold"]),
    points: z.number().int().min(1).max(100),
    is_active: z.boolean(),
    proof_required: z.boolean(),
    benefit: z.string().trim().min(10).max(2000),
    instructions: z.string().trim().min(10).max(2000),
    proof_requirements: z.string().trim().min(10).max(2000),
    estimated_time: z.string().trim().min(2).max(80),
    impact_type: z.string().trim().max(40).nullable(),
    impact_value: z.number().min(0).max(10000).nullable(),
    impact_unit: z.string().trim().max(30).nullable(),
    impact_note: z.string().trim().max(500).nullable(),
  })
  .strict()
  .refine(
    (c) =>
      c.impact_value === null ||
      Boolean(c.impact_type && c.impact_unit && c.impact_note),
    "An estimate needs a type, unit, and explained assumption.",
  );
app.post("/api/admin/challenges", async (req, res) => {
  const c = challengeSchema.parse(req.body),
    keys = Object.keys(c),
    r = await rows(
      `INSERT INTO challenges(slug,${keys.join(",")}) VALUES (?,${keys.map(() => "?").join(",")})`,
      [randomBytes(12).toString("hex"), ...Object.values(c)],
    );
  ok(res, { id: r.insertId }, 201);
});
app.patch("/api/admin/challenges/:id", async (req, res) => {
  const c = challengeSchema.parse(req.body),
    r = await rows(
      `UPDATE challenges SET ${Object.keys(c)
        .map((k) => k + "=?")
        .join(",")} WHERE id=?`,
      [...Object.values(c), idSchema.parse(req.params.id)],
    );
  if (!r.affectedRows) throw fail(404, "Challenge not found.");
  ok(res, { updated: true });
});
app.use("/api/learn", learningRoutes(auth));
app.use("/api/account", accountRoutes(auth));
app.use("/api/user", featureRoutes(auth, progress));
app.use("/api", (req, res, next) => next(fail(404, "Endpoint not found.")));
app.use(express.static("dist", { index: "index.html" }));
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err instanceof z.ZodError ? 400 : err.status || 500;
  if (status === 500) console.error("Request failed:", err.code || err.message);
  res.status(status).json({
    error: {
      message:
        status === 400
          ? "Check the submitted fields and required evidence."
          : status === 500
            ? "The service is temporarily unavailable. Please try again."
            : err.message,
    },
  });
});
export default app;
