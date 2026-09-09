import "dotenv/config";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { pool, rows, transaction } from "../server/db.js";
import { forestFromPoints } from "../server/progression.js";

const scrypt = promisify(scryptCallback);
const DEMO_PASSWORD = "EcoverseDemo2026!";
const people = [
  ["Aarav Mehta", "aarav.demo@example.test", 28, 94],
  ["Maya Green", "maya.demo@example.test", 24, 92],
  ["EcoVerse Demo", "ecoverse.demo@example.com", 20, 90],
  ["Zoya Khan", "zoya.demo@example.test", 17, 87],
  ["Kabir Rao", "kabir.demo@example.test", 13, 84],
  ["Nina Joseph", "nina.demo@example.test", 9, 78],
];

async function passwordHash(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${(await scrypt(password, salt, 64)).toString("hex")}`;
}

async function seedPerson([name, email, actionCount, trust], challenges) {
  const hash = await passwordHash(DEMO_PASSWORD);
  await rows(
    "INSERT INTO users(name,email,password_hash,trust_score,public_forest) VALUES (?,?,?,?,TRUE) ON DUPLICATE KEY UPDATE name=VALUES(name),password_hash=VALUES(password_hash),trust_score=VALUES(trust_score),public_forest=TRUE",
    [name, email, hash, trust],
  );
  const [user] = await rows("SELECT id FROM users WHERE email=?", [email]);
  await transaction(async (db) => {
    const existing = await rows(
      "SELECT id FROM challenge_completions WHERE user_id=? AND proof_url LIKE 'demo-seed:%'",
      [user.id], db,
    );
    if (existing.length) {
      await rows(`DELETE FROM point_transactions WHERE reference_id IN (${existing.map(() => "?").join(",")})`, existing.map(x => x.id), db);
      await rows(`DELETE FROM challenge_completions WHERE id IN (${existing.map(() => "?").join(",")})`, existing.map(x => x.id), db);
    }
    let points = 0;
    for (let i = 0; i < actionCount; i++) {
      const challenge = challenges[i % challenges.length],
        age = i < 6 ? i : 7 + i,
        stamp = new Date(Date.now() - age * 86400000),
        date = stamp.toISOString().slice(0, 10),
        completed = stamp.toISOString().slice(0, 19).replace("T", " ");
      const result = await rows(
        "INSERT INTO challenge_completions(user_id,challenge_id,completion_day,completed_at,status,proof_url,description,submitted_at,reviewed_at,points_snapshot,proof_required) VALUES (?,?,?,?, 'APPROVED',?, ?,?,?,?,TRUE)",
        [user.id, challenge.id, date, completed, `demo-seed:${email}:${i}`, "Seeded demonstration action", completed, completed, challenge.points], db,
      );
      await rows(
        "INSERT INTO point_transactions(user_id,points,type,reference_id,created_at) VALUES (?,?,'verified_action',?,?)",
        [user.id, challenge.points, result.insertId, completed], db,
      );
      points += challenge.points;
    }
    const forest = forestFromPoints(points);
    await rows("UPDATE users SET eco_points=?,eco_score=? WHERE id=?", [points, Math.min(100, Math.floor(points / 25)), user.id], db);
    await rows(
      "INSERT INTO forest_progress(user_id,forest_level,growth_points,trees_unlocked,wildlife_unlocked) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE forest_level=VALUES(forest_level),growth_points=VALUES(growth_points),trees_unlocked=VALUES(trees_unlocked),wildlife_unlocked=VALUES(wildlife_unlocked)",
      [user.id, forest.forestLevel, points, forest.treesUnlocked, forest.wildlifeUnlocked], db,
    );
    const earned = [
      actionCount >= 1 && "first-seed",
      points >= 500 && "growing-strong",
      points >= 1000 && "forest-keeper",
      actionCount >= 20 && "ecosystem-builder",
      points >= 2000 && "planet-friend",
      trust >= 90 && actionCount >= 20 && "trust-keeper",
    ].filter(Boolean);
    for (const badge of earned)
      await rows(
        "INSERT IGNORE INTO user_badges(user_id,badge_id,legacy) VALUES (?,?,FALSE)",
        [user.id, badge], db,
      );
  });
}

try {
  const challenges = await rows("SELECT id,points FROM challenges WHERE is_active=TRUE ORDER BY points DESC,id LIMIT 8");
  if (!challenges.length) throw new Error("Run npm run db:init before seeding demo accounts.");
  for (const person of people) await seedPerson(person, challenges);
  console.log("Demo leaderboard seeded.");
  console.log("Login: ecoverse.demo@example.com");
  console.log(`Password: ${DEMO_PASSWORD}`);
} finally {
  await pool.end();
}
