import app from "./app.js";
const server = app.listen(Number(process.env.PORT || 3001), "127.0.0.1", () =>
  console.log(`EcoVerse API: http://localhost:${process.env.PORT || 3001}`),
);
process.on("SIGTERM", () => server.close(() => process.exit(0)));
