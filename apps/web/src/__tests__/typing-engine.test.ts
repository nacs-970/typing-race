import { describe, it, expect, vi, beforeEach } from "vitest";
import { TypingEngine, type TypingEngineStats } from "../core/typing-engine";
import { computeNetWpm, computeAccuracy } from "../../../../apps/server/src/race/scoring";

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

    // Another backspace
    engine.handleKeyDown(new KeyboardEvent("keydown", { key: "Backspace" }));
    expect(engine.getOwnIndex()).toBe(0);
    expect(engine.getCharStates()[0]).toBe("pending");

    // Backspace at 0 does nothing and returns false
    const handledAtZero = engine.handleKeyDown(new KeyboardEvent("keydown", { key: "Backspace" }));
    expect(handledAtZero).toBe(false);
    expect(engine.getOwnIndex()).toBe(0);
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

    // Further keys after finish return false
    expect(shortEngine.handleKeyDown(new KeyboardEvent("keydown", { key: "!" }))).toBe(false);
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
});
