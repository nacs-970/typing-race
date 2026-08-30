/**
 * No-repeat passage deck tests — D-04.
 *
 * 8 unit tests covering Fisher-Yates purity, dealNextPassage semantics,
 * and no-repeat (Pitfall 5) reshuffle exclusion.
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { shuffle, dealNextPassage } from "../race/corpus.ts";
import { rooms, createRoom, addPlayer } from "../rooms/manager.ts";
import { dispatch } from "../ws/dispatch.ts";
import { PASSAGES, type StartRace } from "@typing-race/shared";
import type { WsData } from "../ws/handlers.ts";

const ALL = ["a", "b", "c", "d", "e"];

describe("shuffle()", () => {
  test("1. returns a permutation of input length", () => {
    const out = shuffle(ALL);
    expect(out.length).toBe(ALL.length);
    for (const id of ALL) expect(out.includes(id)).toBe(true);
  });

  test("2. does not mutate input", () => {
    const input = ALL.slice();
    shuffle(input);
    expect(input).toEqual(ALL);
  });
});

describe("dealNextPassage()", () => {
  test("3. cursor walk — returns first then increments", () => {
    const r = dealNextPassage({
      allPassageIds: ALL,
      deckOrder: ALL,
      deckCursor: 0,
      lastPassageId: null,
    });
    expect(r.passageId).toBe("a");
    expect(r.deckCursor).toBe(1);
  });

  test("4. exhaustion triggers reshuffle; lastPassageId excluded", () => {
    // Run 100 trials to test the exclusion filter
    for (let trial = 0; trial < 100; trial++) {
      const last = "x";
      const r = dealNextPassage({
        allPassageIds: ["x", "y", "z"],
        deckOrder: ["x", "y", "z"], // exhausted
        deckCursor: 3,
        lastPassageId: last,
      });
      // First dealt card must NOT be lastPassageId
      expect(r.passageId).not.toBe(last);
      // New deck excludes last
      expect(r.deckOrder).not.toContain(last);
      // Cursor resets to 1
      expect(r.deckCursor).toBe(1);
    }
  });

  test("5. no-repeat across N deals — same id never twice in a row", () => {
    let state = {
      allPassageIds: ALL,
      deckOrder: shuffle(ALL) as string[],
      deckCursor: 0,
      lastPassageId: null as string | null,
    };
    const served: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = dealNextPassage(state);
      served.push(r.passageId);
      state = {
        allPassageIds: state.allPassageIds,
        deckOrder: r.deckOrder as string[],
        deckCursor: r.deckCursor,
        lastPassageId: r.passageId,
      };
    }
    for (let i = 1; i < served.length; i++) {
      expect(served[i]).not.toBe(served[i - 1]);
    }
  });

  test("6. pure — same args produce same output (exhaustion case)", () => {
    // Note: shuffle uses Math.random, so non-exhaustion case varies.
    // For exhaustion, lastPassageId exclusion is deterministic for given filter.
    const args: Parameters<typeof dealNextPassage>[0] = {
      allPassageIds: ["x", "y"],
      deckOrder: ["x", "y"],
      deckCursor: 2, // exhausted
      lastPassageId: "x",
    };
    const r1 = dealNextPassage(args);
    const r2 = dealNextPassage(args);
    expect(r2.passageId).not.toBe("x");
    expect(r1.passageId).toBe(r2.passageId);
  });

  test("7. coverage — all 5 ids appear across one full cycle", () => {
    let state = {
      allPassageIds: ALL,
      deckOrder: shuffle(ALL) as string[],
      deckCursor: 0,
      lastPassageId: null as string | null,
    };
    const served = new Set<string>();
    for (let i = 0; i < ALL.length; i++) {
      const r = dealNextPassage(state);
      served.add(r.passageId);
      state = {
        allPassageIds: state.allPassageIds,
        deckOrder: r.deckOrder as string[],
        deckCursor: r.deckCursor,
        lastPassageId: r.passageId,
      };
    }
    expect(served.size).toBe(ALL.length);
  });

  test("8. first race (lastPassageId === null) — reshuffle includes all ids", () => {
    for (let trial = 0; trial < 100; trial++) {
      const r = dealNextPassage({
        allPassageIds: ["p", "q", "r"],
        deckOrder: ["p", "q", "r"], // exhausted (e.g., room reset)
        deckCursor: 3,
        lastPassageId: null,
      });
      // No exclusion when lastPassageId is null — all ids eligible
      expect(["p", "q", "r"]).toContain(r.passageId);
    }
  });
});

describe("start_race dispatch validation", () => {
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

  test("9. start_race with unknown passageId sends INVALID_FRAME error; room state unchanged", () => {
    const hostWs = fakeWs("host");
    const { code, room } = createRoom(asWs(hostWs), "Alice");
    addPlayer(code, "p2", "Bob", asWs(fakeWs("p2")));

    hostWs.sent.length = 0;
    const badMsg: StartRace = {
      type: "start_race",
      passageId: "99999999-9999-4999-8999-999999999999",
      graceSeconds: 5,
    };
    dispatch(asWs(hostWs), JSON.stringify(badMsg));

    expect(room.state).toBe("lobby"); // unchanged
    expect(room.passageId).toBe(null);
    expect(hostWs.sent.some((s) => s.includes('"code":"INVALID_FRAME"'))).toBe(true);
  });

  test("10. start_race with valid passageId sets room fields and triggers countdown", () => {
    const hostWs = fakeWs("host");
    const { code, room } = createRoom(asWs(hostWs), "Alice");
    addPlayer(code, "p2", "Bob", asWs(fakeWs("p2")));

    const passage0 = PASSAGES[0];
    if (!passage0) throw new Error("PASSAGES empty");

    hostWs.sent.length = 0;
    const okMsg: StartRace = {
      type: "start_race",
      passageId: passage0.id,
      graceSeconds: 5,
    };
    dispatch(asWs(hostWs), JSON.stringify(okMsg));

    expect(room.state).toBe("countdown");
    expect(room.passageId).toBe(passage0.id);
    expect(room.passageText).toBe(passage0.text);
    expect(room.lastPassageId).toBe(passage0.id);
    expect(room.usedPassageIds.has(passage0.id)).toBe(true);
    expect(room.graceSeconds).toBe(5);
    expect(room.hostPickedPassagePreview).not.toBe(null);
    // Deck initialized lazily on first race
    expect(room.deckOrder.length).toBeGreaterThan(0);
    expect(room.deckCursor).toBe(0); // explicit pick out of order — deck NOT advanced
  });
});