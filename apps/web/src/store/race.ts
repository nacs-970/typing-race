/**
 * Race UI store — isolated Zustand state for high-frequency race UI updates.
 *
 * Mirrors useCursorStore pattern (Phase 2): per-keystroke updates from
 * cursor_update frames don't re-render the lobby/connection stores.
 */
import { create } from "zustand";
import type { PlayerFinalStats, CorpusType, CorpusCategory } from "@typing-race/shared";

/** Per-character state. Mirrors server-side CharState (apps/server/src/race/types.ts).
 *  Server is the sole producer; client renders accents. */
export type CharState = "pending" | "correct" | "error";

export type { CharState as CharStateType, CorpusType, CorpusCategory };

export type GraceBanner = {
  leaderPlayerId: string;
  leaderNickname: string;
  remainingMs: number;
};

export type LobbyPlayer = {
  playerId: string;
  nickname: string;
  isHost: boolean;
  progress: number;
  isReady?: boolean;
};

export type RaceUiState = {
  ownCharStates: CharState[];
  ownWpm: number;
  ownWords: {start: number; end: number; correct: boolean}[];
  opponentWpm: Record<string, number>;
  graceBanner: GraceBanner | null;
  raceEndResults: PlayerFinalStats[] | null;
  hostPickedPassagePreview: string | null;
  hostGraceSeconds: number;
  corpusType: CorpusType;
  corpusCategory: CorpusCategory;
  passageText: string | null;
  /** Server timestamp when countdown began (ms). Null when not in countdown. */
  countdownStartsAtServerMs: number | null;
  lobbyPlayers: LobbyPlayer[];
};

export const useRaceStore = create<RaceUiState>(() => ({
  ownCharStates: [],
  ownWpm: 0,
  ownWords: [],
  opponentWpm: {},
  graceBanner: null,
  raceEndResults: null,
  hostPickedPassagePreview: null,
  hostGraceSeconds: 5,
  corpusType: "passage",
  corpusCategory: "mid",
  passageText: null,
  countdownStartsAtServerMs: null,
  lobbyPlayers: [],
}));

export const setRaceState = (
  patch: Partial<RaceUiState> | ((s: RaceUiState) => Partial<RaceUiState>),
): void => {
  if (typeof patch === "function") {
    useRaceStore.setState(patch);
  } else {
    useRaceStore.setState(patch);
  }
};

export function resetRaceUi(): void {
  useRaceStore.setState({
    ownCharStates: [],
    ownWpm: 0,
    ownWords: [],
    opponentWpm: {},
    graceBanner: null,
    raceEndResults: null,
    passageText: null,
    countdownStartsAtServerMs: null,
  });
}