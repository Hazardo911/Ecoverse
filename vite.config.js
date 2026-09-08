import { defineConfig } from "vite";
import { sites } from "@openai/sites-vite-plugin";

export default defineConfig({
  plugins: [sites()],
  server: { proxy: { "/api": "http://127.0.0.1:3001" } },
  build: {
    rollupOptions: {
      input: {
        journey: 'journey.html',
        home: "index.html",
        explore: "explore.html",
        challenges: "challenges.html",
        forest: "forest.html",
        impact: "impact.html",
        leaderboard: "leaderboard.html",
        about: "about.html",
        auth: "auth.html",
        admin: "admin.html",
      },
    },
  },
});
