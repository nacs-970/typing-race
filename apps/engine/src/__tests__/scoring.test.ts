import { describe, test, expect } from "bun:test";
import { computeNetWpm, computeAccuracy } from "../race/scoring.ts";

describe("computeNetWpm — D-05", () => {
  test("1. SPEC FIXTURE: 30 correct chars / 30s / 0 errors = 12 WPM (D-05 formula).", () => {
    expect(computeNetWpm({ correctChars: 30, uncorrectedErrors: 0, elapsedMs: 30_000 })).toBe(12);
  });

  test("2. zero correct → 0 WPM (not negative)", () => {
    expect(
      computeNetWpm({ correctChars: 0, uncorrectedErrors: 0, elapsedMs: 60_000 }),
    ).toBe(0);
  });

  test("3. clamped at zero: 5 correct / 10 errors / 5s → 0 WPM (not negative)", () => {
    expect(computeNetWpm({ correctChars: 5, uncorrectedErrors: 10, elapsedMs: 5_000 })).toBe(0);
  });

  test("4. elapsedMs = 0 → 0 WPM (defensive, no NaN/Infinity)", () => {
    expect(computeNetWpm({ correctChars: 10, uncorrectedErrors: 0, elapsedMs: 0 })).toBe(0);
  });

  test("5. elapsedMs < 0 → 0 WPM (defensive against clock skew)", () => {
    expect(computeNetWpm({ correctChars: 10, uncorrectedErrors: 0, elapsedMs: -100 })).toBe(0);
  });

  test("6. realistic mid-race: 100 correct / 5 errors / 30s = 38 WPM", () => {
    expect(
      computeNetWpm({ correctChars: 100, uncorrectedErrors: 5, elapsedMs: 30_000 }),
    ).toBe(38);
  });
});

describe("computeAccuracy — D-06", () => {
  test("7. D-06 basic: 95 correct / 100 total = 0.95", () => {
    expect(computeAccuracy({ correctChars: 95, totalKeystrokes: 100 })).toBe(0.95);
  });

  test("8. D-06 zero total → 0 (no divide-by-zero)", () => {
    expect(computeAccuracy({ correctChars: 0, totalKeystrokes: 0 })).toBe(0);
  });

  test("9. D-06 all wrong: 0 correct / 50 total = 0", () => {
    expect(computeAccuracy({ correctChars: 0, totalKeystrokes: 50 })).toBe(0);
  });

  test("10. D-06 perfect: 50 correct / 50 total = 1", () => {
    expect(computeAccuracy({ correctChars: 50, totalKeystrokes: 50 })).toBe(1);
  });
});
