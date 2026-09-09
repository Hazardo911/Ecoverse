import { Router } from "express";
import { randomBytes, createHash, scrypt as sc } from "node:crypto";
import { promisify } from "node:util";
import { z } from "zod";
import { rows, transaction, fail } from "./db.js";
import { proofDirectory } from "./verification.js";
import { unlink } from "node:fs/promises";
import { resolve } from "node:path";
const scrypt = promisify(sc);
async function hash(p) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${(await scrypt(p, salt, 64)).toString("hex")}`;
}
async function verify(p, s) {
  const [salt, d] = s.split(":");
  if (!d) return false;
  return (await scrypt(p, salt, 64)).toString("hex") === d;
}
export function accountRoutes(auth) {
  const r = Router();
  r.use(auth);
  r.patch("/privacy", async (req, res) => {
    const input = z
      .object({ publicForest: z.boolean() })
      .strict()
      .parse(req.body);
    await rows("UPDATE users SET public_forest=? WHERE id=?", [
      input.publicForest,
      req.user.id,
    ]);
    res.json({ data: { publicForest: input.publicForest } });
  });
  r.delete("/evidence/:id", async (req, res) => {
    const completionId = z.coerce
        .number()
        .int()
        .positive()
        .parse(req.params.id),
      [c] = await rows(
        "SELECT proof_url,status FROM challenge_completions WHERE id=? AND user_id=?",
        [completionId, req.user.id],
      );
    if (!c) throw fail(404, "Evidence not found.");
    if (c.status === "PENDING")
      throw fail(
        409,
        "Evidence under review cannot be deleted. Wait for a decision.",
      );
    await rows(
      "UPDATE challenge_completions SET proof_url=NULL,proof_hash=NULL WHERE id=?",
      [completionId],
    );
    if (c.proof_url)
      await unlink(resolve(proofDirectory, c.proof_url)).catch(() => {});
    res.json({ data: { deleted: true } });
  });
  r.get("/notifications", async (req, res) =>
    res.json({
      data: await rows(
        "SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 100",
        [req.user.id],
      ),
    }),
  );
  r.post("/notifications/read", async (req, res) => {
    await rows(
      "UPDATE notifications SET read_at=UTC_TIMESTAMP() WHERE user_id=? AND read_at IS NULL",
      [req.user.id],
    );
    res.json({ data: { read: true } });
  });
  r.get("/recommendations", async (req, res) => {
    const picks = await rows(
      "SELECT ch.* FROM challenges ch LEFT JOIN (SELECT challenge_id,COUNT(*) n FROM challenge_completions WHERE user_id=? AND status='APPROVED' GROUP BY challenge_id) h ON h.challenge_id=ch.id WHERE ch.is_active=TRUE ORDER BY COALESCE(h.n,0),ch.points DESC LIMIT 4",
      [req.user.id],
    );
    res.json({
      data: picks.map((x) => ({
        ...x,
        reason:
          "Suggested because this verified category has less activity in your history.",
      })),
    });
  });
  r.get("/streaks", async (req, res) => {
    const entries = await rows(
      "SELECT ch.category,DATE_FORMAT(c.completion_day,'%Y-%m-%d') day FROM challenge_completions c JOIN challenges ch ON ch.id=c.challenge_id WHERE c.user_id=? AND c.status='APPROVED' ORDER BY day",
      [req.user.id],
    );
    const groups = {};
    for (const e of entries) (groups[e.category] ??= []).push(e.day);
    const data = Object.entries(groups).map(([category, days]) => ({
      category,
      verifiedDays: new Set(days).size,
    }));
    res.json({ data });
  });
  r.patch("/password", async (req, res) => {
    const i = z
      .object({
        currentPassword: z.string(),
        newPassword: z.string().min(10).max(128),
      })
      .strict()
      .parse(req.body);
    if (!(await verify(i.currentPassword, req.user.password_hash)))
      throw fail(401, "Current password is incorrect.");
    await rows("UPDATE users SET password_hash=? WHERE id=?", [
      await hash(i.newPassword),
      req.user.id,
    ]);
    res.json({ data: { updated: true } });
  });
  r.get("/export", async (req, res) => {
    const [user] = await rows(
      "SELECT id,name,email,avatar,eco_score,eco_points,trust_score,created_at,updated_at FROM users WHERE id=?",
      [req.user.id],
    );
    const completions = await rows(
        "SELECT * FROM challenge_completions WHERE user_id=?",
        [req.user.id],
      ),
      reviews = await rows(
        "SELECT r.* FROM submission_reviews r JOIN challenge_completions c ON c.id=r.completion_id WHERE c.user_id=?",
        [req.user.id],
      ),
      badges = await rows("SELECT * FROM user_badges WHERE user_id=?", [
        req.user.id,
      ]);
    res
      .set({
        "Content-Disposition": 'attachment; filename="ecoverse-data.json"',
        "Content-Type": "application/json",
      })
      .send(
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            user,
            completions,
            reviews,
            badges,
          },
          null,
          2,
        ),
      );
  });
  r.post("/reset-link", async (req, res) => {
    const token = randomBytes(24).toString("hex"),
      tokenHash = createHash("sha256").update(token).digest("hex");
    await rows(
      "INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES (?,?,UTC_TIMESTAMP()+INTERVAL 30 MINUTE)",
      [req.user.id, tokenHash],
    );
    res.json({
      data: {
        message:
          "A development reset token was created. Configure an email provider before production.",
        developmentToken:
          process.env.NODE_ENV === "production" ? undefined : token,
      },
    });
  });
  r.delete("/", async (req, res) => {
    const i = z
      .object({
        password: z.string(),
        confirmation: z.literal("DELETE MY ECOVERSE"),
      })
      .strict()
      .parse(req.body);
    if (!(await verify(i.password, req.user.password_hash)))
      throw fail(401, "Password is incorrect.");
    const photos = (
      await rows(
        "SELECT proof_url FROM challenge_completions WHERE user_id=? AND proof_url IS NOT NULL",
        [req.user.id],
      )
    ).map((x) => x.proof_url);
    await transaction(async (db) => {
      const id = req.user.id;
      await rows(
        "DELETE FROM post_comments WHERE post_id IN (SELECT id FROM community_posts WHERE user_id=?)",
        [id],
        db,
      );
      await rows(
        "DELETE FROM post_reactions WHERE post_id IN (SELECT id FROM community_posts WHERE user_id=?)",
        [id],
        db,
      );
      await rows("DELETE FROM post_comments WHERE user_id=?", [id], db);
      await rows("DELETE FROM post_reactions WHERE user_id=?", [id], db);
      await rows("DELETE FROM community_posts WHERE user_id=?", [id], db);
      await rows(
        "DELETE FROM team_members WHERE team_id IN (SELECT id FROM teams WHERE owner_id=?)",
        [id],
        db,
      );
      await rows("DELETE FROM teams WHERE owner_id=?", [id], db);
      await rows("DELETE FROM team_members WHERE user_id=?", [id], db);
      await rows("DELETE FROM notifications WHERE user_id=?", [id], db);
      await rows("DELETE FROM quiz_results WHERE user_id=?", [id], db);
      await rows("DELETE FROM user_badges WHERE user_id=?", [id], db);
      await rows("DELETE FROM forest_progress WHERE user_id=?", [id], db);
      await rows(
        "DELETE FROM review_assignments WHERE reviewer_id=? OR completion_id IN (SELECT id FROM challenge_completions WHERE user_id=?)",
        [id, id],
        db,
      );
      await rows(
        "UPDATE challenge_completions SET reviewed_by=NULL WHERE reviewed_by=?",
        [id],
        db,
      );
      await rows(
        "DELETE FROM submission_reviews WHERE completion_id IN (SELECT id FROM challenge_completions WHERE user_id=?)",
        [id],
        db,
      );
      await rows("DELETE FROM point_transactions WHERE user_id=?", [id], db);
      await rows("DELETE FROM challenge_completions WHERE user_id=?", [id], db);
      await rows("DELETE FROM user_extras WHERE user_id=?", [id], db);
      await rows(
        "DELETE FROM sessions WHERE JSON_EXTRACT(data,'$.userId')=?",
        [id],
        db,
      );
      await rows("DELETE FROM users WHERE id=?", [id], db);
    });
    await Promise.all(
      photos.map((file) =>
        unlink(resolve(proofDirectory, file)).catch(() => {}),
      ),
    );
    res.clearCookie("eco.sid");
    res.json({ data: { deleted: true } });
  });
  return r;
}
