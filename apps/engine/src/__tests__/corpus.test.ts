import { describe, test, expect } from "bun:test";
import { shuffle, dealNextPassage } from "../race/corpus.ts";

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
    for (let trial = 0; trial < 100; trial++) {
      const last = "x";
      const r = dealNextPassage({
        allPassageIds: ["x", "y", "z"],
        deckOrder: ["x", "y", "z"],
        deckCursor: 3,
        lastPassageId: last,
      });
      expect(r.passageId).not.toBe(last);
      expect(r.deckOrder).not.toContain(last);
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
    const args: Parameters<typeof dealNextPassage>[0] = {
      allPassageIds: ["x", "y"],
      deckOrder: ["x", "y"],
      deckCursor: 2,
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
        deckOrder: ["p", "q", "r"],
        deckCursor: 3,
        lastPassageId: null,
      });
      expect(["p", "q", "r"]).toContain(r.passageId);
    }
  });
});
