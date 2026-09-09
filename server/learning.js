import { Router } from "express";
import { z } from "zod";
import { rows, transaction, fail } from "./db.js";
export const lessons = [
  {
    id: "forest",
    title: "Forests",
    copy: "Protect existing habitats as well as planting. Choose locally appropriate native plants and plan their long-term care.",
    question: "Which is a responsible planting plan?",
    options: [
      "Plant any fast-growing species anywhere",
      "Choose a locally suitable native plant and care for it",
      "Plant once and forget it",
    ],
    answer: 1,
    explanation:
      "Species choice, permission, local conditions, and ongoing care matter.",
  },
  {
    id: "climate",
    title: "Climate",
    copy: "Personal habits sit alongside wider changes in transport, energy, and policy. A digital tree is a progress symbol, not a carbon offset.",
    question: "What does your EcoVerse forest represent?",
    options: [
      "Verified participation in sustainable habits",
      "A certified carbon offset",
      "A precise measurement of CO₂ removed",
    ],
    answer: 0,
    explanation:
      "The forest visualizes reviewed participation. It does not certify carbon removal.",
  },
  {
    id: "water",
    title: "Water",
    copy: "Fixing wasteful routines helps conserve freshwater. Safe drinking water and hygiene always come first.",
    question: "Which action safely reduces avoidable water use?",
    options: [
      "Skip essential hygiene",
      "Drink less water",
      "Turn off a running tap while brushing",
    ],
    answer: 2,
    explanation:
      "Reduce unnecessary running water without compromising health.",
  },
  {
    id: "wildlife",
    title: "Wildlife",
    copy: "Habitat, food sources, and shelter help wildlife. Observe wild animals from a safe distance and avoid disturbing nests.",
    question: "How can you support local pollinators?",
    options: [
      "Disturb nests for photographs",
      "Grow suitable native flowering plants",
      "Feed every wild animal",
    ],
    answer: 1,
    explanation:
      "Locally suitable flowering plants can provide pollinator food and habitat.",
  },
  {
    id: "energy",
    title: "Energy",
    copy: "Avoid wasted electricity and use efficient routines. Never attempt unsafe electrical work for a challenge.",
    question: "What is a safe energy-saving habit?",
    options: [
      "Open live electrical wiring",
      "Overload an extension lead",
      "Switch off unused lights",
    ],
    answer: 2,
    explanation:
      "Switching off unused lights avoids waste without unsafe electrical work.",
  },
  {
    id: "waste",
    title: "Waste",
    copy: "Prevent waste first, then reuse and repair. Recycling rules differ locally; check what your collection accepts.",
    question: "What should you check before recycling?",
    options: [
      "Your local collection rules",
      "Only the colour of the item",
      "Whether it fits in any bin",
    ],
    answer: 0,
    explanation:
      "Accepted materials and preparation requirements depend on the local system.",
  },
  {
    id: "living",
    title: "Sustainable living",
    copy: "Repeat practical changes you can sustain. An honest description and a clear photo help a reviewer understand your action.",
    question: "When does an EcoVerse action earn points?",
    options: [
      "When you start it",
      "When an administrator approves your evidence",
      "When you pass this quiz",
    ],
    answer: 1,
    explanation:
      "Only approved real-world challenge submissions award Eco Points. Learning badges are separate.",
  },
];
export function learningRoutes(auth) {
  const r = Router();
  r.get("/", async (req, res) => {
    const results = req.session.userId
      ? await rows("SELECT topic,score FROM quiz_results WHERE user_id=?", [
          req.session.userId,
        ])
      : [];
    res.json({
      data: lessons.map(({ answer, explanation, ...l }) => ({
        ...l,
        passed: results.some((q) => q.topic === l.id && q.score === 1),
      })),
    });
  });
  r.post("/:topic/quiz", auth, async (req, res) => {
    const input = z
        .object({ answer: z.number().int().min(0).max(2) })
        .strict()
        .parse(req.body),
      lesson = lessons.find((l) => l.id === req.params.topic);
    if (!lesson) throw fail(404, "Lesson not found.");
    const passed = input.answer === lesson.answer;
    await transaction(async (db) => {
      await rows(
        "SELECT id FROM users WHERE id=? FOR UPDATE",
        [req.user.id],
        db,
      );
      await rows(
        "INSERT INTO quiz_results(user_id,topic,score) VALUES (?,?,?) ON DUPLICATE KEY UPDATE score=GREATEST(score,VALUES(score))",
        [req.user.id, lesson.id, passed ? 1 : 0],
        db,
      );
      const [s] = await rows(
        "SELECT COUNT(*) n FROM quiz_results WHERE user_id=? AND score=1",
        [req.user.id],
        db,
      );
      if (s.n === lessons.length)
        await rows(
          "INSERT IGNORE INTO user_badges(user_id,badge_id) VALUES (?,'curious-mind')",
          [req.user.id],
          db,
        );
    });
    res.json({
      data: { passed, explanation: lesson.explanation, pointsAwarded: 0 },
    });
  });
  return r;
}
