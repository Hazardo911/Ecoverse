import "dotenv/config";
import mysql from "mysql2/promise";
import { parse } from "dotenv";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
export async function databaseFixture() {
  let local = {};
  try {
    local = parse(await readFile(".local/root.env", "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  const config = {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user:
      process.env.TEST_DB_USER ||
      (local.MYSQL_ROOT_PASSWORD ? "root" : process.env.DB_USER),
    password:
      process.env.TEST_DB_PASSWORD ||
      local.MYSQL_ROOT_PASSWORD ||
      process.env.DB_PASSWORD,
  };
  const admin = await mysql.createConnection(config),
    name = "ecoverse_test_" + randomBytes(6).toString("hex");
  await admin.query(
    `CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  const proofDir = await mkdtemp(join(tmpdir(), "ecoverse-proof-test-"));
  process.env.DB_NAME = name;
  process.env.DB_USER = config.user;
  process.env.DB_PASSWORD = config.password;
  process.env.PROOF_DIR = proofDir;
  const { migrate } = await import("../server/migrate.js");
  await migrate();
  const { pool, rows } = await import("../server/db.js");
  return {
    rows,
    pool,
    name,
    proofDir,
    async cleanup() {
      await pool.end();
      if (!/^ecoverse_test_[a-f0-9]{12}$/.test(name))
        throw new Error("Unsafe test database name");
      await admin.query(`DROP DATABASE \`${name}\``);
      await admin.end();
      if (!resolve(proofDir).startsWith(resolve(tmpdir()) + requireSeparator()))
        throw new Error("Unsafe proof temp path");
      await rm(proofDir, { recursive: true, force: true });
    },
  };
}
function requireSeparator() {
  return process.platform === "win32" ? "\\" : "/";
}
