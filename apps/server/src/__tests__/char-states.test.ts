/**
 * Char-state + scoring helper tests — Phase 3 Plan 02 tracer.
 *
 * 6 tracer tests:
 *  1. countCorrectChars counts 'correct' positions
 *  2. countUncorrectedErrors counts 'error' positions (still wrong)
 *  3. last-write-wins (Pitfall 1) — overwrite 'correct' with 'error'
 *  4. aggregateWordCorrectness splits on whitespace; positions correctly indexed
 *  5. aggregateWordCorrectness handles contractions + hyphens (Pitfall 7)
 *  6. isWordCorrect partial range
 */
import { describe, test, expect } from "bun:test";
import {
  countCorrectChars,
  countUncorrectedErrors,
  isWordCorrect,
  aggregateWordCorrectness,
} from "../race/scoring.ts";
import type { CharState } from "../race/types.ts";

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