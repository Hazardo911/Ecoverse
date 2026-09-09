import { rows, pool } from "./db.js";
const email = process.argv[2]?.trim().toLowerCase();
try {
  if (!email)
    throw new Error("Usage: npm run admin:grant -- email@example.com");
  const r = await rows("UPDATE users SET role='admin' WHERE email=?", [email]);
  if (!r.affectedRows) throw new Error("Register this account first.");
  console.log(
    "Administrator granted. No restart needed. Administrators cannot review their own submissions.",
  );
} finally {
  await pool.end();
}
