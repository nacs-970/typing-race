/**
 * Room code generator tests — Phase 2 Plan 01 tracer.
 *
 * 4 unit tests:
 *  1. genRoomCode() produces length-6 strings
 *  2. All chars in 10k samples are in ROOM_CODE_ALPHABET
 *  3. 10k samples produce >9,900 unique values
 *  4. isValidRoomCode accepts valid codes, rejects bad ones
 */
import { describe, test, expect } from "bun:test";
import {
  ROOM_CODE_ALPHABET,
  genRoomCode,
  isValidRoomCode,
} from "../codes.ts";

describe("Room code generator", () => {
  test("1. genRoomCode() produces 6-char strings", () => {
    for (let i = 0; i < 100; i++) {
      expect(genRoomCode()).toHaveLength(6);
    }
  });

  test("2. 10k samples — every char in alphabet (no I/O/0/1 leakage)", () => {
    const banned = new Set(["I", "O", "0", "1"]);
    for (let i = 0; i < 10_000; i++) {
      const code = genRoomCode();
      for (const ch of code) {
        expect(banned.has(ch)).toBe(false);
        expect(ROOM_CODE_ALPHABET.includes(ch)).toBe(true);
      }
    }
  });

  test("3. 10k samples — >9,900 unique (birthday paradox)", () => {
    const set = new Set<string>();
    for (let i = 0; i < 10_000; i++) set.add(genRoomCode());
    expect(set.size).toBeGreaterThan(9_900);
  });

  test("4. isValidRoomCode accepts good, rejects bad", () => {
    // 100 random valid codes should all pass
    for (let i = 0; i < 100; i++) {
      expect(isValidRoomCode(genRoomCode())).toBe(true);
    }
    // known bad
    expect(isValidRoomCode("ABC1FG")).toBe(false); // contains 1
    expect(isValidRoomCode("ABCDE1")).toBe(false); // contains 1
    expect(isValidRoomCode("OOOOOO")).toBe(false); // contains O
    expect(isValidRoomCode("")).toBe(false);
    expect(isValidRoomCode("abc123")).toBe(false); // lowercase
  });
});