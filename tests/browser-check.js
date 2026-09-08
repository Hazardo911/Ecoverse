import { chromium } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
const directory = await mkdtemp(join(tmpdir(), "ecoverse-browser-"));
process.env.DATA_FILE = join(directory, "state.json");
process.env.NODE_ENV = "development";
const { default: app } = await import("../server/app.js");
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
process.env.APP_ORIGIN = base;
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/auth.html");
  await page.getByLabel("Your name").fill("Browser Member");
  await page.getByLabel("Email", { exact: true }).fill("browser@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Long-browser-password");
  await page.getByRole("button", { name: "Create my account" }).click();
  await page.waitForURL("**/forest.html");
  await page.locator("#forest-canvas").waitFor();
  await page.goto(base + "/challenges.html");
  await page.getByRole("button", { name: "Record action" }).first().click();
  await page.getByRole("button", { name: "Completed today" }).waitFor();
  assert.equal(await page.locator("#points").textContent(), "20");
  await page.reload();
  await page.getByRole("button", { name: "Completed today" }).waitFor();
  await page.goto(base + "/forest.html");
  await page
    .getByRole("button", { name: "Buy for 20 points", exact: true })
    .click();
  await page.getByRole("button", { name: "Place ↗", exact: true }).waitFor();
  await page.getByRole("button", { name: "Place ↗", exact: true }).click();
  await page.locator(".clearing.occupied").waitFor();
  await page.reload();
  await page.locator(".clearing.occupied").waitFor();
  assert.equal(await page.locator(".wallet-balance strong").textContent(), "0");
  await page.goto(base + "/journey.html");
  await page.getByRole("button", { name: "goals", exact: true }).click();
  await page.getByLabel("Goal name").fill("One recycling action");
  await page.getByRole("combobox", { name: /Category/ }).selectOption("waste");
  await page.getByLabel("Target actions").fill("1");
  await page
    .getByLabel("Deadline (UTC)")
    .fill(new Date().toISOString().slice(0, 10));
  await page.getByRole("button", { name: "Set goal" }).click();
  await page.locator(".goal-item").waitFor();
  assert.match(await page.locator(".goal-item").textContent(), /completed/);
  await page.getByRole("button", { name: "journal", exact: true }).click();
  await page.getByRole("button", { name: "Add note / photo" }).click();
  await page.getByLabel("Your note").fill("Sorted paper and glass today.");
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 20;
    c.height = 20;
    c.getContext("2d").fillRect(0, 0, 20, 20);
    return c.toDataURL("image/png").split(",")[1];
  });
  await page
    .getByLabel("Photo (JPEG or PNG, up to 5 MB)")
    .setInputFiles({
      name: "test.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
  await page.locator("#photo-preview").waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Save entry" }).click();
  await page.locator(".journal-entry img").waitFor();
  assert.match(
    await page.locator(".journal-note").textContent(),
    /Sorted paper/,
  );
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download report" }).click();
  assert.match((await download).suggestedFilename(), /ecoverse-impact.*html/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "/journey.html");
  await page.locator(".calendar-grid").waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({ path: ".local/journey-mobile.png" });
  await page.goto(base + "/forest.html");
  await page.locator(".shop-grid").waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.goto(base + "/impact.html");
  await page.locator(".impact-totals").waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Browser passed: registration, reward, purchase/placement persistence, goals, photo journal, report download, mobile layouts, no page errors.",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  await rm(directory, { recursive: true, force: true });
}
