/**
 * Race domain types — shared between client and server.
 *
 * The FSM is exactly 4 states: lobby → countdown → racing → finished.
 * Re-entry to lobby is allowed from finished (for rematch) and
 * from countdown (host cancels). Other transitions are server-internal
 * (Race Controller validates them).
 */
import { z } from "zod";

export const raceStateSchema = z.enum([
  "lobby",
  "countdown",
  "racing",
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