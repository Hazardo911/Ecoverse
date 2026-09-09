import session from "express-session";
import { rows } from "./db.js";
export class MySQLSessionStore extends session.Store {
  get(id, cb) {
    rows("SELECT data FROM sessions WHERE session_id=? AND expires>?", [
      id,
      Math.floor(Date.now() / 1000),
    ])
      .then((r) => cb(null, r[0] ? JSON.parse(r[0].data) : null))
      .catch(cb);
  }
  set(id, data, cb = () => {}) {
    const expires = Math.floor(
      new Date(data.cookie.expires || Date.now() + 7 * 86400000).getTime() /
        1000,
    );
    rows(
      "INSERT INTO sessions(session_id,expires,data) VALUES (?,?,?) ON DUPLICATE KEY UPDATE expires=VALUES(expires),data=VALUES(data)",
      [id, expires, JSON.stringify(data)],
    )
      .then(() => cb())
      .catch(cb);
  }
  destroy(id, cb = () => {}) {
    rows("DELETE FROM sessions WHERE session_id=?", [id])
      .then(() => cb())
      .catch(cb);
  }
  touch(id, data, cb) {
    this.set(id, data, cb);
  }
}
