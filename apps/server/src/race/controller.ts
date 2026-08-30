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
import type { RaceState, RaceStart, RaceEnd, GraceCountdown, PlayerFinalStats } from "@typing-race/shared";
import type { Room } from "./types.ts";
import { rooms } from "../rooms/manager.ts";
import { broadcastToRoom, broadcastGraceCountdown, buildRaceEndFrame } from "../ws/broadcast.ts";
import { computeAccuracy } from "./scoring.ts";

export const COUNTDOWN_DURATION_MS = 3_000; // 3-second countdown

/** Allowed forward transitions. */
const ALLOWED: Record<RaceState, ReadonlyArray<RaceState>> = {
  lobby: ["countdown"],
  countdown: ["racing", "lobby"],
  racing: ["grace", "finished"],
  grace: ["finished"],
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
 * Tick: called every 1s. Handles:
 *   - countdown → racing when timer expires (broadcast race_start)
 *   - racing → grace when first player finishes (broadcast grace_countdown)
 *   - racing → finished when ALL players finished (broadcast race_end, no grace)
 *   - grace → finished when grace expires or all players finished (broadcast race_end)
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
      continue;
    }

    // Racing → grace when FIRST player finishes (D-08 / D-14 / D-15)
    if (room.state === "racing" && room.firstFinisherId === null) {
      const firstFinisher = [...room.players.values()].find(
        (p) => p.finishedAtServerMs !== null,
      );
      if (firstFinisher) {
        // If EVERY player finished, skip grace — go straight to finished
        const allFinished = [...room.players.values()].every(
          (p) => p.finishedAtServerMs !== null,
        );
        if (allFinished) {
          try {
            transition(room, "finished");
          } catch {
            // skip
          }
          broadcastToRoom(room, buildRaceEndFrame(room, now));
          continue;
        }
        // Some still typing — enter grace
        try {
          transition(room, "grace");
        } catch {
          // skip
        }
        room.firstFinisherId = firstFinisher.playerId;
        room.graceEndsAtServerMs = now + room.graceSeconds * 1000;
        broadcastGraceCountdown(room, now);
        continue;
      }
    }

    // Grace → finished when (a) all players done OR (b) timer expired
    if (room.state === "grace") {
      const allFinished = [...room.players.values()].every(
        (p) => p.finishedAtServerMs !== null,
      );
      const expired =
        room.graceEndsAtServerMs !== null && now >= room.graceEndsAtServerMs;
      if (allFinished || expired) {
        try {
          transition(room, "finished");
        } catch {
          // skip
        }
        broadcastToRoom(room, buildRaceEndFrame(room, now));
        continue;
      }
    }
  }
}