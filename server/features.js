import { Router } from "express";
import { z } from "zod";
import { readStore, changeStore, nextId, featureContext } from "./store.js";
import { createForestGame, gameView, playForestAction } from "./forest-game.js";

const day = () => new Date().toISOString().slice(0, 10);
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
  );
const failure = (status, message) =>
  Object.assign(new Error(message), { status });
const categories = [
  "all",
  "energy",
  "water",
  "waste",
  "transport",
  "lifestyle",
  "nature",
];
export const shopCatalog = [
  {
    id: "fern",
    name: "Fern grove",
    cost: 20,
    description: "A cluster of woodland ferns.",
    kind: "fern",
    color: 0x64a36c,
  },
  {
    id: "flowers",
    name: "Wildflower patch",
    cost: 40,
    description: "Warm golden flowers for pollinators.",
    kind: "flowers",
    color: 0xf3bd62,
  },
  {
    id: "birch",
    name: "Silver birch",
    cost: 60,
    description: "A pale-trunked tree with airy leaves.",
    kind: "tree",
    color: 0x9ac783,
  },
  {
    id: "maple",
    name: "Autumn maple",
    cost: 80,
    description: "A copper canopy for a warmer forest.",
    kind: "tree",
    color: 0xd78650,
  },
  {
    id: "pond",
    name: "Quiet pond",
    cost: 100,
    description: "A small blue pool edged with stones.",
    kind: "pond",
    color: 0x6fbbbb,
  },
  {
    id: "lantern",
    name: "Firefly lantern",
    cost: 120,
    description: "A warm glowing marker among the trees.",
    kind: "lantern",
    color: 0xffd47e,
  },
];
export function wallet(userId, data) {
  const lifetime = data.transactions
    .filter((t) => t.user_id === userId)
    .reduce((n, t) => n + t.points, 0);
  const bonuses = data.questClaims
    .filter((q) => q.user_id === userId)
    .reduce((n, q) => n + q.reward, 0);
  const spent = data.purchases
    .filter((p) => p.user_id === userId)
    .reduce((n, p) => n + p.cost, 0);
  return { lifetime, bonuses, spent, balance: lifetime + bonuses - spent };
}
export function streaks(completions, now = day()) {
  const dates = [...new Set(completions.map((c) => c.completion_day))]
    .filter((d) => d <= now)
    .sort();
  let longest = 0,
    run = 0,
    previous;
  for (const date of dates) {
    run =
      previous && Date.parse(date) - Date.parse(previous) === 86400000
        ? run + 1
        : 1;
    longest = Math.max(longest, run);
    previous = date;
  }
  const yesterday = new Date(Date.parse(now) - 86400000)
    .toISOString()
    .slice(0, 10);
  let current = 0,
    cursor = dates.includes(now) ? now : yesterday;
  const set = new Set(dates);
  while (set.has(cursor)) {
    current++;
    cursor = new Date(Date.parse(cursor) - 86400000).toISOString().slice(0, 10);
  }
  return {
    current,
    longest,
    activeDays: dates.length,
    activeToday: set.has(now),
  };
}
export function weekStart(now = day()) {
  const date = new Date(now + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}
function categoryOf(c, data) {
  return (
    c.category ||
    data.challenges.find((x) => x.id === c.challenge_id)?.category ||
    "lifestyle"
  );
}
export function quests(userId, data, now = day()) {
  const week = weekStart(now),
    entries = data.completions.filter(
      (c) =>
        c.user_id === userId &&
        c.completion_day >= week &&
        c.completion_day <= now,
    );
  const seen = new Set(entries.map((c) => categoryOf(c, data))),
    days = new Set(entries.map((c) => c.completion_day));
  return [
    {
      id: "balanced",
      title: "A balanced week",
      description: "Have an energy, water, and transport action approved.",
      target: 3,
      progress: ["energy", "water", "transport"].filter((c) => seen.has(c))
        .length,
      reward: 30,
      steps: ["energy", "water", "transport"].map((category) => ({
        label: category,
        done: seen.has(category),
      })),
    },
    {
      id: "five-actions",
      title: "Build momentum",
      description: "Have five actions approved this week.",
      target: 5,
      progress: Math.min(5, entries.length),
      reward: 25,
    },
    {
      id: "three-days",
      title: "Keep showing up",
      description: "Be active on three separate days this week.",
      target: 3,
      progress: Math.min(3, days.size),
      reward: 40,
    },
  ].map((q) => ({
    ...q,
    week,
    claimed: data.questClaims.some(
      (c) => c.user_id === userId && c.week === week && c.quest_id === q.id,
    ),
  }));
}
function goalProgress(goal, data) {
  const count = data.completions.filter(
    (c) =>
      c.user_id === goal.user_id &&
      c.completion_day >= goal.startDate &&
      c.completion_day <= goal.deadline &&
      (goal.category === "all" || categoryOf(c, data) === goal.category),
  ).length;
  return {
    ...goal,
    progress: count,
    status: goal.archived
      ? "archived"
      : count >= goal.target
        ? "completed"
        : day() > goal.deadline
          ? "expired"
          : "active",
  };
}
function escape(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
export function featureRoutes(auth, progress) {
  const router = Router();
  router.use(auth);
  router.use(featureContext);
  router.get("/assessment", async (req, res) => {
    const data = await readStore();
    const payload = data.assessment || null;
    res.json({ data: payload });
  });
  router.put("/assessment", async (req, res) => {
    const input = z.object({
      mobility: z.enum(["rarely", "sometimes", "often"]),
      energy: z.enum(["rarely", "sometimes", "often"]),
      water: z.enum(["rarely", "sometimes", "often"]),
      waste: z.enum(["rarely", "sometimes", "often"]),
      food: z.enum(["rarely", "sometimes", "often"]),
      nature: z.enum(["rarely", "sometimes", "often"]),
      shopping: z.enum(["rarely", "sometimes", "often"]),
      motivation: z.enum(["learn", "routine", "community"]),
    }).strict().parse(req.body);
    const order = ["rarely", "sometimes", "often"], score = Object.fromEntries(
      Object.entries(input).filter(([key]) => key !== "motivation").map(([key, value]) => [key, order.indexOf(value)]),
    );
    const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
    const strongest = ranked[0][0], opportunity = ranked.at(-1)[0];
    const result = { ...input, score, strongest, opportunity, completedAt: new Date().toISOString() };
    await changeStore((data) => {
      data.assessment = result;
      return result;
    });
    res.json({ data: result });
  });
  router.get("/forest/game", async (req, res) => {
    const state = await progress(req.user.id);
    const result = await changeStore((data) => {
      data.forestGame ||= createForestGame(state);
      return gameView(data.forestGame, state);
    });
    res.json({ data: result });
  });
  router.post("/forest/game/action", async (req, res) => {
    const input = z.object({
      action: z.enum(["plant", "water", "weed", "rescue"]),
      plot: z.number().int().min(0).max(11).default(0),
      species: z.enum(["oak", "birch", "willow"]).optional(),
    }).strict().parse(req.body);
    const state = await progress(req.user.id);
    const result = await changeStore((data) => {
      data.forestGame ||= createForestGame(state);
      return playForestAction(data.forestGame, state, input);
    });
    res.json({ data: result });
  });
  router.get("/journey", async (req, res) => {
    const data = await readStore(),
      completions = data.completions.filter((c) => c.user_id === req.user.id),
      counts = {};
    for (const c of completions)
      counts[c.completion_day] = (counts[c.completion_day] || 0) + 1;
    res.json({
      data: {
        today: day(),
        streak: streaks(completions),
        calendar: counts,
        wallet: wallet(req.user.id, data),
        goals: data.goals
          .filter((g) => g.user_id === req.user.id && !g.archived)
          .map((g) => goalProgress(g, data)),
        quests: quests(req.user.id, data),
      },
    });
  });
  router.post("/goals", async (req, res) => {
    const input = z
      .object({
        title: z.string().trim().min(3).max(100),
        category: z.enum(categories),
        target: z.number().int().min(1).max(500),
        deadline: dateSchema,
      })
      .strict()
      .parse(req.body);
    if (input.deadline < day())
      throw failure(400, "Choose today or a future deadline.");
    const result = await changeStore((data) => {
      if (
        data.goals.filter((g) => g.user_id === req.user.id && !g.archived)
          .length >= 20
      )
        throw failure(409, "Archive an existing goal before adding another.");
      const goal = {
        ...input,
        id: nextId(data.goals),
        user_id: req.user.id,
        startDate: day(),
        archived: false,
      };
      data.goals.push(goal);
      return goalProgress(goal, data);
    });
    res.status(201).json({ data: result });
  });
  router.delete("/goals/:id", async (req, res) => {
    await changeStore((data) => {
      const g = data.goals.find(
        (g) => g.id === Number(req.params.id) && g.user_id === req.user.id,
      );
      if (!g) throw failure(404, "Goal not found.");
      g.archived = true;
      return true;
    });
    res.json({ data: { archived: true } });
  });
  router.post("/quests/:id/claim", async (req, res) => {
    const result = await changeStore((data) => {
      const q = quests(req.user.id, data).find((q) => q.id === req.params.id);
      if (!q) throw failure(404, "Quest not found.");
      if (q.claimed)
        throw failure(409, "This reward has already been claimed.");
      if (q.progress < q.target)
        throw failure(409, "Complete every quest step first.");
      data.questClaims.push({
        user_id: req.user.id,
        quest_id: q.id,
        week: q.week,
        reward: q.reward,
        claimed_at: new Date().toISOString(),
      });
      return { reward: q.reward, wallet: wallet(req.user.id, data) };
    });
    res.json({ data: result });
  });
  router.get("/shop", async (req, res) => {
    const data = await readStore();
    res.json({
      data: {
        catalog: shopCatalog,
        wallet: wallet(req.user.id, data),
        owned: data.purchases
          .filter((p) => p.user_id === req.user.id)
          .map((p) => p.item_id),
        placements: data.placements.filter((p) => p.user_id === req.user.id),
      },
    });
  });
  router.post("/shop/:id/buy", async (req, res) => {
    const result = await changeStore((data) => {
      const item = shopCatalog.find((c) => c.id === req.params.id);
      if (!item) throw failure(404, "Item not found.");
      if (
        data.purchases.some(
          (p) => p.user_id === req.user.id && p.item_id === item.id,
        )
      )
        throw failure(409, "You already own this item.");
      if (wallet(req.user.id, data).balance < item.cost)
        throw failure(
          409,
          "Earn verified actions or approved-action quest rewards to afford this item.",
        );
      data.purchases.push({
        user_id: req.user.id,
        item_id: item.id,
        cost: item.cost,
        purchased_at: new Date().toISOString(),
      });
      return { item, wallet: wallet(req.user.id, data) };
    });
    res.status(201).json({ data: result });
  });
  router.put("/forest/layout", async (req, res) => {
    const input = z
      .object({
        placements: z
          .array(
            z
              .object({
                item_id: z.string(),
                slot: z.number().int().min(0).max(5),
              })
              .strict(),
          )
          .max(6),
      })
      .strict()
      .parse(req.body);
    const result = await changeStore((data) => {
      const owned = new Set(
        data.purchases
          .filter((p) => p.user_id === req.user.id)
          .map((p) => p.item_id),
      );
      if (input.placements.some((p) => !owned.has(p.item_id)))
        throw failure(403, "Only owned items can be placed.");
      if (
        new Set(input.placements.map((p) => p.slot)).size !==
          input.placements.length ||
        new Set(input.placements.map((p) => p.item_id)).size !==
          input.placements.length
      )
        throw failure(400, "Each item and clearing can only be used once.");
      data.placements = data.placements
        .filter((p) => p.user_id !== req.user.id)
        .concat(input.placements.map((p) => ({ ...p, user_id: req.user.id })));
      return input.placements;
    });
    res.json({ data: result });
  });
  router.get("/journal", async (req, res) => {
    const data = await readStore();
    res.json({
      data: data.completions
        .filter((c) => c.user_id === req.user.id)
        .sort((a, b) => b.id - a.id)
        .map((c) => ({
          ...c,
          title:
            c.title ||
            data.challenges.find((x) => x.id === c.challenge_id)?.title ||
            "Eco action",
          category: categoryOf(c, data),
          note:
            data.journal.find(
              (j) => j.completion_id === c.id && j.user_id === req.user.id,
            )?.note || "",
          photo:
            data.journal.find(
              (j) => j.completion_id === c.id && j.user_id === req.user.id,
            )?.photo || null,
        })),
    });
  });
  router.put("/journal/:id", async (req, res) => {
    const input = z
      .object({
        note: z.string().trim().max(1500),
        photo: z.string().max(500000).nullable(),
      })
      .strict()
      .parse(req.body);
    if (input.photo) {
      const match =
        /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
          input.photo,
        );
      if (!match) throw failure(400, "Upload a JPEG or PNG photo.");
      const bytes = Buffer.from(match[2], "base64");
      const valid =
        match[1] === "jpeg"
          ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          : bytes
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      if (!valid) throw failure(400, "Invalid image file.");
    }
    const result = await changeStore((data) => {
      const id = Number(req.params.id);
      if (
        !data.completions.some((c) => c.id === id && c.user_id === req.user.id)
      )
        throw failure(404, "Action not found.");
      let entry = data.journal.find(
        (j) => j.completion_id === id && j.user_id === req.user.id,
      );
      if (!entry) {
        entry = { completion_id: id, user_id: req.user.id };
        data.journal.push(entry);
      }
      Object.assign(entry, input, { updated_at: new Date().toISOString() });
      return entry;
    });
    res.json({ data: result });
  });
  router.get("/report", async (req, res) => {
    const data = await readStore(),
      state = await progress(req.user.id),
      entries = data.completions.filter((c) => c.user_id === req.user.id),
      streak = streaks(entries),
      funds = wallet(req.user.id, data);
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>EcoVerse impact report</title><style>body{font:16px/1.6 system-ui;color:#173b29;max-width:900px;margin:50px auto;padding:25px}h1{font-size:44px}table{width:100%;border-collapse:collapse}td,th{padding:10px;text-align:left;border-bottom:1px solid #ddd}.metrics{display:flex;flex-wrap:wrap;gap:30px;background:#edf2e7;padding:20px}.metrics strong{display:block;font-size:30px}small{color:#52664d}@media print{body{margin:0;font-size:11pt}tr{break-inside:avoid}h2{break-after:avoid}}</style></head><body><small>ECOVERSE / PERSONAL IMPACT REPORT / ${day()} UTC</small><h1>${escape(req.user.name)}'s growing world</h1><p>All-time progress based on approved evidence. Generated on ${escape(new Date().toISOString())}.</p><div class="metrics"><div><strong>${state.ecoPoints}</strong>Lifetime Eco Points</div><div><strong>${state.challengesCompleted}</strong>Actions</div><div><strong>${state.forestLevel}</strong>Forest level</div><div><strong>${streak.longest}</strong>Best streak (days)</div></div><h2>Your ecosystem</h2><p>${state.treesUnlocked} trees unlocked · ${state.wildlifeUnlocked} wildlife unlocks · ${funds.balance} spendable points. Purchases never reduce forest growth.</p><h2>Badges</h2><p>${state.badges.map((b) => escape(b.name)).join(" · ") || "Complete your first action to earn a badge."}</p><h2>Personal goals</h2><ul>${
      data.goals
        .filter((g) => g.user_id === req.user.id && !g.archived)
        .map((g) => {
          const p = goalProgress(g, data);
          return `<li>${escape(g.title)}: ${p.progress}/${g.target} actions — ${p.status}, due ${g.deadline}</li>`;
        })
        .join("") || "<li>No goals yet.</li>"
    }</ul><h2>Action history</h2><table><thead><tr><th>Date (UTC)</th><th>Action</th><th>Category</th></tr></thead><tbody>${entries.map((c) => `<tr><td>${c.completion_day}</td><td>${escape(c.title || data.challenges.find((x) => x.id === c.challenge_id)?.title)}</td><td>${escape(categoryOf(c, data))}</td></tr>`).join("") || '<tr><td colspan="3">No actions recorded.</td></tr>'}</tbody></table><p><small>Evidence has been manually reviewed; this does not guarantee real-world impact. CO₂ estimates are unavailable without measured quantities. Open this file in a browser and choose Print → Save as PDF for a PDF copy.</small></p></body></html>`;
    res
      .set({
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="ecoverse-impact-${day()}.html"`,
        "Cache-Control": "no-store",
      })
      .send(html);
  });
  return router;
}
