import "dotenv/config";
import mysql from "mysql2/promise";
import { spawn } from "node:child_process";
import { access, open } from "node:fs/promises";
import { resolve } from "node:path";
const host = process.env.DB_HOST || "127.0.0.1",
  port = Number(process.env.DB_PORT || 3306);
const config = {
  host,
  port,
  user: process.env.DB_USER || "ecoverse",
  password: process.env.DB_PASSWORD || "",
  connectTimeout: 1500,
};
async function ready() {
  try {
    const c = await mysql.createConnection(config);
    await c.end();
    return true;
  } catch (e) {
    if (e.code !== "ECONNREFUSED")
      throw new Error(
        "MySQL connection failed. Check your private .env settings.",
      );
    return false;
  }
}
if (await ready()) {
  console.log("MySQL is ready.");
  process.exit(0);
}
if (process.platform !== "win32" || !["localhost", "127.0.0.1"].includes(host))
  throw new Error("Start your MySQL service, then retry.");
const directory = resolve(".local/mysql-8.4.6-winx64"),
  data = resolve(".local/mysql-data"),
  exe = resolve(directory, "bin/mysqld.exe");
try {
  await access(exe);
  await access(data);
} catch {
  throw new Error(
    "No bundled local MySQL installation. Install and start MySQL 8, as described in README.md.",
  );
}
const log = await open(resolve(".local/mysql-start.log"), "a");
const child = spawn(
  exe,
  [
    `--basedir=${directory}`,
    `--datadir=${data}`,
    `--port=${port}`,
    "--bind-address=127.0.0.1",
    "--mysqlx=OFF",
  ],
  { detached: true, windowsHide: true, stdio: ["ignore", log.fd, log.fd] },
);
child.unref();
await log.close();
for (let n = 0; n < 30; n++) {
  await new Promise((r) => setTimeout(r, 500));
  if (await ready()) {
    console.log("Local MySQL started.");
    process.exit(0);
  }
}
throw new Error(
  "MySQL did not become ready. Inspect .local/mysql-start.log locally.",
);
