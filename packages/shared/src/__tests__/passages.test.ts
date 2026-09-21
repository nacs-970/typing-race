/**
 * Passage corpus tests — REQ-10.
 *
 * 8 unit tests covering corpus shape, lookup helpers, and preview helper.
 */
import { describe, test, expect } from "bun:test";
import { z } from "zod";
import {
  PASSAGES,
  getPassageById,
  isValidPassageId,
  hostPickedPreview,
  generateRandomWords,
  getRandomPassage,
  getRandomCorpus,
} from "../passages.ts";

describe("Passage corpus shape", () => {
  test("1. PASSAGES has 50+ entries", () => {
    expect(PASSAGES.length).toBeGreaterThanOrEqual(50);
  });

  test("2. every entry has 30-60 words in text", () => {
    for (const p of PASSAGES) {
      const wc = p.text.trim().split(/\s+/).length;
      expect(wc).toBeGreaterThanOrEqual(30);
      expect(wc).toBeLessThanOrEqual(60);
    }
  });

  test("3. every entry has a non-empty source", () => {
    for (const p of PASSAGES) {
      expect(p.source.length).toBeGreaterThan(0);
    }
  });

  test("4. every id is unique", () => {
    const set = new Set(PASSAGES.map((p) => p.id));
    expect(set.size).toBe(PASSAGES.length);
  });

  test("5. every id parses via Zod 4 UUID v4", () => {
    for (const p of PASSAGES) {
      const r = z.string().uuid().safeParse(p.id);
      expect(r.success).toBe(true);
    }
  });
});

describe("Passage helpers", () => {
  test("6. getPassageById resolves known id; null for unknown", () => {
    const known = PASSAGES[0];
    if (!known) throw new Error("PASSAGES[0] missing");
    expect(getPassageById(known.id)?.text).toBe(known.text);
    expect(getPassageById("99999999-9999-4999-8999-999999999999")).toBeNull();
  });

  test("7. hostPickedPreview truncates at 30 chars + ellipsis", () => {
    const long = PASSAGES[0];
    if (!long) throw new Error("PASSAGES[0] missing");
    if (long.text.length > 30) {
      const preview = hostPickedPreview(long);
      expect(preview.endsWith("…")).toBe(true);
      expect(preview.length).toBe(31); // 30 chars + ellipsis
    }
    // Short passage (<=30 chars) gets full text
    const short = { id: "x", text: "hi", source: "x" };
    expect(hostPickedPreview(short)).toBe("hi");
  });

  test("8. isValidPassageId accepts valid; rejects unknown", () => {
    const known = PASSAGES[0];
    if (!known) throw new Error("PASSAGES[0] missing");
    expect(isValidPassageId(known.id)).toBe(true);
    expect(isValidPassageId("99999999-9999-4999-8999-999999999999")).toBe(false);
  });

  test("9. generateRandomWords produces variable word count within category range and valid uuid", () => {
    const short = generateRandomWords("short");
    const shortWc = short.text.trim().split(/\s+/).length;
    expect(shortWc).toBeGreaterThanOrEqual(20);
    expect(shortWc).toBeLessThanOrEqual(30);
    expect(z.string().uuid().safeParse(short.id).success).toBe(true);

    const mid = generateRandomWords("mid");
    const midWc = mid.text.trim().split(/\s+/).length;
    expect(midWc).toBeGreaterThanOrEqual(40);
    expect(midWc).toBeLessThanOrEqual(55);
    expect(z.string().uuid().safeParse(mid.id).success).toBe(true);

    const long = generateRandomWords("long");
    const longWc = long.text.trim().split(/\s+/).length;
    expect(longWc).toBeGreaterThanOrEqual(70);
    expect(longWc).toBeLessThanOrEqual(90);
    expect(z.string().uuid().safeParse(long.id).success).toBe(true);
  });

  test("10. getRandomPassage selects passages respecting category character-length bounds", () => {
    const short = getRandomPassage("short");
    expect(short.text.trim().length).toBeLessThanOrEqual(240);

    const mid = getRandomPassage("mid");
    const midLen = mid.text.trim().length;
    expect(midLen).toBeGreaterThan(240);
    expect(midLen).toBeLessThan(281);

    const long = getRandomPassage("long");
    expect(long.text.trim().length).toBeGreaterThanOrEqual(281);
  });

  test("11. getRandomCorpus routes between random_words and passage", () => {
    const wordsCorpus = getRandomCorpus("random_words", "short");
    expect(wordsCorpus.source.includes("Random Words")).toBe(true);
    const wc = wordsCorpus.text.trim().split(/\s+/).length;
    expect(wc).toBeGreaterThanOrEqual(20);
    expect(wc).toBeLessThanOrEqual(30);

    const passageCorpus = getRandomCorpus("passage", "mid");
    expect(PASSAGES.some((p) => p.id === passageCorpus.id)).toBe(true);
  });
});