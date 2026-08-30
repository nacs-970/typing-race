/**
 * Race domain types — shared between client and server.
 *
 * The FSM is exactly 5 states: lobby → countdown → racing → grace → finished.
 * `grace` is a sub-state of racing (D-08): first player finished, others keep
 * typing for `graceSeconds` (host-configured 3/5/10, default 5) before the
 * race ends. Re-entry to lobby is allowed from finished (for rematch) and
 * from countdown (host cancels). Other transitions are server-internal
 * (Race Controller validates them).
 */
import { z } from "zod";

export const raceStateSchema = z.enum([
  "lobby",
  "countdown",
  "racing",
  "grace",
  "finished",
]);
export type RaceState = z.infer<typeof raceStateSchema>;

export type PlayerId = string;
export type PassageId = string;

export type PlayerSummary = {
  playerId: PlayerId;
  nickname: string;
  isHost: boolean;
  progress: number;
};