import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { databaseFixture } from "./database-fixture.js";
test(
  "MySQL verification flow, fraud controls, rollback, learning and workshop",
  { timeout: 120000 },
  async () => {
    const fixture = await databaseFixture();
    const { default: app } = await import("../server/app.js");
    const server = app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const client = () => {
      let cookie = "";
      return async (path, method = "GET", body, extra = {}) => {
        const r = await fetch(base + path, {
          method,
          headers: { "Content-Type": "application/json", cookie, ...extra },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        const set = r.headers.get("set-cookie");
        if (set) cookie = set.split(";")[0];
        const result = await r.json();
        return { status: r.status, ...result };
      };
    };
    const member = client(),
      reviewer = client(),
      stranger = client(),
      anon = client();
    const expect = async (p, status) => {
      const r = await p;
      assert.equal(r.status, status, JSON.stringify(r));
      return r.data;
    };
    try {
      const account = await expect(
        member("/auth/register", "POST", {
          name: "Test Member",
          email: "member@example.test",
          password: "StrongPassword123!",
        }),
        201,
      );
      const admin = await expect(
        reviewer("/auth/register", "POST", {
          name: "Test Reviewer",
          email: "reviewer@example.test",
          password: "StrongPassword123!",
        }),
        201,
      );
      await expect(
        stranger("/auth/register", "POST", {
          name: "Other Member",
          email: "other@example.test",
          password: "StrongPassword123!",
        }),
        201,
      );
      await fixture.rows("UPDATE users SET role='admin' WHERE id=?", [
        admin.id,
      ]);
      assert.equal(
        (
          await fixture.rows("SELECT password_hash FROM users WHERE id=?", [
            account.id,
          ])
        )[0].password_hash.includes("StrongPassword"),
        false,
      );
      await expect(member("/auth/logout", "POST", {}), 200);
      await expect(
        member("/auth/login", "POST", {
          email: "member@example.test",
          password: "StrongPassword123!",
        }),
        200,
      );
      const state = await expect(member("/user/progress"), 200);
      assert.equal(state.ecoPoints, 0);
      assert.equal(state.trustScore, 50);
      assert.equal(state.treesUnlocked, 0);
      await expect(anon("/user/progress"), 401);
      await expect(member("/admin/stats"), 403);
      await expect(
        member(
          "/challenges/1/start",
          "POST",
          {},
          { origin: "https://evil.example" },
        ),
        403,
      );
      await expect(
        member("/challenges/1/start", "POST", { points: 9000 }),
        400,
      );
      await expect(member("/challenges/1/complete", "POST", {}), 410);
      const starts = await Promise.all([
        member("/challenges/1/start", "POST", {}),
        member("/challenges/1/start", "POST", {}),
      ]);
      assert.deepEqual(starts.map((r) => r.status).sort(), [201, 409]);
      const attempt = starts.find((r) => r.status === 201).data;
      await expect(
        member("/challenges/1/submit", "POST", {
          description:
            "Sorted clean recyclables into the correct local collection.",
        }),
        400,
      );
      await expect(
        member("/challenges/1/submit", "POST", {
          description:
            "Sorted clean recyclables into the correct local collection.",
          photo: "data:image/png;base64,AAAA",
        }),
        400,
      );
      const image = await sharp({
          create: { width: 32, height: 32, channels: 3, background: "#315e39" },
        })
          .png()
          .toBuffer(),
        photo = "data:image/png;base64," + image.toString("base64");
      const proof = {
        description:
          "Sorted clean recyclables into the correct local collection.",
        location: "Community recycling point",
        photo,
      };
      await expect(
        member("/challenges/1/submit", "POST", { ...proof, points: 500 }),
        400,
      );
      await expect(member("/challenges/1/submit", "POST", proof), 201);
      assert.equal((await expect(member("/user/progress"), 200)).ecoPoints, 0);
      assert.deepEqual(await expect(member("/leaderboard"), 200), []);
      await expect(member("/challenges/1/submit", "POST", proof), 409);
      const detail = await expect(
        reviewer("/admin/submissions/" + attempt.id),
        200,
      );
      assert.equal(detail.status, "PENDING");
      assert.ok(detail.proof_url);
      // Private photo route: real binary response, not the JSON helper.
      const photoName = detail.proof_url.split("/").pop();
      await expect(anon("/proofs/" + photoName), 401);
      await expect(stranger("/proofs/" + photoName), 404);
      await expect(
        member(`/admin/submissions/${attempt.id}/approve`, "POST", {}),
        403,
      );
      const decisions = await Promise.all([
        reviewer(`/admin/submissions/${attempt.id}/approve`, "POST", {}),
        reviewer(`/admin/submissions/${attempt.id}/approve`, "POST", {}),
      ]);
      assert.deepEqual(decisions.map((r) => r.status).sort(), [200, 409]);
      const approved = await expect(member("/user/progress"), 200);
      assert.equal(approved.ecoPoints, 20);
      assert.equal(approved.trustScore, 52);
      assert.equal(approved.verifiedActions, 1);
      assert.equal(approved.treesUnlocked, 1);
      assert.ok(approved.badges.some((b) => b.id === "first-seed"));
      assert.equal(approved.leaderboardRank, 1);
      assert.equal(
        (
          await fixture.rows(
            "SELECT COUNT(*) n FROM point_transactions WHERE reference_id=?",
            [attempt.id],
          )
        )[0].n,
        1,
      );
      for (const period of ["global", "weekly", "monthly"]) {
        const board = await expect(
          member("/leaderboard?period=" + period),
          200,
        );
        assert.equal(board[0].points, 20);
        assert.equal(board[0].trustScore, 52);
      }
      await expect(member("/challenges/1/start", "POST", {}), 409);
      const second = await expect(
        member("/challenges/2/start", "POST", {}),
        201,
      );
      await expect(member("/challenges/2/submit", "POST", proof), 201);
      assert.match(
        (await expect(reviewer("/admin/submissions/" + second.id), 200))
          .review_flags,
        /Matching image/,
      );
      await expect(
        reviewer(`/admin/submissions/${second.id}/reject`, "POST", {
          reason: "Please show the switched-off devices.",
        }),
        200,
      );
      const rejected = await expect(member("/user/progress"), 200);
      assert.equal(rejected.ecoPoints, 20);
      assert.equal(rejected.trustScore, 47);
      assert.equal(rejected.verifiedActions, 1);
      await expect(
        reviewer(`/admin/submissions/${second.id}/reject`, "POST", {}),
        409,
      );
      await expect(
        member("/challenges/2/submit", "POST", {
          ...proof,
          description:
            "Switched off the idle lights and photographed the devices.",
        }),
        201,
      );
      // Force a failure midway through approval: every preceding write must roll back.
      await fixture.pool.query(
        "CREATE TRIGGER test_award_failure BEFORE INSERT ON point_transactions FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='intentional rollback test'",
      );
      await expect(
        reviewer(`/admin/submissions/${second.id}/approve`, "POST", {}),
        500,
      );
      assert.equal(
        (await expect(reviewer("/admin/submissions/" + second.id), 200)).status,
        "PENDING",
      );
      assert.equal(
        (await expect(member("/user/progress"), 200)).trustScore,
        47,
      );
      await fixture.pool.query("DROP TRIGGER test_award_failure");
      await expect(
        reviewer(`/admin/submissions/${second.id}/approve`, "POST", {}),
        200,
      );
      assert.equal((await expect(member("/user/progress"), 200)).ecoPoints, 35);
      const own = await expect(
        reviewer("/challenges/3/start", "POST", {}),
        201,
      );
      await expect(reviewer("/challenges/3/submit", "POST", proof), 201);
      await expect(
        reviewer(`/admin/submissions/${own.id}/approve`, "POST", {}),
        403,
      );
      // Low trust remains usable and mandates a photo, even when the catalog does not.
      await fixture.rows("UPDATE users SET trust_score=0 WHERE id=?", [
        account.id,
      ]);
      await fixture.rows(
        "UPDATE challenges SET proof_required=FALSE WHERE id=4",
      );
      const low = await expect(member("/challenges/4/start", "POST", {}), 201);
      await expect(
        member("/challenges/4/submit", "POST", {
          description: proof.description,
        }),
        400,
      );
      await expect(member("/challenges/4/submit", "POST", proof), 201);
      await expect(
        reviewer(`/admin/submissions/${low.id}/reject`, "POST", {}),
        200,
      );
      assert.equal((await expect(member("/user/progress"), 200)).trustScore, 0);
      const beforeQuiz = await expect(member("/user/progress"), 200);
      const answers = {
        forest: 1,
        climate: 0,
        water: 2,
        wildlife: 1,
        energy: 2,
        waste: 0,
        living: 1,
      };
      for (const [topic, answer] of Object.entries(answers))
        await expect(
          member("/learn/" + topic + "/quiz", "POST", { answer }),
          200,
        );
      const afterQuiz = await expect(member("/user/progress"), 200);
      assert.equal(afterQuiz.ecoPoints, beforeQuiz.ecoPoints);
      assert.equal(afterQuiz.trustScore, beforeQuiz.trustScore);
      assert.ok(
        afterQuiz.badges.some(
          (b) => b.id === "curious-mind" && b.kind === "learning",
        ),
      );
      const buys = await Promise.all([
        member("/user/shop/fern/buy", "POST", {}),
        member("/user/shop/fern/buy", "POST", {}),
      ]);
      assert.deepEqual(buys.map((r) => r.status).sort(), [201, 409]);
      assert.equal((await expect(member("/user/progress"), 200)).ecoPoints, 35);
      await expect(
        member("/user/forest/layout", "PUT", {
          placements: [{ item_id: "lantern", slot: 0 }],
        }),
        403,
      );
      await expect(
        member("/user/forest/layout", "PUT", {
          placements: [{ item_id: "fern", slot: 0 }],
        }),
        200,
      );
      const goal = await expect(
        member("/user/goals", "POST", {
          title: "Verified habits",
          category: "all",
          target: 2,
          deadline: new Date().toISOString().slice(0, 10),
        }),
        201,
      );
      assert.equal(goal.progress, 2);
      assert.equal((await expect(member("/user/journal"), 200)).length, 2);
      await expect(member("/user/journey"), 200);
      await expect(member("/user/impact"), 200);
      // Two different approvals for one user must update cached totals without a lost update.
      const concurrent = [];
      for (const id of [6, 7]) {
        concurrent.push(
          await expect(member(`/challenges/${id}/start`, "POST", {}), 201),
        );
        await expect(member(`/challenges/${id}/submit`, "POST", proof), 201);
      }
      await Promise.all(
        concurrent.map((c) =>
          expect(
            reviewer(`/admin/submissions/${c.id}/approve`, "POST", {}),
            200,
          ),
        ),
      );
      assert.equal((await expect(member("/user/progress"), 200)).ecoPoints, 75);
      assert.equal(
        (
          await fixture.rows("SELECT eco_points FROM users WHERE id=?", [
            account.id,
          ])
        )[0].eco_points,
        75,
      );
      // Trust upper bound and high-trust badge are server-side.
      await fixture.rows("UPDATE users SET trust_score=100 WHERE id=?", [
        account.id,
      ]);
      const third = await expect(
        member("/challenges/5/start", "POST", {}),
        201,
      );
      await expect(member("/challenges/5/submit", "POST", proof), 201);
      await expect(
        reviewer(`/admin/submissions/${third.id}/approve`, "POST", {}),
        200,
      );
      assert.equal(
        (await expect(member("/user/progress"), 200)).trustScore,
        100,
      );
    } finally {
      await new Promise((r) => server.close(r));
      await fixture.cleanup();
    }
  },
);
