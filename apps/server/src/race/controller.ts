/**
 * Race Controller — FSM transition validator + 1Hz ticker.
 *
 * Valid transitions:
 *   lobby     → countdown   (host starts race)
 *   countdown → racing      (timer expires)
 *   countdown → lobby       (host cancels)
 *   racing    → finished    (all players finish; Phase 3 owns end detection)
 *   finished  → lobby       (rematch)
 *
 * Any other transition throws.
 */
import type { RaceState, RaceStart } from "@typing-race/shared";
import type { Room } from "./types.ts";
import { rooms } from "../rooms/manager.ts";
import { broadcastToRoom } from "../ws/broadcast.ts";

export const COUNTDOWN_DURATION_MS = 3_000; // 3-second countdown

/** Allowed forward transitions. */
const ALLOWED: Record<RaceState, ReadonlyArray<RaceState>> = {
  lobby: ["countdown"],
  countdown: ["racing", "lobby"],
  racing: ["finished"],
  finished: ["lobby"],
};

export class InvalidTransitionError extends Error {
  constructor(from: RaceState, to: RaceState) {
    super(`invalid FSM transition: ${from} → ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export function transition(room: Room, target: RaceState): void {
  const from = room.state;
  if (!ALLOWED[from].includes(target)) {
    throw new InvalidTransitionError(from, target);
  }
  room.state = target;
  room.lastActivityAt = Date.now();

  if (target === "countdown") {
    room.startsAtServerMs = Date.now() + COUNTDOWN_DURATION_MS;
  }
}

/**
 * Tick: called every 1s. Transitions countdown → racing when timer expires
 * and broadcasts `race_start` with a placeholder passage (Phase 3 will
 * inject the real corpus selector).
 */
export function tick(now: number = Date.now()): void {
  for (const room of rooms.values()) {
    if (
      room.state === "countdown" &&
      room.startsAtServerMs !== null &&
      now >= room.startsAtServerMs
    ) {
      try {
        transition(room, "racing");
      } catch {
        // skip — defensive (shouldn't happen)
      }
      const frame: RaceStart = {
        type: "race_start",
        startsAtServerMs: room.startsAtServerMs,
        passageId: "placeholder",
        passageText:
          "The quick brown fox jumps over the lazy dog while a calm wind stirs the autumn leaves",
      };
      broadcastToRoom(room, frame);
    }
  }
}