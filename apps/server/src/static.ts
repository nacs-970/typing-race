import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import path from "node:path";

/**
 * Production static SPA serving.
 *
 * `import.meta.dir` is `/app/apps/server/src` when WORKDIR is `/app/apps/server`
 * (the Dockerfile in Plan 03 sets that WORKDIR). From there, the SPA build
 * lives at `../../web/dist`.
 *
 * Hono's `serveStatic` from `hono/bun` resolves paths safely — it refuses to
 * escape `root` (Pitfall T-02-01: path traversal mitigation). Never hand-roll
 * `Bun.file(path)` resolution; serveStatic handles it.
 *
 * `precompressed: true` lets serveStatic pick `.gz` / `.br` siblings when
 * the client's `Accept-Encoding` header advertises support, setting the
 * `Content-Encoding` response header automatically.
 */
const DIST = path.resolve(import.meta.dir, "../../web/dist");

const app = new Hono();

// Content-hashed assets: cache forever (filename changes when content does).
app.use(
  "/assets/*",
  serveStatic({
    root: DIST,
    precompressed: true,
    onFound: (_path, c) =>
      c.header("Cache-Control", "public, max-age=31536000, immutable"),
  }),
);

// SPA fallback: every other GET returns index.html so client-side routing
// works. index.html MUST revalidate so deploys take effect immediately.
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