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
});