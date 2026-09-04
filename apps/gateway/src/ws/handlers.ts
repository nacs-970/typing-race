import type { ServerWebSocket, WebSocketHandler } from "bun";
import type { EventBridge, EngineToGatewayEvent } from "@typing-race/shared/bridge";
import { logger } from "../logger.ts";
import { clientManager, type ClientManager } from "./client-manager.ts";
import { dispatch } from "./dispatch.ts";

export type WsData = {
  playerId: string;
  roomCode: string | null;
  ip: string;
  lastPingAt: number;
  lastPongAt?: number;
  clientOffsetMs: number;
};

export function sendHello(ws: ServerWebSocket<WsData>): void {
  ws.send(
    JSON.stringify({
      type: "hello",
      playerId: ws.data.playerId,
      serverTs: Date.now(),
    }),
  );
}

export function echoPong(ws: ServerWebSocket<WsData>, clientTs: number): void {
  ws.send(
    JSON.stringify({
      type: "pong",
      clientTs,
      serverTs: Date.now(),
    }),
  );
}

/**
 * Subscribes Gateway socket dispatcher to outbound EngineToGateway events.
 */
export function bindBridgeToGateway(
  bridge: EventBridge,
  manager: ClientManager = clientManager,
): () => void {
  return bridge.onGatewayEvent((event: EngineToGatewayEvent) => {
    switch (event.type) {
      case "broadcast_to_room": {
        const sockets = manager.getRoomSockets(event.roomCode, event.excludePlayerId);
        const json = JSON.stringify(event.payload);
        for (const ws of sockets) {
          try {
            ws.send(json);
          } catch (err) {
            logger.warn({ err, playerId: ws.data.playerId }, "[gateway] failed to send broadcast");
          }
        }
        break;
      }

      case "send_to_client": {
        const ws = manager.getSocket(event.playerId);
        if (ws) {
          try {
            ws.send(JSON.stringify(event.payload));
          } catch (err) {
            logger.warn({ err, playerId: event.playerId }, "[gateway] failed to send frame to client");
          }
        }
        break;
      }

      case "disconnect_client": {
        const ws = manager.getSocket(event.playerId);
        if (ws) {
          try {
            ws.close(event.code ?? 1000, event.reason ?? "Disconnected by server");
          } catch {
            // ignore
          }
        }
        break;
      }

      case "player_room_assigned": {
        manager.assignRoom(event.playerId, event.roomCode);
        break;
      }

      case "player_room_cleared": {
        manager.clearRoom(event.playerId, event.roomCode);
        break;
      }
    }
  });
}

/**
 * Creates Bun.serve websocket hooks wired to the EventBridge and ClientManager.
 */
export function createWebSocketHandlers(
  bridge: EventBridge,
  manager: ClientManager = clientManager,
): WebSocketHandler<WsData> {
  return {
    idleTimeout: 120,
    maxPayloadLength: 16 * 1024,
    backpressureLimit: 1024 * 1024,
    closeOnBackpressureLimit: true,
    sendPings: true,
    perMessageDeflate: true,

    open(ws) {
      manager.addSocket(ws.data.playerId, ws);
      ws.data.lastPongAt = Date.now();
      logger.info({ playerId: ws.data.playerId }, "[ws] open");
      sendHello(ws);

      void bridge.publishToEngine({
        type: "client_connected",
        playerId: ws.data.playerId,
        ip: ws.data.ip,
        serverTs: Date.now(),
      });
    },

    pong(ws) {
      ws.data.lastPongAt = Date.now();
    },

    message(ws, raw) {
      dispatch(ws, raw, bridge, manager);
    },

    close(ws, code, reason) {
      const { playerId, roomCode } = ws.data;
      manager.removeSocket(playerId);
      logger.info({ playerId, code, reason: String(reason) }, "[ws] close");

      void bridge.publishToEngine({
        type: "client_disconnected",
        playerId,
        roomCode,
        serverTs: Date.now(),
      });
    },
  };
}

/**
 * Starts the 15-second heartbeat ping ticker.
 * Closes unresponsive sockets after 20 seconds.
 */
export function startHeartbeat(
  manager: ClientManager = clientManager,
  intervalMs = 15_000,
  timeoutMs = 20_000,
): NodeJS.Timeout {
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [playerId, ws] of manager.sockets) {
      if (now - (ws.data.lastPongAt ?? now) > timeoutMs) {
        logger.warn({ playerId }, "[ws] heartbeat timeout");
        try {
          ws.close(1001, "Heartbeat timeout");
        } catch {
          // ignore
        }
        manager.removeSocket(playerId);
      } else {
        try {
          ws.ping();
        } catch {
          // ignore
        }
      }
    }
  }, intervalMs);

  interval.unref?.();
  return interval;
}
