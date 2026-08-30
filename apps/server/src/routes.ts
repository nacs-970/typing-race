import { Hono } from "hono";
import { recordSyncRequest } from "./clock/sync.ts";

/**
 * HTTP routes — Hono handles everything except /ws (which Bun.serve
 * upgrades natively for typed `ws.data`).
 */
const app = new Hono();

app.get("/health", (c) => c.text("ok"));

app.get("/api/clock-sync", (c) => {
  const { t1, t2 } = recordSyncRequest();
  return c.json({ t1, t2 });
});

export default app;