import { describe, test, expect } from "vitest";
import { diffInput, SR_INPUT_SENTINEL, createSyntheticKeyboardEvent } from "../core/mobile-input.ts";

describe("diffInput", () => {
  test("one character appended returns a char diff", () => {
    const result = diffInput(SR_INPUT_SENTINEL, SR_INPUT_SENTINEL + "h");
    expect(result).toEqual({ type: "char", ch: "h" });
  });

  test("a shorter value returns a backspace diff with the removed count", () => {
    const result = diffInput(SR_INPUT_SENTINEL, "");
    expect(result).toEqual({ type: "backspace", count: SR_INPUT_SENTINEL.length });
  });

  test("deleting a multi-character selection counts every removed character", () => {
    const result = diffInput("abcd", "a");
    expect(result).toEqual({ type: "backspace", count: 3 });
  });

  test("multiple characters inserted at once is ignored", () => {
    const result = diffInput(SR_INPUT_SENTINEL, SR_INPUT_SENTINEL + "hello");
    expect(result).toEqual({ type: "ignore" });
  });

  test("a paste that replaces the whole value is ignored", () => {
    const result = diffInput(SR_INPUT_SENTINEL, "pasted text");
    expect(result).toEqual({ type: "ignore" });
  });

  test("a same-length replacement is ignored", () => {
    const result = diffInput("ab", "cd");
    expect(result).toEqual({ type: "ignore" });
  });

  test("no change at all is ignored", () => {
    const result = diffInput(SR_INPUT_SENTINEL, SR_INPUT_SENTINEL);
    expect(result).toEqual({ type: "ignore" });
  });

  test("an insertion that does not extend the previous value is ignored", () => {
    // Same length-plus-one, but the extra character landed in the middle
    // rather than appended — the caret moved, or an IME rewrote the buffer.
    const result = diffInput("ac", "abc");
    expect(result).toEqual({ type: "ignore" });
  });
});

describe("createSyntheticKeyboardEvent", () => {
  test("builds a minimal event-shaped object the engine can read", () => {
    const ev = createSyntheticKeyboardEvent("a");
    expect(ev.key).toBe("a");
    expect(ev.repeat).toBe(false);
    expect(ev.ctrlKey).toBe(false);
    expect(ev.metaKey).toBe(false);
    expect(ev.altKey).toBe(false);
    expect(() => ev.preventDefault()).not.toThrow();
  });

  test("carries the requested key through, e.g. Backspace", () => {
    const ev = createSyntheticKeyboardEvent("Backspace");
    expect(ev.key).toBe("Backspace");
  });
});
