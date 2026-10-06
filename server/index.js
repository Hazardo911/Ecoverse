import app from "./app.js";
const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
const server = app.listen(port, host, () =>
  console.log(`EcoVerse API listening on ${host}:${port}`),
);
process.on("SIGTERM", () => server.close(() => process.exit(0)));
