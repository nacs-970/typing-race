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

export interface Player {
  playerId: PlayerId;
  nickname: string;
  isHost: boolean;
  wsRef: WsRef;
  /** Char index in passage (0-based). Monotonic per-player; updated on accepted keystroke. */
  progress: number;
  /** Server timestamp of last accepted keystroke (ms). Used for min-interval check. */
  lastKeystrokeAt: number;
  /** NTP-computed offset between client clock and server clock (Plan 03). */
  clientOffsetMs: number;
  /** Server timestamp when player joined (ms). Used for host-promotion tie-break. */
  joinedAt: number;
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
}