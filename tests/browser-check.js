import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { databaseFixture } from "./database-fixture.js";
const fixture = await databaseFixture();
const { default: app } = await import("../server/app.js");
const server = app.listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const base = `http://127.0.0.1:${server.address().port}`;
process.env.APP_ORIGIN = base;
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});
try {
  const userContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    }),
    adminContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
  userContext.setDefaultTimeout(15000);
  adminContext.setDefaultTimeout(15000);
  const page = await userContext.newPage(),
    admin = await adminContext.newPage(),
    errors = [];
  for (const p of [page, admin]) {
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("response", (r) => {
      if (r.url().includes("/api/") && r.status() >= 400)
        console.log("API response", r.status(), new URL(r.url()).pathname);
    });
  }
  async function register(p, name, email) {
    await p.goto(base + "/auth.html");
    await p.getByLabel("Your name").fill(name);
    await p.getByLabel("Email", { exact: true }).fill(email);
    await p.getByLabel("Password", { exact: true }).fill("BrowserPassword123!");
    await p.getByRole("button", { name: "Create my account" }).click();
    await p.waitForURL("**/dashboard.html");
    await p.locator(".journey-score").waitFor();
  }
  console.log("Browser: registering member and reviewer");
  await register(page, "Browser Member", "browser@example.test");
  await register(admin, "Browser Reviewer", "reviewer@example.test");
  await fixture.rows(
    "UPDATE users SET role='admin' WHERE email='reviewer@example.test'",
  );
  console.log("Browser: starting challenge");
  await page.goto(base + "/challenges.html");
  await page.getByRole("link", { name: "Recycle Today", exact: true }).click();
  await page.getByRole("button", { name: "Start challenge" }).click();
  await page.locator("#proof-form").waitFor();
  const image = await sharp({
    create: { width: 100, height: 100, channels: 3, background: "#44724f" },
  })
    .png()
    .toBuffer();
  await page.getByLabel(/Upload evidence/).setInputFiles({
    name: "evidence.png",
    mimeType: "image/png",
    buffer: image,
  });
  await page.locator("#proof-preview").waitFor({ state: "visible" });
  await page
    .getByLabel("What did you do?")
    .fill(
      "I sorted clean paper and bottles into the correct recycling collection today.",
    );
  await page.getByLabel("Optional location").fill("Community collection point");
  await page.getByRole("button", { name: "Submit for verification" }).click();
  await page
    .getByRole("heading", { name: "Your proof is in the queue." })
    .waitFor();
  await page.goto(base + "/dashboard.html");
  await expect(page.locator(".score-number")).toHaveText("0");
  await expect(page.locator(".status-PENDING")).toHaveCount(1);
  await admin.goto(base + "/admin.html");
  await admin.getByRole("button", { name: "Review evidence" }).click();
  await admin.locator(".review-evidence img").waitFor();
  await expect(admin.locator(".review-evidence img")).toBeVisible();
  assert.equal(
    await admin
      .locator(".review-evidence img")
      .evaluate((el) => el.complete && el.naturalWidth > 0),
    true,
  );
  await admin
    .getByRole("button", { name: "Approve evidence", exact: true })
    .click();
  await admin.getByRole("heading", { name: "All caught up." }).waitFor();
  await page.reload();
  await expect(page.locator(".score-number")).toHaveText("20");
  await expect(page.locator(".trust-strip strong")).toHaveText("52%");
  await expect(page.getByText("First Seed", { exact: true })).toBeVisible();
  await page.goto(base + "/forest.html");
  await page.locator("#forest-canvas").waitFor({ state: "attached" });
  await expect(page.locator(".forest-hud")).toContainText("20 Eco Points");
  await page.getByRole("button", { name: "Night", exact: true }).click();
  await page.getByRole("button", { name: "Inspect trees" }).click();
  await expect(page.locator("#object-title")).toHaveText("1 trees unlocked");
  await page.goto(base + "/leaderboard.html");
  await expect(page.locator(".rank-row")).toContainText("Browser Member");
  await expect(page.locator(".rank-row")).toContainText("52%");
  // Rejection and correction are real UI paths, not direct point edits.
  await page.goto(base + "/challenge.html?id=2");
  await page.getByRole("button", { name: "Start challenge" }).click();
  await page.getByLabel(/Upload evidence/).setInputFiles({
    name: "energy.png",
    mimeType: "image/png",
    buffer: image,
  });
  await page
    .getByLabel("What did you do?")
    .fill("I switched off idle lights in an unused room before leaving.");
  await page.getByRole("button", { name: "Submit for verification" }).click();
  await page
    .getByRole("heading", { name: "Your proof is in the queue." })
    .waitFor();
  await admin.reload();
  await admin.getByRole("button", { name: "Review evidence" }).click();
  await admin
    .getByLabel("Review note / optional rejection reason")
    .fill("Please show which lights were switched off.");
  await admin
    .getByRole("button", { name: "Reject evidence", exact: true })
    .click();
  await admin.getByRole("heading", { name: "All caught up." }).waitFor();
  await page.reload();
  await expect(page.locator("#proof-section")).toContainText(
    "Please show which lights were switched off.",
  );
  await expect(
    page.getByRole("link", { name: "Resubmit proof" }),
  ).toBeVisible();
  await page.goto(base + "/profile.html");
  await page.getByLabel("Your name").fill("Greener Browser");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.locator("#profile-result")).toHaveText("Profile saved.");
  await page.goto(base + "/settings.html");
  await page.locator("#public-forest").check();
  await page.goto(base + "/showcase.html?id=1");
  await page.locator(".showcase-world").waitFor();
  await page.goto(base + "/community.html");
  await page.locator(".community-rail").waitFor();
  await expect(
    page.getByRole("heading", { name: "Plastic-Free Month" }),
  ).toBeVisible();
  await page.goto(base + "/explore.html");
  await page.locator(".quiz-panel").waitFor();
  await page
    .getByLabel("Choose a locally suitable native plant and care for it")
    .check();
  await page.getByRole("button", { name: "Check answer" }).click();
  await expect(page.locator(".quiz-panel [role=status]")).toContainText(
    "Correct.",
  );
  await page.goto(base + "/journey.html");
  await page.locator(".calendar-grid").waitFor();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download report" }).click();
  assert.match((await download).suggestedFilename(), /ecoverse-impact/);
  await mkdir(".local", { recursive: true });
  await page.goto(base + "/dashboard.html");
  await page.locator(".dashboard-landscape").waitFor();
  await page.screenshot({
    path: ".local/verified-dashboard-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of [
    "dashboard",
    "challenges",
    "challenge",
    "profile",
    "forest",
    "impact",
    "leaderboard",
    "journey",
    "explore",
    "community",
    "settings",
    "demo",
    "showcase",
  ]) {
    await page.goto(
      base +
        "/" +
        route +
        ".html" +
        (route === "challenge" ? "?id=2" : route === "showcase" ? "?id=1" : ""),
    );
    await page
      .locator(".loading-state")
      .waitFor({ state: "detached" })
      .catch(() => {});
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
      route + " overflows mobile",
    );
    if (route === "challenge" || route === "dashboard")
      await page.screenshot({
        path: ".local/verified-" + route + "-mobile.png",
        fullPage: true,
      });
  }
  await admin.setViewportSize({ width: 390, height: 844 });
  await admin.goto(base + "/admin.html");
  await admin.locator(".admin-metrics").waitFor();
  assert.equal(
    await admin.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
    "admin overflow",
  );
  await page.goto(base + "/index.html");
  await expect(
    page.getByRole("heading", { name: "Your actions. Grow a world." }),
  ).toBeVisible();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
    "home overflow",
  );
  assert.deepEqual(errors, []);
  console.log(
    "Browser flow passed: registration → proof → review → points → trust → forest → badge → leaderboard; rejection, quizzes, profile, report and nine mobile views.",
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
  await fixture.cleanup();
}
