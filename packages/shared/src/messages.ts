/**
 * Wire contract for typing-race — REQ-13 single source of truth.
 *
 * Both client and server import these Zod schemas. Validation happens at
 * every boundary: inbound WS frames are `safeParse`'d before dispatch;
 * outbound frames are constructed from the same inferred TS types so
 * nothing can drift between sender and receiver.
 */
import { z } from "zod";

// ──────────────────────────────────────────────────────────────────────────
// Client → Server
// ──────────────────────────────────────────────────────────────────────────

/** Latency probe — client asks server to echo back its timestamp. */
export const clientPingSchema = z.object({
  type: z.literal("ping"),
  clientTs: z.number().int().nonnegative(),
});

/** Join a 6-char room code with a nickname. */
export const joinRoomSchema = z.object({
  type: z.literal("join_room"),
  code: z.string().regex(/^[A-HJ-NP-Z2-9]{6}$/, "invalid room code"),
  nickname: z.string().min(1).max(20),
});

/** Leave the current room (no-op if not in one). */
export const leaveRoomSchema = z.object({
  type: z.literal("leave_room"),
});

export const clientToServerSchema = z.discriminatedUnion("type", [
  clientPingSchema,
  joinRoomSchema,
  leaveRoomSchema,
]);

export type ClientToServer = z.infer<typeof clientToServerSchema>;
export type ClientPing = z.infer<typeof clientPingSchema>;
export type JoinRoom = z.infer<typeof joinRoomSchema>;
export type LeaveRoom = z.infer<typeof leaveRoomSchema>;

// ──────────────────────────────────────────────────────────────────────────
// Server → Client
// ──────────────────────────────────────────────────────────────────────────

/** First frame a server sends to a freshly-upgraded connection. */
export const helloSchema = z.object({
  type: z.literal("hello"),
  playerId: z.string().uuid(),
  serverTs: z.number().int().nonnegative(),
});

/** Reply to a `ping` — round-trip latency probe. */
export const pongSchema = z.object({
  type: z.literal("pong"),
  clientTs: z.number().int().nonnegative(),
  serverTs: z.number().int().nonnegative(),
});

/** Server-side error notification. */
export const errorSchema = z.object({
  type: z.literal("error"),
  code: z.enum([
    "INVALID_FRAME",
    "INVALID_CODE",
    "ROOM_NOT_FOUND",
    "ROOM_FULL",
    "ALREADY_IN_ROOM",
    "NOT_IN_ROOM",
    "RATE_LIMITED",
    "INTERNAL",
  ]),
  message: z.string(),
});

export const serverToClientSchema = z.discriminatedUnion("type", [
  helloSchema,
  pongSchema,
  errorSchema,
]);

export type ServerToClient = z.infer<typeof serverToClientSchema>;
export type Hello = z.infer<typeof helloSchema>;
export type Pong = z.infer<typeof pongSchema>;
export type ServerError = z.infer<typeof errorSchema>;
export type ServerErrorCode = ServerError["code"];