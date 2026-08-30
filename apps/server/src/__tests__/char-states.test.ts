/**
 * Char-state + scoring helper tests — Phase 3 Plan 02 tracer.
 *
 * 7 tests:
 *  1. countCorrectChars counts 'correct' positions
 *  2. countUncorrectedErrors counts 'error' positions (still wrong)
 *  3. last-write-wins (Pitfall 1) — overwrite 'correct' with 'error'
 *  4. aggregateWordCorrectness splits on whitespace; positions correctly indexed
 *  5. aggregateWordCorrectness handles contractions + hyphens (Pitfall 7)
 *  6. isWordCorrect partial range
 *  7. dispatch end-to-end: cursor_update broadcast includes charStates + wpm to opponent
 */
import { describe, test, expect, beforeEach } from "bun:test";
import {
  countCorrectChars,
  countUncorrectedErrors,
  isWordCorrect,
  aggregateWordCorrectness,
} from "../race/scoring.ts";
import { rooms, createRoom, addPlayer } from "../rooms/manager.ts";
import { dispatch } from "../ws/dispatch.ts";
import type { Keystroke } from "@typing-race/shared";
import type { CharState } from "../race/types.ts";
import type { WsData } from "../ws/handlers.ts";

function states(...s: CharState[]): CharState[] {
  return s;
}

describe("countCorrectChars / countUncorrectedErrors", () => {
  test("1. 10 correct + 0 error → countCorrect=10, countUncorrected=0", () => {
    const s = states(
      "correct", "correct", "correct", "correct", "correct",
      "correct", "correct", "correct", "correct", "correct",
    );
    expect(countCorrectChars(s)).toBe(10);
    expect(countUncorrectedErrors(s)).toBe(0);
  });

  test("2. 10 correct + 1 error → countCorrect=10, countUncorrected=1", () => {
    const s = states(
      "correct", "correct", "correct", "correct", "correct",
      "correct", "correct", "correct", "correct", "correct",
      "error",
    );
    expect(countCorrectChars(s)).toBe(10);
    expect(countUncorrectedErrors(s)).toBe(1);
  });

  test("3. Pitfall 1 — last-write-wins: overwrite 'correct' with 'error' in place", () => {
    const s = states("correct", "correct", "correct");
    // Simulate a backspace + retype-wrong: position 1 flips to 'error'
    s[1] = "error";
    expect(s[1]).toBe("error");
    expect(countCorrectChars(s)).toBe(2);
    expect(countUncorrectedErrors(s)).toBe(1);
    // Retype correctly: position flips back to 'correct'
    s[1] = "correct";
    expect(countCorrectChars(s)).toBe(3);
    expect(countUncorrectedErrors(s)).toBe(0);
  });
});

describe("aggregateWordCorrectness — D-13 + Pitfall 7", () => {
  test("4. 'don't worry' splits into 2 words; positions correctly indexed", () => {
    const text = "don't worry";
    // Length = 11: "don't" (5) + " " (1) + "worry" (5)
    const s: CharState[] = [
      "correct", "correct", "correct", "correct", "correct", // "don't"
      "pending",                                                  // space
      "correct", "correct", "correct", "correct", "correct",    // "worry"
    ];
    const words = aggregateWordCorrectness(text, s);
    expect(words.length).toBe(2);
    expect(words[0]).toEqual({ word: "don't", start: 0, end: 5, correct: true });
    expect(words[1]).toEqual({ word: "worry", start: 6, end: 11, correct: true });
  });

  test("5. 'Mr. Smith said ice-cream' = 4 words; contractions + hyphens stay in 1 word", () => {
    const text = "Mr. Smith said ice-cream";
    // Mr. (3) + " " (1) + Smith (5) + " " (1) + said (4) + " " (1) + ice-cream (9) = 24 chars
    const s: CharState[] = new Array(text.length).fill("correct");
    const words = aggregateWordCorrectness(text, s);
    expect(words.length).toBe(4);
    expect(words.map((w) => w.word)).toEqual(["Mr.", "Smith", "said", "ice-cream"]);
    expect(words[0]).toEqual({ word: "Mr.", start: 0, end: 3, correct: true });
    expect(words[3]).toEqual({ word: "ice-cream", start: 15, end: 24, correct: true });
  });
});

