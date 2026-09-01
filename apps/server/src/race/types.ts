/**
 * Server-internal domain types — these shape the in-memory room
 * state. Not exported via @typing-race/shared (single-source-of-truth
 * rule: shared exposes only what BOTH client and server need).
 */
import type {
  PlayerId,
  PassageId,
  PlayerSummary,
  RaceState,
} from "@typing-race/shared";
import type { WsData } from "../ws/handlers.ts";

export type { PlayerId, PassageId, PlayerSummary, RaceState };

/** Type alias for a Bun WS reference typed with our WsData shape. */
export type WsRef = import("bun").ServerWebSocket<WsData>;

/** Per-character state. 2-tone (D-11/D-12): no "corrected" intermediate. */
export type CharState = "pending" | "correct" | "error";

export interface Player {
  playerId: PlayerId;
  nickname: string;
  isHost: boolean;
  wsRef: WsRef;
  /** Char index in passage (0-based). Monotonic per-player; updated on accepted keystroke. */
  progress: number;
  /** Server timestamp of last accepted keystroke (ms). Used for min-interval check. */
  lastKeystrokeAt: number;
  /** Server timestamp of last cursor_position broadcast (ms). Used for 10Hz throttle. */
  lastCursorAtMs: number;
  /** NTP-computed offset between client clock and server clock (Plan 03). */
  clientOffsetMs: number;
  /** Server timestamp when player joined (ms). Used for host-promotion tie-break. */
  joinedAt: number;
  // ---- Phase 3 fields ----
  /** Per-position state snapshot. Length === passageText.length when racing. */
  charStates: CharState[];
  /** Total accepted keystrokes (including errors) — denominator of accuracy (D-06). */
  totalKeystrokes: number;
  /** Positions currently in "error" state (uncorrected errors, D-05 numerator). */
  uncorrectedErrors: number;
  /** Server-computed net WPM (D-05). Plan 02 placeholder = 0; Plan 03 fills real formula. */
  currentWpm: number;
  /** Set on first keystroke that completes the passage (Plan 04 uses for race-end). */
  finishedAtServerMs: number | null;
}

export interface Room {
  code: string;
  hostId: PlayerId;
  state: RaceState;
  passageId: PassageId | null;
  passageText: string | null;
  startsAtServerMs: number | null;
  players: Map<PlayerId, Player>;
  createdAt: number;
  lastActivityAt: number;
  /** Phase 3: host-configurable grace period (D-09: 3/5/10s, default 5). */
  graceSeconds: number;
  /** Phase 3: host-picked passage preview (first 30 chars + …) for non-host lobby view (D-02). */
  hostPickedPassagePreview: string | null;
  /** Phase 3: last served passageId (D-04 — reshuffle excludes this). */
  lastPassageId: string | null;
  /** Phase 3: D-04 history of passages served this room's session. */
  usedPassageIds: Set<string>;
  /** Phase 3: current shuffled deck (PassageIds); [] until first start_race. */
  deckOrder: string[];
  /** Phase 3: next-to-deal index into deckOrder. */
  deckCursor: number;
  /** Phase 3 Plan 04: who finished first in this race (null until first finish). */
  firstFinisherId: PlayerId | null;
  /** Phase 3 Plan 04: server-ms timestamp when grace period ends; race ends at 0. */
  graceEndsAtServerMs: number | null;
}