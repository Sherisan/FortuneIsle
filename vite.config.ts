declare const process: { env: Record<string, string | undefined> };
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: /api is proxied to the game API (FeedingFranzeeAPI, default http://localhost:5003; override with API_PROXY).
// Production builds call the API directly via VITE_API_BASE (.env.production).
// Open the game with ?demo (or set VITE_DEMO=1) to play offline against the in-browser demo engine.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5197,
    proxy: {
      '/api': { target: process.env.API_PROXY ?? 'http://localhost:5003', changeOrigin: true },
    },
  },
});