describe("isWordCorrect", () => {
  test("6. partial range — all correct → true; mixed → false", () => {
    const all: CharState[] = ["correct", "correct", "correct", "correct"];
    expect(isWordCorrect(all, 0, 4)).toBe(true);
    expect(isWordCorrect(all, 0, 2)).toBe(true);
    const mixed: CharState[] = ["correct", "error", "correct", "pending"];
    expect(isWordCorrect(mixed, 0, 4)).toBe(false);
    expect(isWordCorrect(mixed, 0, 1)).toBe(true); // first char only — correct
    expect(isWordCorrect(mixed, 1, 3)).toBe(false); // error + correct
  });
});

describe("dispatch keystroke → cursor_update broadcast (end-to-end)", () => {
  beforeEach(() => {
    rooms.clear();
  });

  function fakeWs(playerId: string) {
    const ws = {
      data: {
        playerId,
        roomCode: null as string | null,
        nickname: null as string | null,
        clientOffsetMs: 0,
      } satisfies WsData,
      sent: [] as string[],
      send(data: string) {
        ws.sent.push(data);
      },
    };
    return ws;
  }
  function asWs(ws: ReturnType<typeof fakeWs>): import("bun").ServerWebSocket<WsData> {
    return ws as unknown as import("bun").ServerWebSocket<WsData>;
  }

  test("7. cursor_update broadcast to opponent carries charStates (length === passageText.length) + wpm (placeholder 0)", () => {
    // Set up a 2-player room in racing state with a known passage
    const hostWs = fakeWs("host");
    const { code, room } = createRoom(asWs(hostWs), "Alice");
    room.state = "racing";
    room.startsAtServerMs = Date.now() - 200;
    room.passageText = "hi"; // 2 chars
    addPlayer(code, "p2", "Bob", asWs(fakeWs("p2")));

    // Find the opponent (Bob) — host plays, opponent observes
    const opponent = [...room.players.values()].find((p) => p.playerId === "p2");
    if (!opponent) throw new Error("opponent not in room");
    opponent.lastKeystrokeAt = 0;

    hostWs.sent.length = 0;
    // (opponent.wsRef.sent tracked via the FakeWs)

    // Host sends a keystroke at index 0 ('h')
    const keystroke: Keystroke = {
      type: "keystroke",
      index: 0,
      char: "h",
      clientTs: Date.now(),
    };
    dispatch(asWs(hostWs), JSON.stringify(keystroke));

    // Bob (opponent) should have received a cursor_update with charStates + wpm
    const cursorFrames = opponent.wsRef
      ? (opponent.wsRef as unknown as { sent: string[] }).sent ?? []
      : [];
    // The fakeWs uses wsRef = the same object we patched; we need to capture differently
    // Re-cast: opponent.wsRef was set via the FakeWs object — its `sent` array lives on the FakeWs
    const fakeOpponentWs = opponent.wsRef as unknown as ReturnType<typeof fakeWs>;
    const sentToOpponent = fakeOpponentWs.sent;
    const cursorUpdatePayload = sentToOpponent.find((s) =>
      s.includes('"cursor_update"'),
    );
    expect(cursorUpdatePayload).toBeDefined();
    if (!cursorUpdatePayload) return;
    const frame = JSON.parse(cursorUpdatePayload) as {
      type: string;
      playerId: string;
      index: number;
      serverTs: number;
      charStates?: CharState[];
      wpm?: number;
    };
    expect(frame.type).toBe("cursor_update");
    expect(frame.playerId).toBe("host");
    expect(frame.index).toBe(0);
    expect(typeof frame.serverTs).toBe("number");
    expect(Array.isArray(frame.charStates)).toBe(true);
    // charStates must be the full passage length (broadcast the snapshot)
    expect(frame.charStates?.length).toBe(2);
    // Position 0 is the host's last keystroke — must be 'correct'
    expect(frame.charStates?.[0]).toBe("correct");
    // Position 1 hasn't been typed — must be 'pending'
    expect(frame.charStates?.[1]).toBe("pending");
    // wpm field present (Plan 02 placeholder = 0; Plan 03 fills real value)
    expect(frame.wpm).toBe(0);
  });
});