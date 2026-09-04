import type { ServerWebSocket } from "bun";
import { clientToServerSchema } from "@typing-race/shared";
import type { EventBridge } from "@typing-race/shared/bridge";
import { logger } from "../logger.ts";
import { ipRateLimiter } from "../rate-limit/ip-limiter.ts";
import type { WsData } from "./handlers.ts";
import { echoPong } from "./handlers.ts";
import { clientManager, type ClientManager } from "./client-manager.ts";

export function dispatch(
  ws: ServerWebSocket<WsData>,
  raw: string | ArrayBuffer | Uint8Array,
  bridge: EventBridge,
  _manager: ClientManager = clientManager,
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

  // Handle gateway-local frames
  if (msg.type === "ping") {
    echoPong(ws, msg.clientTs);
    return;
  }

  if (msg.type === "clock_sync") {
    const t1 = Date.now();
    const t2 = Date.now();
    ws.data.clientOffsetMs = ((t1 - msg.t0) + (t2 - msg.t3)) / 2;
    echoPong(ws, msg.t0);
    return;
  }

  if (msg.type === "create_room") {
    const ip = ws.data.ip ?? "127.0.0.1";
    if (!ipRateLimiter.check(ip)) {
      ws.send(
        JSON.stringify({
          type: "error",
          code: "RATE_LIMITED",
          message: "Too many rooms created from this IP. Limit is 10 per hour.",
        }),
      );
      return;
    }
  }

  // Forward valid game frames to Engine via EventBridge
  void bridge.publishToEngine({
    type: "client_message",
    playerId: ws.data.playerId,
    roomCode: ws.data.roomCode,
    ip: ws.data.ip ?? "127.0.0.1",
    clientOffsetMs: ws.data.clientOffsetMs ?? 0,
    message: msg,
    serverTs: Date.now(),
  });
}
