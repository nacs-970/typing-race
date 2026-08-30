/**
 * Anti-cheat keystroke validator — server-authoritative.
 *
 * 4 checks (all must pass for a keystroke to be accepted):
 *   1. Server timestamp — uses `now` (server's own Date.now()), NOT frame.clientTs
 *   2. Pre-start reject — room.state === "racing" AND now >= startsAtServerMs + 50ms grace
 *   3. Min-interval — now - player.lastKeystrokeAt >= 20ms (anti-autoclicker)
 *   4. Char-match + range — frame.char === passageText[frame.index]
 *
 * On success: stamps `player.lastKeystrokeAt = now` and bumps
 * `player.progress = max(player.progress, frame.index + 1)`.
 *
 * `now` is injected for testability.
 */
import type { Keystroke, ServerErrorCode } from "@typing-race/shared";
import type { Player, Room } from "./types.ts";

const PRE_START_GRACE_MS = 50;
const MIN_INTERVAL_MS = 20;

export type ValidateResult =
  | { ok: true }
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
  // (frame.clientTs exists in the schema but the validator never reads it.)

  // Check 2: pre-start reject (state must be racing + grace elapsed)
  if (room.state !== "racing") return { ok: false, reason: "NOT_IN_ROOM" };
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

  // All checks passed — stamp server state
  player.lastKeystrokeAt = now;
  if (frame.index + 1 > player.progress) {
    player.progress = frame.index + 1;
  }
  return { ok: true };
}