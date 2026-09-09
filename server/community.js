import { Router } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { rows, transaction, fail } from "./db.js";
import { proofDirectory } from "./verification.js";
const id = z.coerce.number().int().positive();
export function communityRoutes(auth) {
  const r = Router();
  r.get("/feed", async (req, res) => {
    const posts = await rows(
      "SELECT p.id,p.caption,p.share_photo,p.created_at,p.completion_id,u.name,u.avatar,ch.title,ch.category,c.proof_url,(SELECT COUNT(*) FROM post_reactions x WHERE x.post_id=p.id) reactions FROM community_posts p JOIN users u ON u.id=p.user_id JOIN challenge_completions c ON c.id=p.completion_id AND c.status='APPROVED' JOIN challenges ch ON ch.id=c.challenge_id ORDER BY p.id DESC LIMIT 50",
    );
    for (const p of posts) {
      p.photo =
        p.share_photo && p.proof_url
          ? `/api/community/posts/${p.id}/photo`
          : null;
      delete p.proof_url;
      p.comments = await rows(
        "SELECT x.id,x.body,x.created_at,u.name FROM post_comments x JOIN users u ON u.id=x.user_id WHERE x.post_id=? ORDER BY x.id LIMIT 20",
        [p.id],
      );
    }
    res.json({ data: posts });
  });
  r.get("/posts/:id/photo", async (req, res) => {
    const [p] = await rows(
      "SELECT c.proof_url FROM community_posts p JOIN challenge_completions c ON c.id=p.completion_id AND c.status='APPROVED' WHERE p.id=? AND p.share_photo=TRUE",
      [id.parse(req.params.id)],
    );
    if (!p) throw fail(404, "Shared photo not found.");
    res.set({
      "Cache-Control": "public, max-age=300",
      "Content-Type": "image/jpeg",
      "X-Content-Type-Options": "nosniff",
    });
    res.sendFile(p.proof_url, { root: proofDirectory });
  });
  r.post("/posts", auth, async (req, res) => {
    const input = z
      .object({
        completionId: id,
        caption: z.string().trim().max(500),
        sharePhoto: z.boolean(),
      })
      .strict()
      .parse(req.body);
    const [c] = await rows(
      "SELECT id,proof_url FROM challenge_completions WHERE id=? AND user_id=? AND status='APPROVED'",
      [input.completionId, req.user.id],
    );
    if (!c) throw fail(403, "Only your approved actions can be shared.");
    if (input.sharePhoto && !c.proof_url)
      throw fail(400, "This action has no photo to share.");
    try {
      const out = await rows(
        "INSERT INTO community_posts(completion_id,user_id,caption,share_photo) VALUES (?,?,?,?)",
        [c.id, req.user.id, input.caption, input.sharePhoto],
      );
      res.status(201).json({ data: { id: out.insertId } });
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY")
        throw fail(409, "This action is already shared.");
      throw e;
    }
  });
  r.post("/posts/:id/react", auth, async (req, res) => {
    const input = z
      .object({ kind: z.enum(["inspired", "cheer"]) })
      .strict()
      .parse(req.body);
    await rows(
      "INSERT INTO post_reactions(post_id,user_id,kind) VALUES (?,?,?) ON DUPLICATE KEY UPDATE kind=VALUES(kind)",
      [id.parse(req.params.id), req.user.id, input.kind],
    );
    res.json({ data: { reacted: true } });
  });
  r.post("/posts/:id/comments", auth, async (req, res) => {
    const input = z
      .object({ body: z.string().trim().min(2).max(500) })
      .strict()
      .parse(req.body);
    await rows(
      "INSERT INTO post_comments(post_id,user_id,body) VALUES (?,?,?)",
      [id.parse(req.params.id), req.user.id, input.body],
    );
    res.status(201).json({ data: { created: true } });
  });
  r.get("/campaigns", async (req, res) =>
    res.json({
      data: await rows(
        "SELECT c.*,COUNT(DISTINCT cc.challenge_id) challenges,COUNT(DISTINCT x.user_id) participants,COUNT(DISTINCT CASE WHEN x.status='APPROVED' THEN x.id END) verifiedActions FROM campaigns c LEFT JOIN campaign_challenges cc ON cc.campaign_id=c.id LEFT JOIN challenge_completions x ON x.challenge_id=cc.challenge_id AND x.created_at BETWEEN c.starts_at AND c.ends_at WHERE c.is_active=TRUE GROUP BY c.id ORDER BY c.ends_at",
      ),
    }),
  );
  r.get("/teams", async (req, res) =>
    res.json({
      data: await rows(
        "SELECT t.id,t.name,COUNT(DISTINCT m.user_id) members,COALESCE(SUM(CASE WHEN c.status='APPROVED' THEN c.points_snapshot ELSE 0 END),0) points FROM teams t LEFT JOIN team_members m ON m.team_id=t.id LEFT JOIN challenge_completions c ON c.user_id=m.user_id GROUP BY t.id ORDER BY points DESC,t.id",
      ),
    }),
  );
  r.post("/teams", auth, async (req, res) => {
    const input = z
        .object({ name: z.string().trim().min(3).max(80) })
        .strict()
        .parse(req.body),
      code = randomBytes(4).toString("hex").toUpperCase();
    await transaction(async (db) => {
      const [member] = await rows(
        "SELECT team_id FROM team_members WHERE user_id=? FOR UPDATE",
        [req.user.id],
        db,
      );
      if (member)
        throw fail(409, "Leave your current team before creating another.");
      const out = await rows(
        "INSERT INTO teams(name,join_code,owner_id) VALUES (?,?,?)",
        [input.name, code, req.user.id],
        db,
      );
      await rows(
        "INSERT INTO team_members(team_id,user_id) VALUES (?,?)",
        [out.insertId, req.user.id],
        db,
      );
    });
    res.status(201).json({ data: { joinCode: code } });
  });
  r.post("/teams/join", auth, async (req, res) => {
    const input = z
      .object({
        code: z
          .string()
          .trim()
          .length(8)
          .transform((v) => v.toUpperCase()),
      })
      .strict()
      .parse(req.body);
    try {
      const out = await rows(
        "INSERT INTO team_members(team_id,user_id) SELECT id,? FROM teams WHERE join_code=?",
        [req.user.id, input.code],
      );
      if (!out.affectedRows) throw fail(404, "Team code not found.");
      res.json({ data: { joined: true } });
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY")
        throw fail(409, "You already belong to a team.");
      throw e;
    }
  });
  r.delete("/teams/leave", auth, async (req, res) => {
    const [m] = await rows("SELECT team_id FROM team_members WHERE user_id=?", [
      req.user.id,
    ]);
    if (!m) throw fail(404, "You are not in a team.");
    const [t] = await rows("SELECT owner_id FROM teams WHERE id=?", [
      m.team_id,
    ]);
    if (t.owner_id === req.user.id)
      throw fail(
        409,
        "A team owner cannot leave; team deletion is not enabled in this version.",
      );
    await rows("DELETE FROM team_members WHERE user_id=?", [req.user.id]);
    res.json({ data: { left: true } });
  });
  r.delete("/teams/:id", auth, async (req, res) => {
    const teamId = id.parse(req.params.id),
      [team] = await rows("SELECT owner_id FROM teams WHERE id=?", [teamId]);
    if (!team || team.owner_id !== req.user.id)
      throw fail(403, "Only the team owner can delete this team.");
    await transaction(async (db) => {
      await rows("DELETE FROM team_members WHERE team_id=?", [teamId], db);
      await rows("DELETE FROM teams WHERE id=?", [teamId], db);
    });
    res.json({ data: { deleted: true } });
  });
  return r;
}
