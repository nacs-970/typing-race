/**
 * Anti-cheat validator tests — Phase 2 Plan 04 tracer.
 *
 * 8 unit tests:
 *  1. Check 2 (state guard): lobby state → NOT_IN_ROOM
 *  2. Check 2 (grace): within grace → RATE_LIMITED; past grace → ok
 *  3. Check 3 (min-interval): within 20ms → RATE_LIMITED; past → ok
 *  4. Check 4 (char-match): wrong char → INVALID_FRAME; right → ok
 *  5. Check 4 (range): index out of bounds → INVALID_FRAME
 *  6. All-pass: stamps lastKeystrokeAt + progress
 *  7. Spoofed clientTs ignored: clientTs=now+60000 doesn't change result
 *  8. Progress monotonic: index 5 then index 3 → progress=6 (max)
 */
import { describe, test, expect } from "bun:test";
import { validateKeystroke } from "../race/validate-keystroke.ts";
import type { Keystroke } from "@typing-race/shared";
import type { Room, Player } from "../race/types.ts";
import type { WsData } from "../ws/handlers.ts";

const PASSAGE = "hello world";

function fakeRoom(
  state: Room["state"],
  startsAtServerMs: number | null = null,
  passageText: string | null = PASSAGE,
): Room {
  return {
    code: "ABCDEF",
    hostId: "h",
    state,
    passageId: passageText ? "p1" : null,
    passageText,
    startsAtServerMs,
    players: new Map(),
    createdAt: 0,
    lastActivityAt: 0,
    graceSeconds: 5,
    hostPickedPassagePreview: null,
    lastPassageId: null,
    usedPassageIds: new Set(),
    deckOrder: [],
    deckCursor: 0,
  };
}

function fakePlayer(lastKeystrokeAt = 0, progress = 0): Player {
  const fakeWs = {
    data: { playerId: "p", roomCode: null, nickname: null, clientOffsetMs: 0 } satisfies WsData,
  };
  return {
    playerId: "p",
    nickname: "P",
    isHost: false,
    wsRef: fakeWs as unknown as Player["wsRef"],
    progress,
    lastKeystrokeAt,
    clientOffsetMs: 0,
    joinedAt: 0,
    charStates: [],
    totalKeystrokes: 0,
    uncorrectedErrors: 0,
    currentWpm: 0,
    finishedAtServerMs: null,
  };
}

function fakeFrame(index: number, char: string, clientTs = 0): Keystroke {
  return { type: "keystroke", index, char, clientTs };
}

describe("validateKeystroke — 4 anti-cheat checks", () => {
  test("1. state guard: lobby → NOT_IN_ROOM", () => {
    const result = validateKeystroke({
      room: fakeRoom("lobby"),
      player: fakePlayer(),
      frame: fakeFrame(0, "h"),
      passageText: PASSAGE,
      now: 1000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("NOT_IN_ROOM");
  });

  test("2. grace: within grace → RATE_LIMITED; past → ok", () => {
    const now = 1000;
    // Within grace (now < startsAtServerMs + 50)
    const withinGrace = validateKeystroke({
      room: fakeRoom("racing", now - 10), // starts 10ms ago
      player: fakePlayer(0),
      frame: fakeFrame(0, "h"),
      passageText: PASSAGE,
      now,
    });
    expect(withinGrace.ok).toBe(false);
    if (!withinGrace.ok) expect(withinGrace.reason).toBe("RATE_LIMITED");

    // Past grace
    const pastGrace = validateKeystroke({
      room: fakeRoom("racing", now - 100),
      player: fakePlayer(0),
      frame: fakeFrame(0, "h"),
      passageText: PASSAGE,
      now,
    });
    expect(pastGrace.ok).toBe(true);
  });

  test("3. min-interval: <20ms → RATE_LIMITED; ≥20ms → ok", () => {
    const now = 1000;
    // lastKeystrokeAt = now - 5 → interval = 5 < 20 → reject
    const tooFast = validateKeystroke({
      room: fakeRoom("racing", now - 200),
      player: fakePlayer(now - 5),
      frame: fakeFrame(0, "h"),
      passageText: PASSAGE,
      now,
    });
    expect(tooFast.ok).toBe(false);
    if (!tooFast.ok) expect(tooFast.reason).toBe("RATE_LIMITED");

    // lastKeystrokeAt = now - 50 → interval = 50 ≥ 20 → ok
    const ok = validateKeystroke({
      room: fakeRoom("racing", now - 200),
      player: fakePlayer(now - 50),
      frame: fakeFrame(0, "h"),
      passageText: PASSAGE,
      now,
    });
    expect(ok.ok).toBe(true);
  });

  test("4. char-match: wrong char → INVALID_FRAME; right → ok", () => {
    const now = 1000;
    const wrong = validateKeystroke({
      room: fakeRoom("racing", now - 200),
      player: fakePlayer(now - 50),
      frame: fakeFrame(1, "X"), // expected 'e' at index 1 of "hello world"
      passageText: PASSAGE,
      now,
    });
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.reason).toBe("INVALID_FRAME");

    const right = validateKeystroke({
      room: fakeRoom("racing", now - 200),
      player: fakePlayer(now - 50),
      frame: fakeFrame(1, "e"),
      passageText: PASSAGE,
      now,
    });
    expect(right.ok).toBe(true);
  });

  test("5. range: index out of bounds → INVALID_FRAME", () => {
    const now = 1000;
    const result = validateKeystroke({
      room: fakeRoom("racing", now - 200),
      player: fakePlayer(now - 50),
      frame: fakeFrame(999, "x"),
      passageText: PASSAGE,
      now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("INVALID_FRAME");
  });

  test("6. all-pass: stamps lastKeystrokeAt + progress", () => {
    const now = 1000;
    const player = fakePlayer(0, 0);
    const result = validateKeystroke({
      room: fakeRoom("racing", now - 200),
      player,
      frame: fakeFrame(0, "h"),
      passageText: PASSAGE,
      now,
    });
    expect(result.ok).toBe(true);
    expect(player.lastKeystrokeAt).toBe(now);
    expect(player.progress).toBe(1);
  });

  test("7. spoofed clientTs ignored: clientTs=now+60000 doesn't change result", () => {
    const now = 1000;
    const player = fakePlayer(now - 50);
    const result = validateKeystroke({
      room: fakeRoom("racing", now - 200),
      player,
      frame: fakeFrame(0, "h", now + 60_000), // spoofed!
      passageText: PASSAGE,
      now,
    });
    // Behavior is identical — server uses its own `now` for all timing
    expect(result.ok).toBe(true);
    expect(player.lastKeystrokeAt).toBe(now); // NOT now+60000
  });

  test("8. progress monotonic: index 5 then index 3 → progress = 6 (max)", () => {
    const now = 1000;
    const player = fakePlayer(0, 0);
    validateKeystroke({
      room: fakeRoom("racing", now - 200),
      player,
      frame: fakeFrame(5, " "),
      passageText: PASSAGE,
      now,
    });
    expect(player.progress).toBe(6);
    // Subsequent lower index — progress stays at 6
    validateKeystroke({
      room: fakeRoom("racing", now - 100),
      player,
      frame: fakeFrame(3, "l"),
      passageText: PASSAGE,
      now: now + 50,
    });
    expect(player.progress).toBe(6);
  });
});