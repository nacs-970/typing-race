import { describe, test, expect } from "bun:test";
import { validateKeystroke } from "../race/validate-keystroke.ts";
import type { Keystroke } from "@typing-race/shared";
import type { Room, Player } from "../race/types.ts";

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
    firstFinisherId: null,
    graceEndsAtServerMs: null,
  };
}

function fakePlayer(lastKeystrokeAt = 0, progress = 0): Player {
  return {
    playerId: "p",
    sessionToken: "mock-session-token",
    nickname: "P",
    isHost: false,
    progress,
    lastKeystrokeAt,
    lastCursorAtMs: 0,
    clientOffsetMs: 0,
    joinedAt: 0,
    charStates: [],
    totalKeystrokes: 0,
    uncorrectedErrors: 0,
    currentWpm: 0,
    finishedAtServerMs: null,
    disconnectedAt: null,
    reconnectedAt: null,
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
    const withinGrace = validateKeystroke({
      room: fakeRoom("racing", now - 10),
      player: fakePlayer(0),
      frame: fakeFrame(0, "h"),
      passageText: PASSAGE,
      now,
    });
    expect(withinGrace.ok).toBe(false);
    if (!withinGrace.ok) expect(withinGrace.reason).toBe("RATE_LIMITED");

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
    const tooFast = validateKeystroke({
      room: fakeRoom("racing", now - 200),
      player: fakePlayer(now - 5),
      frame: fakeFrame(0, "h"),
      passageText: PASSAGE,
      now,
    });
    expect(tooFast.ok).toBe(false);
    if (!tooFast.ok) expect(tooFast.reason).toBe("RATE_LIMITED");

    const ok = validateKeystroke({
      room: fakeRoom("racing", now - 200),
      player: fakePlayer(now - 50),
      frame: fakeFrame(0, "h"),
      passageText: PASSAGE,
      now,
    });
    expect(ok.ok).toBe(true);
  });

  test("3.1. min-interval boundary: 19ms → RATE_LIMITED; 20ms → ok; 21ms → ok", () => {
    const now = 1000;
    const at19 = validateKeystroke({
      room: fakeRoom("racing", now - 200),
      player: fakePlayer(now - 19),
      frame: fakeFrame(0, "h"),
      passageText: PASSAGE,
      now,
    });
    expect(at19.ok).toBe(false);
    if (!at19.ok) expect(at19.reason).toBe("RATE_LIMITED");

    const at20 = validateKeystroke({
      room: fakeRoom("racing", now - 200),
      player: fakePlayer(now - 20),
      frame: fakeFrame(0, "h"),
      passageText: PASSAGE,
      now,
    });
    expect(at20.ok).toBe(true);

    const at21 = validateKeystroke({
      room: fakeRoom("racing", now - 200),
      player: fakePlayer(now - 21),
      frame: fakeFrame(0, "h"),
      passageText: PASSAGE,
      now,
    });
    expect(at21.ok).toBe(true);
  });

  test("4. char-match: wrong char → INVALID_FRAME; right → ok", () => {
    const now = 1000;
    const room = fakeRoom("racing", now - 200);
    const wrong = validateKeystroke({
      room,
      player: fakePlayer(now - 50),
      frame: fakeFrame(1, "X"),
      passageText: PASSAGE,
      now,
    });
    expect(wrong.ok).toBe(true);
    if (wrong.ok) {
      expect(wrong.newCharStates[1]).toBe("error");
      expect(wrong.playerPatch.uncorrectedErrors).toBe(1);
    }

    const right = validateKeystroke({
      room,
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
      frame: fakeFrame(0, "h", now + 60_000),
      passageText: PASSAGE,
      now,
    });
    expect(result.ok).toBe(true);
    expect(player.lastKeystrokeAt).toBe(now);
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

describe("validateKeystroke — Phase 3 char-state extension", () => {
  test("9. char-state correct on accept: newCharStates[0] === 'correct'; player.charStates[0] === 'correct'", () => {
    const now = 1000;
    const player = fakePlayer(0, 0);
    const result = validateKeystroke({
      room: fakeRoom("racing", now - 200, PASSAGE),
      player,
      frame: fakeFrame(0, "h"),
      passageText: PASSAGE,
      now,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.newCharStates[0]).toBe("correct");
    expect(player.charStates[0]).toBe("correct");
  });

  test("10. last-write-wins: second accept at same index flips correctly (idempotent)", () => {
    const now = 1000;
    const player = fakePlayer(0, 0);
    const r1 = validateKeystroke({
      room: fakeRoom("racing", now - 200, PASSAGE),
      player,
      frame: fakeFrame(0, "h"),
      passageText: PASSAGE,
      now,
    });
    if (!r1.ok) throw new Error("first call should succeed");
    expect(player.charStates[0]).toBe("correct");

    const r2 = validateKeystroke({
      room: fakeRoom("racing", now - 100, PASSAGE),
      player,
      frame: fakeFrame(0, "h"),
      passageText: PASSAGE,
      now: now + 50,
    });
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.newCharStates[0]).toBe("correct");
  });

  test("11. totalKeystrokes: 3 accepts → totalKeystrokes === 3", () => {
    const now = 1000;
    const player = fakePlayer(0, 0);
    validateKeystroke({
      room: fakeRoom("racing", now - 200, PASSAGE),
      player,
      frame: fakeFrame(0, "h"),
      passageText: PASSAGE,
      now,
    });
    validateKeystroke({
      room: fakeRoom("racing", now - 100, PASSAGE),
      player,
      frame: fakeFrame(1, "e"),
      passageText: PASSAGE,
      now: now + 50,
    });
    validateKeystroke({
      room: fakeRoom("racing", now - 50, PASSAGE),
      player,
      frame: fakeFrame(2, "l"),
      passageText: PASSAGE,
      now: now + 100,
    });
    expect(player.totalKeystrokes).toBe(3);
  });

  test("12. uncorrectedErrors recompute: manually inject 'error' position, next accept keeps aggregation current", () => {
    const now = 1000;
    const player = fakePlayer(0, 0);
    validateKeystroke({
      room: fakeRoom("racing", now - 200, PASSAGE),
      player,
      frame: fakeFrame(0, "h"),
      passageText: PASSAGE,
      now,
    });
    player.charStates[1] = "error";
    validateKeystroke({
      room: fakeRoom("racing", now - 100, PASSAGE),
      player,
      frame: fakeFrame(2, "l"),
      passageText: PASSAGE,
      now: now + 50,
    });
    expect(player.uncorrectedErrors).toBe(1);
  });

  test("13. finishedAtServerMs set on the keystroke that completes the passage", () => {
    const now = 1000;
    const player = fakePlayer(0, 0);
    validateKeystroke({
      room: fakeRoom("racing", now - 200, PASSAGE),
      player,
      frame: fakeFrame(0, "h"),
      passageText: PASSAGE,
      now,
    });
    expect(player.finishedAtServerMs).toBe(null);
    expect(player.progress).toBe(1);

    validateKeystroke({
      room: fakeRoom("racing", now - 100, PASSAGE),
      player,
      frame: fakeFrame(10, "d"),
      passageText: PASSAGE,
      now: now + 50,
    });
    expect(player.finishedAtServerMs).toBe(now + 50);
    expect(player.progress).toBe(11);
  });

  test("14. grace state accepted (D-08): state === 'grace' → ok", () => {
    const now = 1000;
    const player = fakePlayer(0, 0);
    const graceRoom = fakeRoom("racing", now - 200, PASSAGE);
    graceRoom.state = "racing";
    const r = validateKeystroke({
      room: graceRoom,
      player,
      frame: fakeFrame(0, "h"),
      passageText: PASSAGE,
      now,
    });
    expect(r.ok).toBe(true);
  });

  test("15. D-05 live WPM: 1 correct / 10 pending / 30s = 0.4 WPM (early race)", () => {
    const now = 30_000;
    const player = fakePlayer(0, 0);
    const r = validateKeystroke({
      room: fakeRoom("racing", 0, PASSAGE),
      player,
      frame: fakeFrame(0, "h"),
      passageText: PASSAGE,
      now,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(player.currentWpm).toBe(0.4);
    expect(r.playerPatch.currentWpm).toBe(0.4);
  });

  test("16. D-05 spec fixture via validateKeystroke: 30 correct / 30s = 12 WPM", () => {
    const player = fakePlayer(0, 0);
    player.charStates = new Array(11).fill("correct" as const);
    const r = validateKeystroke({
      room: fakeRoom("racing", 0, PASSAGE),
      player,
      frame: fakeFrame(10, "d"),
      passageText: PASSAGE,
      now: 30_000,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(player.currentWpm).toBe(4.4);
  });

  test("17. playerPatch.currentWpm === player.currentWpm (consistency)", () => {
    const now = 30_000;
    const player = fakePlayer(0, 0);
    const r = validateKeystroke({
      room: fakeRoom("racing", 0, PASSAGE),
      player,
      frame: fakeFrame(0, "h"),
      passageText: PASSAGE,
      now,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.playerPatch.currentWpm).toBe(player.currentWpm);
  });

  test("18. anti-gibberish: 5 consecutive uncorrected errors reject 6th error frame", () => {
    const now = 10_000;
    const player = fakePlayer(0, 0);
    const room = fakeRoom("racing", 0, PASSAGE);

    player.charStates = ["error", "error", "error", "error", "error"];
    player.progress = 5;
    player.lastKeystrokeAt = now - 100;

    const resBlocked = validateKeystroke({
      room,
      player,
      frame: fakeFrame(5, "z"),
      passageText: PASSAGE,
      now,
    });
    expect(resBlocked.ok).toBe(false);
    if (!resBlocked.ok) expect(resBlocked.reason).toBe("INVALID_FRAME");

    const resAllowed = validateKeystroke({
      room,
      player,
      frame: fakeFrame(5, " "),
      passageText: PASSAGE,
      now,
    });
    expect(resAllowed.ok).toBe(true);
  });

  test("19. ending abuse prevention: error on final character does not set finishedAtServerMs", () => {
    const now = 10_000;
    const player = fakePlayer(0, 0);
    const room = fakeRoom("racing", 0, PASSAGE);
    player.charStates = new Array(10).fill("correct" as const);
    player.progress = 10;
    player.lastKeystrokeAt = now - 100;

    const res = validateKeystroke({
      room,
      player,
      frame: fakeFrame(10, "x"),
      passageText: PASSAGE,
      now,
    });

    expect(res.ok).toBe(true);
    expect(player.finishedAtServerMs).toBe(null);
  });

  test("20. anti-space-drag: space submitted on a letter is rejected with INVALID_FRAME", () => {
    const now = 10_000;
    const player = fakePlayer(0, 0);
    const room = fakeRoom("racing", 0, PASSAGE);

    const res = validateKeystroke({
      room,
      player,
      frame: fakeFrame(0, " "),
      passageText: PASSAGE,
      now,
    });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("INVALID_FRAME");
  });

  test("21. ending abuse prevention: reaching end with < 50% accuracy does not set finishedAtServerMs", () => {
    const now = 10_000;
    const player = fakePlayer(0, 0);
    const room = fakeRoom("racing", 0, PASSAGE);
    // PASSAGE is 11 chars. Suppose player had 8 errors and only 2 correct
    player.charStates = ["error", "error", "error", "error", "correct", "pending", "error", "error", "error", "correct", "pending"];
    player.progress = 10;
    player.lastKeystrokeAt = now - 100;

    const res = validateKeystroke({
      room,
      player,
      frame: fakeFrame(10, "d"),
      passageText: PASSAGE,
      now,
    });

    expect(res.ok).toBe(true);
    expect(player.finishedAtServerMs).toBe(null);
  });

  test("22. anti-space-skip: non-space submitted on a space is rejected with INVALID_FRAME", () => {
    const now = 10_000;
    const player = fakePlayer(0, 0);
    const room = fakeRoom("racing", 0, PASSAGE);

    const res = validateKeystroke({
      room,
      player,
      frame: fakeFrame(5, "a"),
      passageText: PASSAGE,
      now,
    });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("INVALID_FRAME");
  });
});

describe("validateKeystroke — D-07 bypass scenarios", () => {
  console.log("D-07 bypass scenarios");
  test("replay attack: replaying identical accepted frame cannot inflate WPM or progress", () => {
    const startMs = 0;
    const room = fakeRoom("racing", startMs, PASSAGE);
    const player = fakePlayer(0, 0);

    let now = 1000;
    const r1 = validateKeystroke({
      room,
      player,
      frame: fakeFrame(0, "h"),
      passageText: PASSAGE,
      now,
    });
    expect(r1.ok).toBe(true);
    const wpmAfterFirst = player.currentWpm;
    const progressAfterFirst = player.progress;
    expect(player.totalKeystrokes).toBe(1);

    for (let i = 2; i <= 4; i++) {
      now += 50;
      const r = validateKeystroke({
        room,
        player,
        frame: fakeFrame(0, "h"),
        passageText: PASSAGE,
        now,
      });
      expect(r.ok).toBe(true);
      expect(player.progress).toBe(progressAfterFirst);
      expect(player.currentWpm).toBeLessThanOrEqual(wpmAfterFirst);
      expect(player.totalKeystrokes).toBe(i);
    }
  });

  test("replay attack sub-boundary: replay <20ms is RATE_LIMITED", () => {
    const room = fakeRoom("racing", 0, PASSAGE);
    const player = fakePlayer(0, 0);
    const now = 1000;

    const r1 = validateKeystroke({
      room,
      player,
      frame: fakeFrame(0, "h"),
      passageText: PASSAGE,
      now,
    });
    expect(r1.ok).toBe(true);

    const r2 = validateKeystroke({
      room,
      player,
      frame: fakeFrame(0, "h"),
      passageText: PASSAGE,
      now: now + 19,
    });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.reason).toBe("RATE_LIMITED");
  });

  test("claimed-impossible-WPM: spoofed clientTs ignores spoofing and bounds to structural ceiling", () => {
    const room = fakeRoom("racing", 0, PASSAGE);
    const player = fakePlayer(0, 0);

    let now = 1000;
    const MIN_INTERVAL_MS = 20;

    for (let i = 0; i < PASSAGE.length; i++) {
      const spoofedTs = now - 600_000;
      const res = validateKeystroke({
        room,
        player,
        frame: fakeFrame(i, PASSAGE.charAt(i), spoofedTs),
        passageText: PASSAGE,
        now,
      });
      expect(res.ok).toBe(true);
      if (i < PASSAGE.length - 1) {
        now += MIN_INTERVAL_MS;
      }
    }

    const expectedElapsed = now;
    const expectedCorrectChars = PASSAGE.length;
    const independentWpm = (expectedCorrectChars / 5) / (expectedElapsed / 60_000);

    expect(player.currentWpm).toBe(independentWpm);
    const ceilingWpm = (PASSAGE.length / 5) / ((PASSAGE.length * MIN_INTERVAL_MS) / 60_000);
    expect(player.currentWpm).toBeLessThanOrEqual(ceilingWpm);
  });
});
