import { Hono } from "hono";
import { logger } from "./logger.ts";
import routes from "./routes.ts";
import staticApp from "./static.ts";
import { dispatch } from "./ws/dispatch.ts";
import { type WsData, sendHello } from "./ws/handlers.ts";
import { PORT } from "./env.ts";

/**
 * Bun-native WS upgrade (NOT Hono's upgradeWebSocket — that wraps an EventTarget
 * and we lose typed `ws.data`). Bun.serve's typed generic gives us a single
 * source of truth for connection state across open/message/close.
 *
 * Production WS knobs (RESEARCH.md Known-Gotchas table):
 *   idleTimeout: 120               — 2 min, matches Bun's max; Phase 2 adds app ping
 *   maxPayloadLength: 16 * 1024   — refuse oversize frames (trivial DoS mitigation)
 *   backpressureLimit: 1 MB        — slow consumer triggers close + log
 *   closeOnBackpressureLimit: true — explicit signal, not silent buffer growth
 *   sendPings: true                — Bun emits WS pings automatically
 *   perMessageDeflate: true        — negotiate permessage-deflate for wire savings
 */
const server = Bun.serve<WsData>({
  port: PORT,

  fetch(req, srv) {
    const url = new URL(req.url);

    if (url.pathname === "/ws") {
      const playerId = crypto.randomUUID();
      const success = srv.upgrade(req, {
        data: { playerId, roomCode: null } satisfies WsData,
      });
      if (success) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    if (url.pathname === "/health" || url.pathname.startsWith("/api/")) {
      return routes.fetch(req);
    }

    if (process.env.NODE_ENV === "production") {
      return staticApp.fetch(req);
    }

    return new Response(
      "dev: not found. Use Vite at http://localhost:5173 or run `bun run build` for prod.",
      { status: 404 },
    );
  },

  websocket: {
    idleTimeout: 120,
    maxPayloadLength: 16 * 1024,
    backpressureLimit: 1024 * 1024,
    closeOnBackpressureLimit: true,
    sendPings: true,
    perMessageDeflate: true,

    open(ws) {
      logger.info({ playerId: ws.data.playerId }, "[ws] open");
      sendHello(ws);
    },
    message(ws, raw) {
      dispatch(ws, raw);
    },
    close(ws, code, reason) {
      logger.info(
        { playerId: ws.data.playerId, code, reason: String(reason) },
        "[ws] close",
      );
    },
  },

  error(err) {
    logger.error({ err }, "[server] error");
    return new Response("Internal Server Error", { status: 500 });
  },
});

console.log(
  JSON.stringify({
    level: "info",
    msg: "server.listening",
    port: server.port,
    env: process.env.NODE_ENV ?? "development",
    wsKnobs: {
      idleTimeout: 120,
      maxPayloadLength: 16384,
      backpressureLimit: 1048576,
      sendPings: true,
      perMessageDeflate: true,
    },
  }),
);

for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => {
    logger.info({ sig }, "[server] shutdown signal");
    server.stop();
    process.exit(0);
  });
}