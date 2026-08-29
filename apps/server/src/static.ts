import { Hono } from "hono";

/**
 * Static-file shim for dev — Phase 1 uses Vite's dev server on :5173 to
 * serve the SPA, so this only catches direct :8080 hits that aren't /health
 * or /ws. Plan 02 will replace this with a real `serveStatic` mount.
 */
const app = new Hono();

app.get("*", (c) =>
  c.text(
    "Typing Race dev server. Use the Vite dev server at http://localhost:5173 for the SPA. " +
      "This endpoint serves the API + WebSocket only.",
    200,
  ),
);

export default app;