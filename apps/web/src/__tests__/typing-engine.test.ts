import { describe, it, expect, vi, beforeEach } from "vitest";
import { TypingEngine, type TypingEngineStats } from "../core/typing-engine";
import { computeNetWpm, computeAccuracy } from "../../../../apps/engine/src/race/scoring";

describe("TypingEngine", () => {
  let engine: TypingEngine;
  const passage = "The quick brown fox";

  beforeEach(() => {
    engine = new TypingEngine();
    engine.init(passage);
  });

  it("initializes with pending charStates and zero index", () => {
    expect(engine.getOwnIndex()).toBe(0);
    expect(engine.getPassageText()).toBe(passage);
    expect(engine.getCharStates().length).toBe(passage.length);
    expect(engine.getCharStates().every((s) => s === "pending")).toBe(true);
    expect(engine.getTotalKeystrokes()).toBe(0);
  });

  it("handles correct and error keystrokes", () => {
    const keystrokeSpy = vi.fn();
    const statsSpy = vi.fn();
    engine.subscribe("keystroke", keystrokeSpy);
    engine.subscribe("stats_updated", statsSpy);

    // Correct character 'T'
    const evT = new KeyboardEvent("keydown", { key: "T" });
    const handledT = engine.handleKeyDown(evT);
    expect(handledT).toBe(true);
    expect(engine.getOwnIndex()).toBe(1);
    expect(engine.getCharStates()[0]).toBe("correct");
    expect(keystrokeSpy).toHaveBeenCalledWith(0, "T", expect.any(Number));
    expect(statsSpy).toHaveBeenCalled();

    // Wrong character 'x' instead of 'h'
    const evX = new KeyboardEvent("keydown", { key: "x" });
    const handledX = engine.handleKeyDown(evX);
    expect(handledX).toBe(true);
    expect(engine.getOwnIndex()).toBe(2);
    expect(engine.getCharStates()[1]).toBe("error");
    expect(keystrokeSpy).toHaveBeenCalledWith(1, "x", expect.any(Number));
  });

  it("handles backspace and resets charState to pending", () => {
    const correctionSpy = vi.fn();
    engine.subscribe("correction", correctionSpy);

    // Type 2 characters
    engine.handleKeyDown(new KeyboardEvent("keydown", { key: "T" }));
    engine.handleKeyDown(new KeyboardEvent("keydown", { key: "x" }));
    expect(engine.getOwnIndex()).toBe(2);
    expect(engine.getCharStates()[1]).toBe("error");

    // Backspace
    const handledBack = engine.handleKeyDown(new KeyboardEvent("keydown", { key: "Backspace" }));
    expect(handledBack).toBe(true);
    expect(engine.getOwnIndex()).toBe(1);
    expect(engine.getCharStates()[1]).toBe("pending");
    expect(correctionSpy).toHaveBeenCalledWith(1, expect.any(Number));

    // Word "The" (indices 0-2) is still incomplete (only 2 of 3 chars typed),
    // so it stays fully editable even though index 0 is "correct".
    const handledOverCorrect = engine.handleKeyDown(
      new KeyboardEvent("keydown", { key: "Backspace" }),
    );
    expect(handledOverCorrect).toBe(true);
    expect(engine.getOwnIndex()).toBe(0);
  });

  it("blocks backspace at index 0", () => {
    const handledAtZero = engine.handleKeyDown(new KeyboardEvent("keydown", { key: "Backspace" }));
    expect(handledAtZero).toBe(false);
    expect(engine.getOwnIndex()).toBe(0);
  });

  describe("corrected-word delete prevention", () => {
    it("locks a word once it's fully typed with no error", () => {
      const testEngine = new TypingEngine();
      testEngine.init("old were");

      // "old" typed correctly, then "were" typed correctly
      for (const key of ["o", "l", "d", " ", "w", "e", "r", "e"]) {
        testEngine.handleKeyDown(new KeyboardEvent("keydown", { key }));
      }
      expect(testEngine.getOwnIndex()).toBe(8);

      // "were" is complete and error-free -> locked, can't reach back into "old"
      expect(testEngine.handleKeyDown(new KeyboardEvent("keydown", { key: "Backspace" }))).toBe(
        false,
      );
      expect(testEngine.getOwnIndex()).toBe(8);
    });

    it("keeps a completed word editable if it contains any error", () => {
      const testEngine = new TypingEngine();
      testEngine.init("old were");

      // Type "oxd" for "old" (middle char wrong)
      testEngine.handleKeyDown(new KeyboardEvent("keydown", { key: "o" }));
      testEngine.handleKeyDown(new KeyboardEvent("keydown", { key: "x" }));
      testEngine.handleKeyDown(new KeyboardEvent("keydown", { key: "d" }));
      expect(testEngine.getCharStates().slice(0, 3)).toEqual(["correct", "error", "correct"]);

      // "old" is fully typed but has an error -> stays deletable all the way down
      expect(testEngine.handleKeyDown(new KeyboardEvent("keydown", { key: "Backspace" }))).toBe(
        true,
      );
      expect(testEngine.handleKeyDown(new KeyboardEvent("keydown", { key: "Backspace" }))).toBe(
        true,
      );
      expect(testEngine.handleKeyDown(new KeyboardEvent("keydown", { key: "Backspace" }))).toBe(
        true,
      );
      expect(testEngine.getOwnIndex()).toBe(0);

      // Retype it correctly
      for (const key of ["o", "l", "d"]) {
        testEngine.handleKeyDown(new KeyboardEvent("keydown", { key }));
      }
      expect(testEngine.getCharStates().slice(0, 3)).toEqual(["correct", "correct", "correct"]);
    });

    it("keeps an incomplete word editable even if typed so far is all correct", () => {
      const testEngine = new TypingEngine();
      testEngine.init("old were");

      // "oxd" for "old" (error), then "wer" for "were" (correct so far, but incomplete)
      for (const key of ["o", "x", "d", " ", "w", "e", "r"]) {
        testEngine.handleKeyDown(new KeyboardEvent("keydown", { key }));
      }
      expect(testEngine.getOwnIndex()).toBe(7);

      // "were" isn't finished yet -> deletable straight through, and past the
      // space, into "old" (which also has an error and stays deletable) too
      for (let i = 0; i < 7; i++) {
        expect(
          testEngine.handleKeyDown(new KeyboardEvent("keydown", { key: "Backspace" })),
        ).toBe(true);
      }
      expect(testEngine.getOwnIndex()).toBe(0);
    });
  });

  it("discards modifier keys and non-character keys", () => {
    expect(engine.handleKeyDown(new KeyboardEvent("keydown", { key: "T", ctrlKey: true }))).toBe(false);
    expect(engine.handleKeyDown(new KeyboardEvent("keydown", { key: "T", metaKey: true }))).toBe(false);
    expect(engine.handleKeyDown(new KeyboardEvent("keydown", { key: "T", altKey: true }))).toBe(false);
    expect(engine.handleKeyDown(new KeyboardEvent("keydown", { key: "Shift" }))).toBe(false);
    expect(engine.handleKeyDown(new KeyboardEvent("keydown", { key: "Enter" }))).toBe(false);
    expect(engine.getOwnIndex()).toBe(0);
  });

  it("normalizes Spacebar to space", () => {
    const shortEngine = new TypingEngine();
    shortEngine.init("a b");
    shortEngine.handleKeyDown(new KeyboardEvent("keydown", { key: "a" }));
    shortEngine.handleKeyDown(new KeyboardEvent("keydown", { key: "Spacebar" }));
    expect(shortEngine.getOwnIndex()).toBe(2);
    expect(shortEngine.getCharStates()[1]).toBe("correct");
  });

  it("matches server scoring formulas for WPM and accuracy", () => {
    let latestStats: TypingEngineStats | null = null;
    engine.subscribe("stats_updated", (stats) => {
      latestStats = stats;
    });

    const mockNow = 1000000;
    vi.spyOn(Date, "now").mockReturnValue(mockNow);

    // Type 5 chars: T, h, e, ' ', q
    engine.handleKeyDown(new KeyboardEvent("keydown", { key: "T" }));
    engine.handleKeyDown(new KeyboardEvent("keydown", { key: "h" }));
    engine.handleKeyDown(new KeyboardEvent("keydown", { key: "e" }));
    engine.handleKeyDown(new KeyboardEvent("keydown", { key: " " }));
    engine.handleKeyDown(new KeyboardEvent("keydown", { key: "z" })); // 1 error

    // Fast forward 30 seconds
    const after30s = mockNow + 30000;
    engine.updateStats(after30s);

    const expectedNetWpm = computeNetWpm({
      correctChars: 4,
      uncorrectedErrors: 1,
      elapsedMs: 30000,
    });
    const expectedAccuracy = computeAccuracy({
      correctChars: 4,
      totalKeystrokes: 5,
    });

    expect(latestStats).not.toBeNull();
    expect(latestStats!.netWpm).toBeCloseTo(expectedNetWpm, 5);
    expect(latestStats!.accuracy).toBeCloseTo(expectedAccuracy, 5);
    expect(latestStats!.uncorrectedErrors).toBe(1);
    expect(latestStats!.rawWpm).toBeCloseTo((5 / 5) / (30000 / 60000), 5);

    vi.restoreAllMocks();
  });

  it("triggers finished event when entire passage is typed", () => {
    const shortEngine = new TypingEngine();
    shortEngine.init("Hi");
    const finishedSpy = vi.fn();
    shortEngine.subscribe("finished", finishedSpy);

    shortEngine.handleKeyDown(new KeyboardEvent("keydown", { key: "H" }));
    expect(finishedSpy).not.toHaveBeenCalled();

    shortEngine.handleKeyDown(new KeyboardEvent("keydown", { key: "i" }));
    expect(finishedSpy).toHaveBeenCalledWith(expect.any(Number));
    expect(shortEngine.getOwnIndex()).toBe(2);

    // Further keys (characters or Backspace) after finish return false and do not mutate state
    expect(shortEngine.getIsFinished()).toBe(true);
    expect(shortEngine.handleKeyDown(new KeyboardEvent("keydown", { key: "!" }))).toBe(false);
    expect(shortEngine.handleKeyDown(new KeyboardEvent("keydown", { key: "Backspace" }))).toBe(false);
    expect(shortEngine.getOwnIndex()).toBe(2);
  });

  it("unsubscribes listeners correctly", () => {
    const keystrokeSpy = vi.fn();
    const unsub = engine.subscribe("keystroke", keystrokeSpy);

    engine.handleKeyDown(new KeyboardEvent("keydown", { key: "T" }));
    expect(keystrokeSpy).toHaveBeenCalledTimes(1);

    unsub();
    engine.handleKeyDown(new KeyboardEvent("keydown", { key: "h" }));
    expect(keystrokeSpy).toHaveBeenCalledTimes(1);
  });

  it("rejects auto-repeat keydown events from held keys (anti-dragging)", () => {
    const testEngine = new TypingEngine();
    testEngine.init("The quick");

    // First physical keypress registers
    expect(testEngine.handleKeyDown(new KeyboardEvent("keydown", { key: "T", repeat: false }))).toBe(true);
    expect(testEngine.getOwnIndex()).toBe(1);

    // Held key repeats are discarded
    expect(testEngine.handleKeyDown(new KeyboardEvent("keydown", { key: "T", repeat: true }))).toBe(false);
    expect(testEngine.handleKeyDown(new KeyboardEvent("keydown", { key: " ", repeat: true }))).toBe(false);
    expect(testEngine.getOwnIndex()).toBe(1);
  });

  it("caps consecutive errors at 5 to prevent gibberish spamming, unlocking after backspace", () => {
    const testEngine = new TypingEngine();
    testEngine.init("abcdefghijklmn");

    // Type 5 wrong characters in a row: 'z', 'z', 'z', 'z', 'z'
    for (let i = 0; i < 5; i++) {
      expect(testEngine.handleKeyDown(new KeyboardEvent("keydown", { key: "z" }))).toBe(true);
    }
    expect(testEngine.getOwnIndex()).toBe(5);
    expect(testEngine.getConsecutiveErrors()).toBe(5);

    // 6th wrong key is blocked!
    expect(testEngine.handleKeyDown(new KeyboardEvent("keydown", { key: "z" }))).toBe(false);
    expect(testEngine.getOwnIndex()).toBe(5);

    // Backspace decrements error count
    expect(testEngine.handleKeyDown(new KeyboardEvent("keydown", { key: "Backspace" }))).toBe(true);
    expect(testEngine.getOwnIndex()).toBe(4);
    expect(testEngine.getConsecutiveErrors()).toBe(4);
  });

  it("prevents ending abuse when the final character is an error", () => {
    const testEngine = new TypingEngine();
    testEngine.init("abc");
    const finishedSpy = vi.fn();
    testEngine.subscribe("finished", finishedSpy);

    testEngine.handleKeyDown(new KeyboardEvent("keydown", { key: "a" }));
    testEngine.handleKeyDown(new KeyboardEvent("keydown", { key: "b" }));
    // Type wrong char for 'c'
    testEngine.handleKeyDown(new KeyboardEvent("keydown", { key: "x" }));

    expect(testEngine.getOwnIndex()).toBe(3);
    // Did NOT trigger finished because final char was wrong
    expect(finishedSpy).not.toHaveBeenCalled();
    expect(testEngine.getIsFinished()).toBe(false);
  });

  it("allows holding Backspace or Delete to repeat (ev.repeat === true)", () => {
    const testEngine = new TypingEngine();
    testEngine.init("Hello world");

    // Wrong chars so backspace-over-correct prevention doesn't interfere with this test
    testEngine.handleKeyDown(new KeyboardEvent("keydown", { key: "x" }));
    testEngine.handleKeyDown(new KeyboardEvent("keydown", { key: "x" }));
    testEngine.handleKeyDown(new KeyboardEvent("keydown", { key: "x" }));
    expect(testEngine.getOwnIndex()).toBe(3);

    // Repeated Backspace (held down) is accepted!
    expect(testEngine.handleKeyDown(new KeyboardEvent("keydown", { key: "Backspace", repeat: true }))).toBe(true);
    expect(testEngine.getOwnIndex()).toBe(2);

    expect(testEngine.handleKeyDown(new KeyboardEvent("keydown", { key: "Backspace", repeat: true }))).toBe(true);
    expect(testEngine.getOwnIndex()).toBe(1);
  });

  it("rejects Spacebar when expected character is not a space (anti-space-drag)", () => {
    const testEngine = new TypingEngine();
    testEngine.init("Hello world");

    // Expected char at index 0 is 'H' — pressing Space is rejected!
    expect(testEngine.handleKeyDown(new KeyboardEvent("keydown", { key: " " }))).toBe(false);
    expect(testEngine.getOwnIndex()).toBe(0);
  });

  it("rejects non-space characters when expected character is a space (anti-space-skip)", () => {
    const testEngine = new TypingEngine();
    testEngine.init("a b");

    // Type 'a'
    expect(testEngine.handleKeyDown(new KeyboardEvent("keydown", { key: "a" }))).toBe(true);
    expect(testEngine.getOwnIndex()).toBe(1);

    // Expected char at index 1 is ' ' — typing a letter like 'b' is rejected!
    expect(testEngine.handleKeyDown(new KeyboardEvent("keydown", { key: "b" }))).toBe(false);
    expect(testEngine.getOwnIndex()).toBe(1);

    // Typing Space is accepted
    expect(testEngine.handleKeyDown(new KeyboardEvent("keydown", { key: " " }))).toBe(true);
    expect(testEngine.getOwnIndex()).toBe(2);
  });
});
