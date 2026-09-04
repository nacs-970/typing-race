import type {
  PlayerId,
  PassageId,
  PlayerSummary,
  RaceState,
  CorpusType,
  CorpusCategory,
} from "@typing-race/shared";

export type { PlayerId, PassageId, PlayerSummary, RaceState, CorpusType, CorpusCategory };

/** Per-character state. 2-tone (D-11/D-12): no "corrected" intermediate. */
export type CharState = "pending" | "correct" | "error";

export interface Player {
  playerId: PlayerId;
  sessionToken: string;
  nickname: string;
  isHost: boolean;
  /** Char index in passage (0-based). Monotonic per-player; updated on accepted keystroke. */
  progress: number;
  /** Server timestamp of last accepted keystroke (ms). Used for min-interval check. */
  lastKeystrokeAt: number;
  /** Server timestamp of last cursor_position broadcast (ms). Used for 10Hz throttle. */
  lastCursorAtMs: number;
  /** NTP-computed offset between client clock and server clock. */
  clientOffsetMs: number;
  /** Server timestamp when player joined (ms). Used for host-promotion tie-break. */
  joinedAt: number;
  /** Per-position state snapshot. Length === passageText.length when racing. */
  charStates: CharState[];
  /** Total accepted keystrokes (including errors) — denominator of accuracy (D-06). */
  totalKeystrokes: number;
  /** Positions currently in "error" state (uncorrected errors, D-05 numerator). */
  uncorrectedErrors: number;
  /** Server-computed net WPM (D-05). */
  currentWpm: number;
  /** Set on first keystroke that completes the passage. */
  finishedAtServerMs: number | null;
  /** Set when socket drops; cleared on rejoin_room. */
  disconnectedAt: number | null;
  /** Set on successful rejoin_room; used for 500ms anti-cheat grace period. */
  reconnectedAt: number | null;
  /** Guest readiness status in lobby (D-13). */
  isReady?: boolean;
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
  graceSeconds: number;
  hostPickedPassagePreview: string | null;
  lastPassageId: string | null;
  usedPassageIds: Set<string>;
  deckOrder: string[];
  deckCursor: number;
  firstFinisherId: PlayerId | null;
  graceEndsAtServerMs: number | null;
  corpusType?: CorpusType;
  corpusCategory?: CorpusCategory;
}
