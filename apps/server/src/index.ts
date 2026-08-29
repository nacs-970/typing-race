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

    return staticApp.fetch(req);
  },

  websocket: {
    idleTimeout: 120,
    maxPayloadLength: 16 * 1024,
    backpressureLimit: 1024 * 1024,
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

logger.info({ port: server.port }, "[server] listening");

for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => {
    logger.info({ sig }, "[server] shutdown signal");
    server.stop();
    process.exit(0);
  });
}