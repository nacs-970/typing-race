import { Hono } from "hono";
import { recordSyncRequest } from "./clock/sync.ts";
import staticApp from "./static.ts";
import { NODE_ENV, MODE } from "./env.ts";

/**
 * Gateway HTTP routes.
 */
const app = new Hono();

app.get("/health", (c) => {
  return c.json({
    ok: true,
    timestamp: Date.now(),
    uptime: process.uptime(),
  });
});

app.get("/api/clock-sync", (c) => {
  const { t1, t2 } = recordSyncRequest();
  return c.json({ t1, t2 });
});

// In production or unified mode, serve static assets
if (NODE_ENV === "production" || MODE === "unified") {
  app.route("/", staticApp);
}

export default app;
