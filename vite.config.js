import { defineConfig } from 'vite';
import { sites } from '@openai/sites-vite-plugin';

export default defineConfig({
  plugins: [sites()],
  build: {
    rollupOptions: {
      input: {
        home: 'index.html', explore: 'explore.html', challenges: 'challenges.html',
        forest: 'forest.html', impact: 'impact.html', leaderboard: 'leaderboard.html', about: 'about.html'
      }
    }
  }
});
