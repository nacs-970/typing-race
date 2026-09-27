/**
 * Word generator tests — generateWords.
 */
import { describe, test, expect } from "bun:test";
import { COMMON_WORDS, generateWords } from "../passages.ts";

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("generateWords", () => {
  test("1. token count for several counts including 0, 1, 100, negative, and non-integer", () => {
    expect(generateWords(0)).toBe("");
    expect(generateWords(-5)).toBe("");

    const single = generateWords(1);
    expect(single.split(" ").length).toBe(1);
    expect(single.length).toBeGreaterThan(0);

    const hundred = generateWords(100);
    expect(hundred.split(" ").length).toBe(100);

    const floored = generateWords(4.9);
    expect(floored.split(" ").length).toBe(4);
  });

  test("2. no leading/trailing whitespace, double spaces, or newlines", () => {
    for (const count of [1, 5, 20, 100]) {
      const res = generateWords(count);
      expect(res).toBe(res.trim());
      expect(res).not.toContain("  ");
      expect(res).not.toContain("\n");
      expect(res).not.toContain("\r");
    }
  });

  test("3. plain mode tokens all in COMMON_WORDS", () => {
    const wordSet = new Set(COMMON_WORDS);
    const res = generateWords(150);
    const tokens = res.split(" ");
    expect(tokens.length).toBe(150);
    for (const token of tokens) {
      expect(wordSet.has(token)).toBe(true);
    }
  });

  test("4. no adjacent duplicates in output", () => {
    const plainTokens = generateWords(200).split(" ");
    for (let i = 1; i < plainTokens.length; i++) {
      expect(plainTokens[i]).not.toBe(plainTokens[i - 1]!);
    }

    const punctTokens = generateWords(200, { punctuation: true }).split(" ");
    for (let i = 1; i < punctTokens.length; i++) {
      expect(punctTokens[i]).not.toBe(punctTokens[i - 1]!);
    }

    const numTokens = generateWords(200, { numbers: true }).split(" ");
    for (let i = 1; i < numTokens.length; i++) {
      expect(numTokens[i]).not.toBe(numTokens[i - 1]!);
    }
  });

  test("5. deterministic output with a seeded rng", () => {
    const rng1 = mulberry32(12345);
    const rng2 = mulberry32(12345);
    const run1 = generateWords(60, { rng: rng1, punctuation: true, numbers: true });
    const run2 = generateWords(60, { rng: rng2, punctuation: true, numbers: true });
    expect(run1).toBe(run2);

    const rngPlain1 = mulberry32(9876);
    const rngPlain2 = mulberry32(9876);
    expect(generateWords(50, { rng: rngPlain1 })).toBe(
      generateWords(50, { rng: rngPlain2 }),
    );
  });

  test("6. numbers mode on count 500 with seeded rng contains at least one /^[1-9][0-9]{0,3}$/ token", () => {
    const rng = mulberry32(42);
    const res = generateWords(500, { numbers: true, rng });
    const tokens = res.split(" ");
    expect(tokens.length).toBe(500);

    const numberTokens = tokens.filter((t) => /^[1-9][0-9]{0,3}$/.test(t));
    expect(numberTokens.length).toBeGreaterThan(0);
    expect(numberTokens.length).toBeGreaterThanOrEqual(25);
    expect(numberTokens.length).toBeLessThanOrEqual(75);
  });

  test("7. punctuation mode starts with an uppercase letter and ends with '.'", () => {
    for (const count of [1, 2, 10, 50, 100]) {
      const res = generateWords(count, { punctuation: true });
      expect(/^[A-Z]/.test(res)).toBe(true);
      expect(res.endsWith(".")).toBe(true);
    }
  });

  test("8. ASCII-only check across all modes", () => {
    const asciiRegex = /^[\x20-\x7E]*$/;
    expect(asciiRegex.test(generateWords(100))).toBe(true);
    expect(asciiRegex.test(generateWords(100, { punctuation: true }))).toBe(true);
    expect(asciiRegex.test(generateWords(100, { numbers: true }))).toBe(true);
    expect(
      asciiRegex.test(generateWords(100, { punctuation: true, numbers: true })),
    ).toBe(true);
  });
});
