import { Hono } from "hono";
import { logger } from "./logger.ts";
import routes from "./routes.ts";
import staticApp from "./static.ts";
import { dispatch } from "./ws/dispatch.ts";
import { type WsData, sendHello } from "./ws/handlers.ts";
import { tick } from "./race/controller.ts";
import { removePlayer, handlePlayerDisconnect } from "./rooms/manager.ts";
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
      const clientIp =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        srv.requestIP(req)?.address ??
        "127.0.0.1";
      const success = srv.upgrade(req, {
        data: {
          playerId,
          roomCode: null,
          nickname: null,
          clientOffsetMs: 0,
          ip: clientIp,
          lastPongAt: Date.now(),
        } satisfies WsData,
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
      activeSockets.add(ws);
      ws.data.lastPongAt = Date.now();
      logger.info({ playerId: ws.data.playerId }, "[ws] open");
      sendHello(ws);
    },
    pong(ws) {
      ws.data.lastPongAt = Date.now();
    },
    message(ws, raw) {
      dispatch(ws, raw);
    },
    close(ws, code, reason) {
      activeSockets.delete(ws);
      logger.info(
        { playerId: ws.data.playerId, code, reason: String(reason) },
        "[ws] close",
      );
      // Phase 4: 60s disconnect grace period (evicted after 60s if not reconnected)
      if (ws.data.roomCode) {
        handlePlayerDisconnect(ws.data.roomCode, ws.data.playerId, ws);
        ws.data.roomCode = null;
      }
    },
  },

  error(err) {
    logger.error({ err }, "[server] error");
    return new Response("Internal Server Error", { status: 500 });
  },
});

const activeSockets = new Set<import("bun").ServerWebSocket<WsData>>();

// 15s WS heartbeat — terminates dead sockets after 20s (15s ping + 5s timeout)
const heartbeatInterval = setInterval(() => {
  const now = Date.now();
  for (const ws of activeSockets) {
    if (now - (ws.data.lastPongAt ?? now) > 20_000) {
      logger.warn({ playerId: ws.data.playerId }, "[ws] heartbeat timeout");
      ws.close(1001, "Heartbeat timeout");
      activeSockets.delete(ws);
    } else {
      ws.ping();
    }
  }
}, 15_000);
heartbeatInterval.unref?.();

// 1Hz tick — drives Race Controller FSM transitions (countdown → racing)
const tickInterval = setInterval(() => {
  try {
    tick();
  } catch (err) {
    logger.error({ err }, "[tick] unhandled error");
  }
}, 1000);

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
    clearInterval(tickInterval);
    server.stop();
    process.exit(0);
  });
}