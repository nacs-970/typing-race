/**
 * WebSocket connection state — attached via `server.upgrade(req, { data })`.
 * Typed on the server side; the client never sees this directly.
 */
export type WsData = {
  playerId: string;
  roomCode: string | null;
  nickname: string | null;
  sessionToken?: string;
  ip?: string;
  lastPongAt?: number;
  /** NTP-computed offset between client and server clock (ms). Set by Plan 03. */
  clientOffsetMs: number;
};

/** Helper: send the initial `hello` frame to a freshly-upgraded socket. */
export function sendHello(ws: import("bun").ServerWebSocket<WsData>): void {
  ws.send(
    JSON.stringify({
      type: "hello",
      playerId: ws.data.playerId,
      serverTs: Date.now(),
    }),
  );
}

/** Helper: echo a `pong` reply to a `ping`. */
export function echoPing(
  ws: import("bun").ServerWebSocket<WsData>,
  clientTs: number,
): void {
  ws.send(
    JSON.stringify({
      type: "pong",
      clientTs,
      serverTs: Date.now(),
    }),
  );
}