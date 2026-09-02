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
// Shared regex / helpers
// ──────────────────────────────────────────────────────────────────────────

const ROOM_CODE_REGEX = /^[A-HJ-NP-Z2-9]{6}$/;
const PLAYER_SUMMARY = z.object({
  playerId: z.string().uuid(),
  nickname: z.string(),
  isHost: z.boolean(),
  progress: z.number().int().nonnegative(),
});

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
  code: z.string().regex(ROOM_CODE_REGEX, "invalid room code"),
  nickname: z.string().min(1).max(20),
});

/** Leave the current room (no-op if not in one). */
export const leaveRoomSchema = z.object({
  type: z.literal("leave_room"),
});

/** Create a new room; client becomes the host. */
export const createRoomSchema = z.object({
  type: z.literal("create_room"),
  nickname: z.string().min(1).max(20),
});

/** NTP-style clock sync round-trip (WS backup path; HTTP is primary). */
export const clockSyncSchema = z.object({
  type: z.literal("clock_sync"),
  t0: z.number().int().nonnegative(), // client send time
  t3: z.number().int().nonnegative(), // client receive time of last response
});

/** Host starts the race (only valid in `lobby` state with ≥2 players).
 *  - `passageId` optional: when omitted, server auto-deals next passage via D-04
 *    no-repeat deck (used for rematch — Phase 2 host_choice, Phase 3 auto-deal).
 */
export const startRaceSchema = z.object({
  type: z.literal("start_race"),
  passageId: z.string().uuid().optional(),
  graceSeconds: z.number().int().min(3).max(10).default(5),
});

/** Single keystroke during the race; server validates + broadcasts. */
export const keystrokeSchema = z.object({
  type: z.literal("keystroke"),
  index: z.number().int().nonnegative(),
  char: z.string().length(1),
  clientTs: z.number().int().nonnegative(),
});

/** Advisory cursor position; 10Hz throttled client-side. */
export const cursorPositionSchema = z.object({
  type: z.literal("cursor_position"),
  index: z.number().int().nonnegative(),
  clientTs: z.number().int().nonnegative(),
});

/**
 * Client signals a backspace correction.
 * - backspaces: integer count (1 = single backspace, 2 = select+delete, etc.)
 * - upToIndex: the new (lowered) cursor position. Server clamps to current progress.
 *   Optional; if omitted, server decrements progress by `backspaces` from current.
 */
export const correctionSchema = z.object({
  type: z.literal("correction"),
  backspaces: z.number().int().min(1).max(200),
  clientTs: z.number().int().nonnegative(),
});

/** Host signals to return the room to the lobby without starting a race. */
export const returnToLobbySchema = z.object({
  type: z.literal("return_to_lobby"),
});

/** Rejoin an existing room using a previously issued session token. */
export const rejoinRoomSchema = z.object({
  type: z.literal("rejoin_room"),
  roomCode: z.string().regex(ROOM_CODE_REGEX, "invalid room code"),
  sessionToken: z.string().uuid(),
});

export const clientToServerSchema = z.discriminatedUnion("type", [
  clientPingSchema,
  joinRoomSchema,
  leaveRoomSchema,
  createRoomSchema,
  clockSyncSchema,
  startRaceSchema,
  keystrokeSchema,
  cursorPositionSchema,
  correctionSchema,
  returnToLobbySchema,
  rejoinRoomSchema,
]);

export type ClientToServer = z.infer<typeof clientToServerSchema>;
export type ClientPing = z.infer<typeof clientPingSchema>;
export type JoinRoom = z.infer<typeof joinRoomSchema>;
export type LeaveRoom = z.infer<typeof leaveRoomSchema>;
export type CreateRoom = z.infer<typeof createRoomSchema>;
export type ClockSync = z.infer<typeof clockSyncSchema>;
export type StartRace = z.infer<typeof startRaceSchema>;
export type Keystroke = z.infer<typeof keystrokeSchema>;
export type CursorPosition = z.infer<typeof cursorPositionSchema>;
export type Correction = z.infer<typeof correctionSchema>;
export type RejoinRoom = z.infer<typeof rejoinRoomSchema>;

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
    "SESSION_INVALID",
  ]),
  message: z.string(),
});

