import { rows, transaction, pool, fail, day } from "./db.js";
import { forestFromPoints, badgeRules, thresholds } from "./progression.js";
import { z } from "zod";
import sharp from "sharp";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { sendReviewEmail } from "./email.js";
export const proofDirectory = resolve(process.env.PROOF_DIR || "data/proofs");
export const trustExplanation =
  "Start at 50. Each approval adds 2; each rejection subtracts 5. Scores stay between 0 and 100. Below 30, evidence receives additional review—not an automatic ban. Trust describes review history, not certainty that an action happened.";
export const publicUser = (u) => {
  const { password_hash, ...profile } = u;
  return profile;
};
export const idSchema = z.coerce.number().int().positive();
const empty = z.object({}).strict();
export async function progress(userId, db = pool) {
  const [u] = await rows("SELECT * FROM users WHERE id=?", [userId], db);
  if (!u) throw fail(401, "Please sign in.");
  const [totals] = await rows(
    "SELECT COUNT(*) actions,COALESCE(SUM(t.points),0) points FROM point_transactions t JOIN challenge_completions c ON c.id=t.reference_id AND c.status='APPROVED' WHERE t.user_id=? AND t.type='verified_action'",
    [userId],
    db,
  );
  const points = Number(totals.points),
    forest = forestFromPoints(points);
  const badges = await rows(
    "SELECT b.*,ub.earned_at FROM user_badges ub JOIN badges b ON b.id=ub.badge_id WHERE ub.user_id=? AND ub.legacy=FALSE ORDER BY ub.earned_at",
    [userId],
    db,
  );
  const activity = await rows(
    "SELECT c.id,c.challenge_id,ch.title,ch.category,c.status,c.created_at,c.submitted_at,c.reviewed_at,c.rejection_reason,c.completion_day,c.points_snapshot FROM challenge_completions c JOIN challenges ch ON ch.id=c.challenge_id WHERE c.user_id=? AND c.status<>'LEGACY' ORDER BY c.id DESC LIMIT 100",
    [userId],
    db,
  );
  const [counts] = await rows(
    "SELECT SUM(status='IN_PROGRESS') active,SUM(status='PENDING') pending,SUM(status='REJECTED') rejected FROM challenge_completions WHERE user_id=?",
    [userId],
    db,
  );
  const [extras] = await rows(
    "SELECT payload FROM user_extras WHERE user_id=?",
    [userId],
    db,
  );
  const payload = extras?.payload || {};
  const bonuses = (payload.questClaims || []).reduce((n, q) => n + q.reward, 0),
    spent = (payload.purchases || []).reduce((n, p) => n + p.cost, 0);
  const board = await leaderboard("global", db),
    rank = board.findIndex((r) => r.id === userId);
  return {
    ecoPoints: points,
    ecoScore: Math.min(100, Math.floor(points / 25)),
    trustScore: u.trust_score,
    trustExplanation,
    requiresExtraReview: u.trust_score < 30,
    verifiedActions: totals.actions,
    challengesCompleted: totals.actions,
    ...forest,
    forestName: [
      "Seed",
      "Sprout",
      "Young Forest",
      "Thriving Forest",
      "Living Ecosystem",
    ][forest.forestLevel - 1],
    visualGrowth: Math.min(1, points / thresholds[4]),
    spendablePoints: points + bonuses - spent,
    badges,
    activeChallenges: Number(counts.active || 0),
    pendingVerification: Number(counts.pending || 0),
    rejectedSubmissions: Number(counts.rejected || 0),
    activity,
    recentVerified: activity.filter((c) => c.status === "APPROVED").slice(0, 6),
    completedChallenges: activity
      .filter((c) => c.status === "APPROVED" && c.completion_day === day())
      .map((c) => c.challenge_id),
    leaderboardRank: rank < 0 ? null : rank + 1,
    legacyActions: payload.legacyActions || 0,
  };
}
export async function leaderboard(period = "global", db = pool) {
  const after =
    period === "global"
      ? "1970-01-01"
      : new Date(Date.now() - (period === "weekly" ? 7 : 30) * 86400000)
          .toISOString()
          .slice(0, 19)
          .replace("T", " ");
  return rows(
    "SELECT u.id,u.name,u.avatar,u.trust_score trustScore,COALESCE(f.forest_level,1) forestLevel,SUM(t.points) points,COUNT(*) challenges FROM point_transactions t JOIN challenge_completions c ON c.id=t.reference_id AND c.status='APPROVED' JOIN users u ON u.id=t.user_id LEFT JOIN forest_progress f ON f.user_id=u.id WHERE t.type='verified_action' AND t.created_at>=? GROUP BY u.id,u.name,u.avatar,u.trust_score,f.forest_level ORDER BY points DESC,u.id ASC",
    [after],
    db,
  );
}
export async function listChallenges(userId = null) {
  const catalog = await rows(
    "SELECT * FROM challenges WHERE is_active=TRUE ORDER BY id",
  );
  if (!userId) return catalog.map((c) => ({ ...c, status: "NOT_STARTED" }));
  const actions = await rows(
    "SELECT id,challenge_id,status,completion_day,rejection_reason,points_snapshot,proof_required FROM challenge_completions WHERE user_id=? AND status<>'LEGACY' ORDER BY id DESC",
    [userId],
  );
  return catalog.map((c) => {
    const latest = actions.find((a) => a.challenge_id === c.id),
      canRepeat =
        latest?.status === "APPROVED" && latest.completion_day < day();
    return {
      ...c,
      ...(latest && !canRepeat
        ? {
            points: latest.points_snapshot,
            proof_required: latest.proof_required,
          }
        : {}),
      status: latest?.status || "NOT_STARTED",
      completion: latest || null,
      canRepeat,
    };
  });
}
export async function startChallenge(userId, id, body) {
  empty.parse(body);
  return transaction(async (db) => {
    await rows("SELECT id FROM users WHERE id=? FOR UPDATE", [userId], db);
    const [ch] = await rows(
      "SELECT * FROM challenges WHERE id=? AND is_active=TRUE",
      [id],
      db,
    );
    if (!ch) throw fail(404, "Challenge is unavailable.");
    const [active] = await rows(
      "SELECT * FROM challenge_completions WHERE user_id=? AND challenge_id=? AND status IN ('IN_PROGRESS','PENDING','REJECTED') ORDER BY id DESC LIMIT 1",
      [userId, id],
      db,
    );
    if (active)
      throw fail(
        409,
        "This challenge already has an active attempt. Open it to continue or resubmit.",
      );
    if (
      (
        await rows(
          "SELECT id FROM challenge_completions WHERE user_id=? AND challenge_id=? AND completion_day=?",
          [userId, id, day()],
          db,
        )
      ).length
    )
      throw fail(
        409,
        "One attempt per challenge per UTC day. Return tomorrow.",
      );
    const r = await rows(
      "INSERT INTO challenge_completions(user_id,challenge_id,completion_day,status,points_snapshot,proof_required,impact_type,impact_value,impact_unit,impact_note) VALUES (?,?,?,'IN_PROGRESS',?,?,?,?,?,?)",
      [
        userId,
        id,
        day(),
        ch.points,
        ch.proof_required,
        ch.impact_type,
        ch.impact_value,
        ch.impact_unit,
        ch.impact_note,
      ],
      db,
    );
    return { id: r.insertId, status: "IN_PROGRESS", points: ch.points };
  });
}
export async function submitProof(userId, id, body) {
  const input = z
    .object({
      description: z.string().trim().min(20).max(2000),
      location: z.string().trim().max(200).optional().default(""),
      photo: z.string().max(5600000).nullable().optional(),
    })
    .strict()
    .parse(body);
  let filename = null,
    hash = null;
  if (input.photo) {
    const match =
      /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
        input.photo,
      );
    if (!match) throw fail(400, "Choose a JPEG, PNG, or WebP photograph.");
    const bytes = Buffer.from(match[2], "base64");
    if (bytes.length > 4 * 1024 * 1024)
      throw fail(413, "Photo must be under 4 MB.");
    let clean;
    try {
      clean = await sharp(bytes, { limitInputPixels: 24000000 })
        .rotate()
        .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch {
      throw fail(
        400,
        "This photo could not be decoded. Choose a valid image under 24 megapixels.",
      );
    }
    hash = createHash("sha256").update(clean).digest("hex");
    filename = randomUUID() + ".jpg";
    await mkdir(proofDirectory, { recursive: true });
    await writeFile(resolve(proofDirectory, filename), clean, {
      flag: "wx",
      mode: 0o600,
    });
  }
  try {
    return await transaction(async (db) => {
      const [user] = await rows(
        "SELECT * FROM users WHERE id=? FOR UPDATE",
        [userId],
        db,
      );
      const [ch] = await rows(
        "SELECT * FROM challenges WHERE id=? AND is_active=TRUE",
        [id],
        db,
      );
      if (!ch) throw fail(404, "Challenge is unavailable.");
      const [c] = await rows(
        "SELECT * FROM challenge_completions WHERE user_id=? AND challenge_id=? AND status IN ('IN_PROGRESS','REJECTED') ORDER BY id DESC LIMIT 1 FOR UPDATE",
        [userId, id],
        db,
      );
      if (!c)
        throw fail(
          409,
          "Start this challenge first. Pending or approved proof cannot be replaced.",
        );
      if ((c.proof_required || user.trust_score < 30) && !filename)
        throw fail(400, "A photo is required for this submission.");
      const flags = [];
      if (user.trust_score < 30)
        flags.push("Low trust: review supporting details carefully");
      if (
        hash &&
        (
          await rows(
            "SELECT id FROM challenge_completions WHERE proof_hash=? AND id<>? LIMIT 1",
            [hash, c.id],
            db,
          )
        ).length
      )
        flags.push("Matching image used in another submission");
      await rows(
        "UPDATE challenge_completions SET status='PENDING',proof_url=?,proof_hash=?,description=?,location=?,submitted_at=UTC_TIMESTAMP(),reviewed_at=NULL,reviewed_by=NULL,rejection_reason=NULL,review_flags=? WHERE id=?",
        [
          filename,
          hash,
          input.description,
          input.location || null,
          flags.join("; ") || null,
          c.id,
        ],
        db,
      );
      return {
        id: c.id,
        status: "PENDING",
        message:
          "Your proof has been submitted for verification. No points are awarded until approval.",
      };
    });
  } catch (e) {
    if (filename)
      await unlink(resolve(proofDirectory, filename)).catch(() => {});
    throw e;
  }
}
export async function reviewSubmission(reviewerId, id, decision, body) {
  const input = z
    .object({ reason: z.string().trim().max(500).optional().default("") })
    .strict()
    .parse(body);
  const outcome = await transaction(async (db) => {
    const [ref] = await rows(
      "SELECT user_id FROM challenge_completions WHERE id=?",
      [id],
      db,
    );
    if (!ref) throw fail(404, "Submission not found.");
    if (ref.user_id === reviewerId)
      throw fail(
        403,
        "You cannot review your own submission. Ask another administrator.",
      );
    // Lock user first everywhere: serializes rewards, trust changes, starts and spending.
    const [user] = await rows(
      "SELECT * FROM users WHERE id=? FOR UPDATE",
      [ref.user_id],
      db,
    );
    const [c] = await rows(
      "SELECT * FROM challenge_completions WHERE id=? FOR UPDATE",
      [id],
      db,
    );
    if (c.status !== "PENDING")
      throw fail(
        409,
        "This submission is no longer pending. It has not been rewarded again.",
      );
    const trust = Math.max(
      0,
      Math.min(100, user.trust_score + (decision === "APPROVED" ? 2 : -5)),
    );
    await rows(
      "UPDATE challenge_completions SET status=?,reviewed_at=UTC_TIMESTAMP(),reviewed_by=?,rejection_reason=?,completed_at=IF(?='APPROVED',UTC_TIMESTAMP(),NULL) WHERE id=?",
      [
        decision,
        reviewerId,
        decision === "REJECTED" ? input.reason || null : null,
        decision,
        id,
      ],
      db,
    );
    await rows(
      "INSERT INTO submission_reviews(completion_id,reviewer_id,decision,reason,trust_delta,proof_url,description,location) VALUES (?,?,?,?,?,?,?,?)",
      [
        id,
        reviewerId,
        decision,
        input.reason || null,
        trust - user.trust_score,
        c.proof_url,
        c.description,
        c.location,
      ],
      db,
    );
    await rows(
      "UPDATE users SET trust_score=? WHERE id=?",
      [trust, user.id],
      db,
    );
    await rows(
      "INSERT INTO notifications(user_id,type,title,message,link) VALUES (?,?,?,?,?)",
      [
        user.id,
        decision === "APPROVED" ? "approval" : "rejection",
        decision === "APPROVED"
          ? "Evidence approved"
          : "Evidence needs another look",
        decision === "APPROVED"
          ? `${c.points_snapshot} Eco Points were added to your verified journey.`
          : input.reason || "Review the challenge and submit clearer evidence.",
        `challenge.html?id=${c.challenge_id}`,
      ],
      db,
    );
    if (decision === "APPROVED")
      await rows(
        "INSERT INTO point_transactions(user_id,points,type,reference_id) VALUES (?,?,'verified_action',?)",
        [user.id, c.points_snapshot, id],
        db,
      );
    const state = await progress(user.id, db),
      f = forestFromPoints(state.ecoPoints);
    await rows(
      "UPDATE users SET eco_points=?,eco_score=? WHERE id=?",
      [state.ecoPoints, state.ecoScore, user.id],
      db,
    );
    await rows(
      "INSERT INTO forest_progress(user_id,forest_level,growth_points,trees_unlocked,wildlife_unlocked) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE forest_level=VALUES(forest_level),growth_points=VALUES(growth_points),trees_unlocked=VALUES(trees_unlocked),wildlife_unlocked=VALUES(wildlife_unlocked)",
      [
        user.id,
        f.forestLevel,
        f.growthPoints,
        f.treesUnlocked,
        f.wildlifeUnlocked,
      ],
      db,
    );
    for (const [badgeId, , , test] of badgeRules)
      if (
        test({ points: state.ecoPoints, actions: state.verifiedActions, trust })
      )
        await rows(
          "INSERT INTO user_badges(user_id,badge_id) VALUES (?,?) ON DUPLICATE KEY UPDATE earned_at=IF(legacy,UTC_TIMESTAMP(),earned_at),legacy=FALSE",
          [user.id, badgeId],
          db,
        );
    if (decision === "APPROVED") {
      const [campaign] = await rows(
        "SELECT ca.badge_id FROM campaigns ca JOIN campaign_challenges cc ON cc.campaign_id=ca.id WHERE cc.challenge_id=? AND UTC_TIMESTAMP() BETWEEN ca.starts_at AND ca.ends_at AND ca.is_active=TRUE AND ca.badge_id IS NOT NULL LIMIT 1",
        [c.challenge_id],
        db,
      );
      if (campaign)
        await rows(
          "INSERT IGNORE INTO user_badges(user_id,badge_id) VALUES (?,?)",
          [user.id, campaign.badge_id],
          db,
        );
    }
    return {
      status: decision,
      awardedPoints: decision === "APPROVED" ? c.points_snapshot : 0,
      trustScore: trust,
      email: user.email,
      name: user.name,
      reason: input.reason,
    };
  });
  await sendReviewEmail({
    email: outcome.email,
    name: outcome.name,
    decision: outcome.status,
    points: outcome.awardedPoints,
    reason: outcome.reason,
  }).catch((error) => console.error("Review email failed:", error.message));
  delete outcome.email;
  delete outcome.name;
  delete outcome.reason;
  return outcome;
}
export async function submissionDetail(id) {
  const [s] = await rows(
    "SELECT c.*,u.name,u.trust_score trustScore,ch.title,ch.proof_requirements FROM challenge_completions c JOIN users u ON u.id=c.user_id JOIN challenges ch ON ch.id=c.challenge_id WHERE c.id=?",
    [id],
  );
  if (!s) throw fail(404, "Submission not found.");
  const history = await rows(
    "SELECT r.id,r.decision,r.reason,r.trust_delta,r.reviewed_at,ch.title FROM submission_reviews r JOIN challenge_completions c ON c.id=r.completion_id JOIN challenges ch ON ch.id=c.challenge_id WHERE c.user_id=? ORDER BY r.id DESC LIMIT 30",
    [s.user_id],
  );
  return {
    ...s,
    proof_url: s.proof_url ? `/api/proofs/${s.proof_url}` : null,
    history,
  };
}
