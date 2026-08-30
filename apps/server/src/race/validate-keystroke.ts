/**
 * Anti-cheat keystroke validator — server-authoritative.
 *
 * 4 checks (all must pass for a keystroke to be accepted):
 *   1. Server timestamp — uses `now` (server's own Date.now()), NOT frame.clientTs
 *   2. Pre-start reject — room.state must be "racing" OR "grace" AND
 *      now >= startsAtServerMs + 50ms grace (D-08: others keep typing
 *      during grace)
 *   3. Min-interval — now - player.lastKeystrokeAt >= 20ms (anti-autoclicker)
 *   4. Char-match + range — frame.char === passageText[frame.index]
 *
 * On success: stamps server state, computes new charStates snapshot
 * (last-write-wins per position, D-11/D-12), updates progress,
 * sets finishedAtServerMs on first-time passage completion.
 *
 * `now` is injected for testability.
 */
import type { Keystroke, ServerErrorCode } from "@typing-race/shared";
import type { CharState, Player, Room } from "./types.ts";
import {
  countUncorrectedErrors,
  computeNetWpm,
} from "./scoring.ts";

const PRE_START_GRACE_MS = 50;
const MIN_INTERVAL_MS = 20;

export type PlayerPatch = {
  totalKeystrokes: number;
  uncorrectedErrors: number;
  currentWpm: number;
  finishedAtServerMs: number | null;
};

export type ValidateResult =
  | { ok: true; newCharStates: CharState[]; playerPatch: PlayerPatch }
  | { ok: false; reason: ServerErrorCode };

export function validateKeystroke(args: {
  room: Room;
  player: Player;
  frame: Keystroke;
  passageText: string;
  now: number;
}): ValidateResult {
  const { room, player, frame, passageText, now } = args;

  // Check 1: implicit — server uses `now`, not `frame.clientTs`.

  // Check 2: pre-start reject — accept "racing" OR "grace" (D-08).
  // RaceState union doesn't include "grace" yet (Plan 04 adds it);
  // we accept any non-(lobby|countdown|finished) state as racing-or-grace
  // by rejecting only the explicit pre-race states.
  if (room.state === "lobby" || room.state === "countdown") {
    return { ok: false, reason: "NOT_IN_ROOM" };
  }
  if (room.startsAtServerMs === null) return { ok: false, reason: "NOT_IN_ROOM" };
  if (now < room.startsAtServerMs + PRE_START_GRACE_MS) {
    return { ok: false, reason: "RATE_LIMITED" };
  }

  // Check 3: min-interval (anti-autoclicker)
  if (now - player.lastKeystrokeAt < MIN_INTERVAL_MS) {
    return { ok: false, reason: "RATE_LIMITED" };
  }

  // Check 4: char-match + range
  if (frame.index < 0 || frame.index >= passageText.length) {
    return { ok: false, reason: "INVALID_FRAME" };
  }
  const expected = passageText[frame.index];
  if (frame.char !== expected) {
    return { ok: false, reason: "INVALID_FRAME" };
  }

  // All checks passed — compute char-state snapshot (immutable: don't mutate)
  const newCharStates: CharState[] = player.charStates.slice();
  // Grow array if first keystroke (or passage not yet initialised)
  if (newCharStates.length < passageText.length) {
    while (newCharStates.length < passageText.length) {
      newCharStates.push("pending");
    }
  }
  // Last-write-wins per position (Pitfall 1 + D-11/D-12: 2-tone, no
  // "corrected" intermediate — once wrong-then-right, state is "correct")
  newCharStates[frame.index] = "correct";

  // Recompute aggregates from snapshot
  const uncorrectedErrors = countUncorrectedErrors(newCharStates);
  const correctChars = newCharStates.length - uncorrectedErrors;
  const totalKeystrokes = player.totalKeystrokes + 1;

  // D-05: net WPM = max(0, (correct/5 − uncorrected/5)) / minutesElapsed
  // elapsedMs uses server's `now` (anti-cheat #1 implicit — never frame.clientTs)
  const elapsedMs =
    room.startsAtServerMs === null ? 0 : now - room.startsAtServerMs;
  const currentWpm = computeNetWpm({ correctChars, uncorrectedErrors, elapsedMs });

  // Stamp server state
  player.charStates = newCharStates;
  player.totalKeystrokes = totalKeystrokes;
  player.uncorrectedErrors = uncorrectedErrors;
  player.currentWpm = currentWpm;
  player.lastKeystrokeAt = now;
  if (frame.index + 1 > player.progress) {
    player.progress = frame.index + 1;
  }
  // First-time finish detection
  let finishedAtServerMs = player.finishedAtServerMs;
  if (
    player.progress >= passageText.length &&
    finishedAtServerMs === null
  ) {
    finishedAtServerMs = now;
    player.finishedAtServerMs = now;
  }

  return {
    ok: true,
    newCharStates,
    playerPatch: {
      totalKeystrokes,
      uncorrectedErrors,
      currentWpm,
      finishedAtServerMs,
    },
  };
}