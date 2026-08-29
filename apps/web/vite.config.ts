import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Dev proxy: browser hits Vite on :5173; WS upgrades are forwarded to
 * Bun on :8080. Same for /api/* HTTP. This keeps the SPA single-origin
 * during development and matches what Phase 5/6 will do in prod behind Fly.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        ws: false,
      },
      "/ws": {
        target: "ws://localhost:8080",
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});