/** Sent to the client that just joined/created a room. */
export const joinedRoomSchema = z.object({
  type: z.literal("joined_room"),
  playerId: z.string().uuid(),
  sessionToken: z.string().uuid(),
  roomCode: z.string().regex(ROOM_CODE_REGEX),
  you: z.object({
    nickname: z.string(),
    isHost: z.boolean(),
  }),
  players: z.array(PLAYER_SUMMARY),
  clockOffsetMs: z.number(),
  hostPickedPassagePreview: z.string().optional(),
});

/** Broadcast to all members when the lobby composition changes. */
export const lobbyStateSchema = z.object({
  type: z.literal("lobby_state"),
  roomCode: z.string().regex(ROOM_CODE_REGEX),
  players: z.array(PLAYER_SUMMARY),
  hostPickedPassagePreview: z.string().optional(),
});

/** Sent when the host starts the race; clients show the countdown UI. */
export const countdownSchema = z.object({
  type: z.literal("countdown"),
  startsAtServerMs: z.number().int(),
  secondsRemaining: z.number().int().min(0).max(10),
});

/** Sent at the race-start moment; carries the passage text. */
export const raceStartSchema = z.object({
  type: z.literal("race_start"),
  startsAtServerMs: z.number().int(),
  passageId: z.string(),
  passageText: z.string(),
});

/** Broadcast when a player's cursor advances (accepted keystroke or advisory).
 *
 * OUTBOUND ONLY — server is the sole producer. Clients do NOT send cursor_update.
 * The `charStates` + `wpm` fields are optional() so Phase 2 broadcasts without
 * them still parse (backwards compat). The inbound `cursor_position` schema does
 * NOT include these fields (server cannot accept spoofed correctness — Pitfall
 * V5 / D-13).
 */
export const cursorUpdateSchema = z.object({
  type: z.literal("cursor_update"),
  playerId: z.string().uuid(),
  index: z.number().int().nonnegative(),
  serverTs: z.number().int(),
  charStates: z.array(z.enum(["pending", "correct", "error"])).optional(),
  wpm: z.number().nonnegative().optional(),
});

/** Broadcast when a player leaves the room. */
export const playerLeftSchema = z.object({
  type: z.literal("player_left"),
  playerId: z.string().uuid(),
});

/** Sent when the race ends (all finished or abandoned). */
export const raceEndSchema = z.object({
  type: z.literal("race_end"),
  reason: z.enum(["finished", "abandoned"]),
  finishedPlayerIds: z.array(z.string().uuid()),
  results: z
    .array(
      z.object({
        playerId: z.string().uuid(),
        finishTimeMs: z.number().int().nonnegative(),
        wpm: z.number().nonnegative(),
        accuracy: z.number().min(0).max(1),
      }),
    )
    .optional(),
});

/** Sent at the start of the grace period (D-15): leader finished, others have Ns. */
export const graceCountdownSchema = z.object({
  type: z.literal("grace_countdown"),
  remainingMs: z.number().int().nonnegative(),
  leaderPlayerId: z.string().uuid(),
  leaderNickname: z.string(),
});

/** Single player's final stats in race_end.results (D-10). */
export const playerFinalStatsSchema = z.object({
  playerId: z.string().uuid(),
  finishTimeMs: z.number().int().nonnegative(),
  wpm: z.number().nonnegative(),
  accuracy: z.number().min(0).max(1),
});

export const serverToClientSchema = z.discriminatedUnion("type", [
  helloSchema,
  pongSchema,
  errorSchema,
  joinedRoomSchema,
  lobbyStateSchema,
  countdownSchema,
  raceStartSchema,
  cursorUpdateSchema,
  playerLeftSchema,
  raceEndSchema,
  graceCountdownSchema,
  returnToLobbySchema,
]);

export type ServerToClient = z.infer<typeof serverToClientSchema>;
export type Hello = z.infer<typeof helloSchema>;
export type Pong = z.infer<typeof pongSchema>;
export type ServerError = z.infer<typeof errorSchema>;
export type ServerErrorCode = ServerError["code"];
export type JoinedRoom = z.infer<typeof joinedRoomSchema>;
export type LobbyState = z.infer<typeof lobbyStateSchema>;
export type Countdown = z.infer<typeof countdownSchema>;
export type RaceStart = z.infer<typeof raceStartSchema>;
export type CursorUpdate = z.infer<typeof cursorUpdateSchema>;
export type PlayerLeft = z.infer<typeof playerLeftSchema>;
export type RaceEnd = z.infer<typeof raceEndSchema>;
export type GraceCountdown = z.infer<typeof graceCountdownSchema>;
export type PlayerFinalStats = z.infer<typeof playerFinalStatsSchema>;