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
import { logger } from "../logger.ts";

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
    room.firstFinisherId = null;
    room.graceEndsAtServerMs = null;
    for (const player of room.players.values()) {
      player.charStates = [];
      player.progress = 0;
      player.totalKeystrokes = 0;
      player.uncorrectedErrors = 0;
      player.currentWpm = 0;
      player.lastKeystrokeAt = 0;
      player.lastCursorAtMs = 0;
      player.finishedAtServerMs = null;
    }
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
      logger.info({ code: room.code }, "[race] started");
      const frame: RaceStart = {
        type: "race_start",
        startsAtServerMs: room.startsAtServerMs,
        passageId: room.passageId!,
        passageText: room.passageText!,
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
          logger.info({ code: room.code, reason: "all_finished" }, "[race] ended");
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
        logger.info(
          {
            code: room.code,
            firstFinisherId: firstFinisher.playerId,
            graceSeconds: room.graceSeconds,
          },
          "[race] grace started",
        );
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
        logger.info(
          {
            code: room.code,
            reason: allFinished ? "all_finished" : "grace_expired",
          },
          "[race] ended",
        );
        broadcastToRoom(room, buildRaceEndFrame(room, now));
        continue;
      }
    }
  }
}