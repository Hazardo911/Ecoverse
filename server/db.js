import "dotenv/config";
import mysql from "mysql2/promise";
export const connectionOptions = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "ecoverse",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "ecoverse",
  timezone: "Z",
  dateStrings: true,
  decimalNumbers: true,
};
export const pool = mysql.createPool({
  ...connectionOptions,
  connectionLimit: 10,
  waitForConnections: true,
});
export async function rows(sql, args = [], db = pool) {
  return (await db.execute(sql, args))[0];
}
export async function transaction(work) {
  const db = await pool.getConnection();
  try {
    await db.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
    await db.beginTransaction();
    const result = await work(db);
    await db.commit();
    return result;
  } catch (e) {
    await db.rollback();
    throw e;
  } finally {
    db.release();
  }
}
export const fail = (status, message) =>
  Object.assign(new Error(message), { status });
export const day = () => new Date().toISOString().slice(0, 10);
