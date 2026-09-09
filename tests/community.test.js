import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { databaseFixture } from "./database-fixture.js";
test(
  "community, campaigns, teams, notifications, public forest and account privacy",
  { timeout: 120000 },
  async () => {
    const f = await databaseFixture(),
      { default: app } = await import("../server/app.js"),
      server = app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const client = () => {
      let cookie = "";
      return async (path, method = "GET", body) => {
        const response = await fetch(base + path, {
          method,
          headers: { "Content-Type": "application/json", cookie },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (response.headers.get("set-cookie"))
          cookie = response.headers.get("set-cookie").split(";")[0];
        let payload = {};
        if (response.headers.get("content-type")?.includes("json"))
          payload = await response.json();
        return { status: response.status, ...payload };
      };
    };
    const user = client(),
      admin = client(),
      member2 = client();
    try {
      const u = (
          await user("/auth/register", "POST", {
            name: "Social Member",
            email: "social@example.test",
            password: "StrongPassword123!",
          })
        ).data,
        a = (
          await admin("/auth/register", "POST", {
            name: "Reviewer",
            email: "admin@example.test",
            password: "StrongPassword123!",
          })
        ).data;
      await member2("/auth/register", "POST", {
        name: "Teammate",
        email: "team@example.test",
        password: "StrongPassword123!",
      });
      await f.rows("UPDATE users SET role='admin' WHERE id=?", [a.id]);
      const start = (await user("/challenges/6/start", "POST", {})).data,
        img = await sharp({
          create: { width: 30, height: 30, channels: 3, background: "#123456" },
        })
          .png()
          .toBuffer();
      await user("/challenges/6/submit", "POST", {
        description: "Used reusable containers for my grocery shopping today.",
        photo: "data:image/png;base64," + img.toString("base64"),
      });
      assert.equal(
        (await admin(`/admin/submissions/${start.id}/approve`, "POST", {}))
          .status,
        200,
      );
      assert.equal((await user("/account/notifications")).data.length, 1);
      assert.equal(
        (
          await user("/community/posts", "POST", {
            completionId: start.id,
            caption: "A reusable habit.",
            sharePhoto: true,
          })
        ).status,
        201,
      );
      const feed = (await user("/community/feed")).data;
      assert.equal(feed.length, 1);
      assert.equal(
        (
          await user(`/community/posts/${feed[0].id}/react`, "POST", {
            kind: "inspired",
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await member2(`/community/posts/${feed[0].id}/comments`, "POST", {
            body: "Nice work!",
          })
        ).status,
        201,
      );
      assert.equal((await user("/community/feed")).data[0].comments.length, 1);
      const team = (
        await user("/community/teams", "POST", { name: "Green Campus" })
      ).data;
      assert.equal(
        (
          await member2("/community/teams/join", "POST", {
            code: team.joinCode,
          })
        ).status,
        200,
      );
      assert.equal((await user("/community/teams")).data[0].points, 25);
      assert.ok((await user("/community/campaigns")).data.length);
      assert.equal((await user("/public/forest/" + u.id)).status, 404);
      await user("/account/privacy", "PATCH", { publicForest: true });
      assert.equal((await user("/public/forest/" + u.id)).status, 200);
      assert.equal((await admin("/admin/analytics")).status, 200);
      assert.equal((await admin("/admin/audit.csv")).status, 200);
      assert.equal((await user("/account/recommendations")).status, 200);
      assert.equal((await user("/account/streaks")).status, 200);
      assert.equal(
        (
          await member2("/account", "DELETE", {
            password: "StrongPassword123!",
            confirmation: "DELETE MY ECOVERSE",
          })
        ).status,
        200,
      );
    } finally {
      await new Promise((r) => server.close(r));
      await f.cleanup();
    }
  },
);
