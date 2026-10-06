// Personal goals, private journal and cosmetic workshop use per-user JSON documents
// in MySQL. Financial/review data remains relational and is never written here.
import { AsyncLocalStorage } from "node:async_hooks";
import { rows, transaction, pool } from "./db.js";
const context = new AsyncLocalStorage();
export const featureContext = (req, res, next) =>
  context.run(req.user.id, next);
async function snapshot(userId, db = pool) {
  const [extra] = await rows(
      "SELECT payload FROM user_extras WHERE user_id=?",
      [userId],
      db,
    ),
    payload = extra?.payload || {};
  const completions = await rows(
    "SELECT c.*,ch.title,ch.category FROM challenge_completions c JOIN challenges ch ON ch.id=c.challenge_id WHERE c.user_id=? AND c.status='APPROVED'",
    [userId],
    db,
  );
  const transactions = await rows(
    "SELECT t.* FROM point_transactions t JOIN challenge_completions c ON c.id=t.reference_id AND c.status='APPROVED' WHERE t.user_id=? AND t.type='verified_action'",
    [userId],
    db,
  );
  return {
    userId,
    ...payload,
    completions,
    transactions,
    challenges: await rows("SELECT * FROM challenges", [], db),
    ...Object.fromEntries(
      ["goals", "journal", "purchases", "placements", "questClaims"].map(
        (k) => [k, payload[k] || []],
      ),
    ),
  };
}
export const readStore = () => snapshot(context.getStore());
export async function changeStore(change) {
  const userId = context.getStore();
  return transaction(async (db) => {
    await rows("SELECT id FROM users WHERE id=? FOR UPDATE", [userId], db);
    const data = await snapshot(userId, db),
      result = await change(data);
    const payload = Object.fromEntries(
      [
        "goals",
        "journal",
        "purchases",
        "placements",
        "questClaims",
        "forestGame",
        "legacyActions",
        "assessment",
      ]
        .filter((k) => data[k] !== undefined)
        .map((k) => [k, data[k]]),
    );
    await rows(
      "INSERT INTO user_extras(user_id,payload) VALUES (?,?) ON DUPLICATE KEY UPDATE payload=VALUES(payload)",
      [userId, JSON.stringify(payload)],
      db,
    );
    return result;
  });
}
export const nextId = (rows) =>
  rows.reduce((n, r) => Math.max(n, r.id || 0), 0) + 1;
