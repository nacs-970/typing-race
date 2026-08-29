import { Hono } from "hono";

/**
 * HTTP routes — Hono handles everything except /ws (which Bun.serve
 * upgrades natively for typed `ws.data`).
 */
const app = new Hono();

app.get("/health", (c) => c.text("ok"));

export default app;