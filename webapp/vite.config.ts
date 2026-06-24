import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite + React for the word-game Telegram Mini App. The API base is injected at
// build time via VITE_API_BASE (e.g. https://api.wellversed.live); in local dev it
// falls back to http://localhost:8081 (see src/api.ts).
export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist", sourcemap: false },
});
