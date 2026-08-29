import { clientToServerSchema } from "@typing-race/shared";
import { logger } from "../logger.ts";
import { echoPing, type WsData } from "./handlers.ts";

/**
 * Decode + validate an inbound WS frame, then dispatch by `type`.
 * Invalid frames log a warning and are dropped — Phase 1 keeps the
 * connection open so devs can keep iterating without losing state.
 */
export function dispatch(
  ws: import("bun").ServerWebSocket<WsData>,
  raw: string | ArrayBuffer | Uint8Array,
): void {
  let text: string;
  if (typeof raw === "string") {
    text = raw;
  } else if (raw instanceof ArrayBuffer) {
    text = new TextDecoder().decode(new Uint8Array(raw));
  } else {
    text = new TextDecoder().decode(raw);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    logger.warn({ err, raw: text.slice(0, 200) }, "[ws] invalid JSON");
    return;
  }

  const result = clientToServerSchema.safeParse(parsed);
  if (!result.success) {
    logger.warn(
      { issues: result.error.issues, raw: text.slice(0, 200) },
      "[ws] frame failed schema validation",
    );
    return;
  }

  const msg = result.data;
  switch (msg.type) {
    case "ping":
      echoPing(ws, msg.clientTs);
      break;
    case "join_room":
      logger.info(
        { playerId: ws.data.playerId, code: msg.code, nickname: msg.nickname },
        "[ws] join_room",
      );
      ws.data.roomCode = msg.code;
      break;
    case "leave_room":
      logger.info({ playerId: ws.data.playerId }, "[ws] leave_room");
      ws.data.roomCode = null;
      break;
    default: {
      // Exhaustive switch — TS will yell if a new message type is added
      // without a corresponding case here.
      const _exhaustive: never = msg;
      void _exhaustive;
    }
  }
}