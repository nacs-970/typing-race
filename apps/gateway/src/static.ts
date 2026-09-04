import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import path from "node:path";

/**
 * Production static SPA serving.
 * Resolves static SPA dist directory from STATIC_DIR or relative to import.meta.dir.
 */
const DIST = process.env["STATIC_DIR"] || path.resolve(import.meta.dir, "../../web/dist");

const app = new Hono();

// Content-hashed assets: cache forever
app.use(
  "/assets/*",
  serveStatic({
    root: DIST,
    precompressed: true,
    onFound: (_path, c) =>
      c.header("Cache-Control", "public, max-age=31536000, immutable"),
  }),
);

// SPA fallback: every other GET returns index.html
app.get(
  "*",
  serveStatic({
    root: DIST,
    path: "./index.html",
    precompressed: true,
    onFound: (_path, c) => c.header("Cache-Control", "no-cache"),
  }),
);

export default app;
