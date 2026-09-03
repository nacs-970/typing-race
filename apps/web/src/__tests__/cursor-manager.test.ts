import { describe, it, expect, beforeEach } from "vitest";
import { CursorManager, BUFFER_MS, MAX_EXTRAPOLATE_MS } from "../core/cursor-manager";

describe("CursorManager", () => {
  let manager: CursorManager;

  beforeEach(() => {
    manager = new CursorManager();
    manager.registerPlayer("p1", "Alice", "#34d399");
  });

  it("registers player metadata and starts with empty buffer", () => {
    expect(manager.getPlayerNickname("p1")).toBe("Alice");
    expect(manager.getPlayerColor("p1")).toBe("#34d399");
    expect(manager.getPlayerBuffer("p1")).toEqual([]);
    expect(manager.calculateInterpolatedIndex("p1", 1000)).toBe(0);
  });

  it("caps snapshot buffer at 10 items", () => {
    for (let i = 0; i < 15; i++) {
      manager.onCursorUpdate("p1", i, 1000 + i * 50);
    }
    const buf = manager.getPlayerBuffer("p1");
    expect(buf).toBeDefined();
    expect(buf!.length).toBe(10);
    expect(buf![0]?.index).toBe(5);
    expect(buf![9]?.index).toBe(14);
  });

  it("handles 0 or 1 snapshot gracefully", () => {
    expect(manager.calculateInterpolatedIndex("p1", 1000)).toBe(0);

    manager.onCursorUpdate("p1", 42, 500);
    expect(manager.calculateInterpolatedIndex("p1", 550)).toBe(42);
    expect(manager.calculateInterpolatedIndex("p1", 700)).toBe(42);
  });

  it("interpolates linearly between two snapshots (targetTime = s0 + 50ms)", () => {
    manager.onCursorUpdate("p1", 10, 1000);
    manager.onCursorUpdate("p1", 20, 1100);

    // If now = 1150, targetTime = now - 100 = 1050 (midpoint between 1000 and 1100)
    const index = manager.calculateInterpolatedIndex("p1", 1150);
    expect(index).toBeCloseTo(15, 5);

    // If targetTime <= first snapshot (now = 1080 -> targetTime = 980)
    expect(manager.calculateInterpolatedIndex("p1", 1080)).toBe(10);
  });

  it("extrapolates forward with constant velocity for dt <= 150ms", () => {
    manager.onCursorUpdate("p1", 10, 1000);
    manager.onCursorUpdate("p1", 20, 1100);

    const index = manager.calculateInterpolatedIndex("p1", 1250);
    expect(index).toBeCloseTo(25, 5);
  });

  it("clamps extrapolation when dt > 150ms and freezes at last snapshot index", () => {
    manager.onCursorUpdate("p1", 10, 1000);
    manager.onCursorUpdate("p1", 20, 1100);

    const index = manager.calculateInterpolatedIndex("p1", 1400);
    expect(index).toBe(20);
  });

  it("rewinds immediately on backspace without backward lerping", () => {
    manager.onCursorUpdate("p1", 10, 1000);
    manager.onCursorUpdate("p1", 20, 1100);
    expect(manager.getPlayerBuffer("p1")?.length).toBe(2);

    // Backspace correction received: index decreases to 18
    manager.onCursorUpdate("p1", 18, 1150);
    const buf = manager.getPlayerBuffer("p1");
    expect(buf?.length).toBe(1);
    expect(buf![0]?.index).toBe(18);
    expect(buf![0]?.receivedAt).toBe(1150);

    // Now calculate index: buffer has 1 item so it immediately returns 18
    expect(manager.calculateInterpolatedIndex("p1", 1200)).toBe(18);
  });

  it("removes player cleanly", () => {
    manager.onCursorUpdate("p1", 10, 1000);
    manager.removePlayer("p1");
    expect(manager.getPlayerBuffer("p1")).toBeUndefined();
    expect(manager.getPlayerNickname("p1")).toBeUndefined();
    expect(manager.getPlayerColor("p1")).toBeUndefined();
    expect(manager.calculateInterpolatedIndex("p1", 1100)).toBe(0);
  });

  it("tracks local progress index", () => {
    expect(manager.getLocalProgress()).toBe(0);
    manager.setLocalProgress(35);
    expect(manager.getLocalProgress()).toBe(35);
  });

  it("calculates words ahead accurately based on passage text", () => {
    const text = "one two three four five six seven eight";
    manager.setPassageText(text);

    // Behind or equal: 0 words ahead
    expect(manager.calculateWordsAhead(10, 5)).toBe(0);
    expect(manager.calculateWordsAhead(10, 10)).toBe(0);

    // Local at index 0 ('one')
    // Opponent at index 4 ('two'): 1 space crossed
    const words1 = manager.calculateWordsAhead(0, 4);
    expect(words1).toBeGreaterThanOrEqual(1);
    expect(words1).toBeLessThan(2);

    // Opponent at index 20 ('five'): 4 spaces crossed
    const words4 = manager.calculateWordsAhead(0, 20);
    expect(words4).toBeGreaterThanOrEqual(4);
    expect(words4).toBeLessThan(5);

    // Opponent at index 26 ('six'): 5 spaces crossed (5 words ahead)
    const words5 = manager.calculateWordsAhead(0, 26);
    expect(words5).toBeGreaterThanOrEqual(5);
  });

  it("fades opponent cursor and nametag smoothly as distance increases up to 5 words max", () => {
    const container = document.createElement("div");
    const mockLayout = {
      getCoordinates: (idx: number) => ({ x: idx * 10, y: 0 }),
      init: () => {},
      updateLayout: () => {},
    };
    manager.setPassageText("one two three four five six seven");
    manager.mount(container, mockLayout as any);

    // Local player at index 0
    manager.setLocalProgress(0);

    // Opponent p1 at index 0 (same position): opacity 1.0
    manager.onCursorUpdate("p1", 0, 1000);
    manager.renderFrame(1100);

    const dom = manager.getElements().get("p1");
    expect(dom).toBeDefined();
    expect(dom!.root.style.opacity).toBe("1.00");
    expect(dom!.root.style.visibility).toBe("visible");

    // Opponent p1 2 words ahead (index 9)
    manager.onCursorUpdate("p1", 9, 1100);
    manager.renderFrame(1200);
    const opacityMid = parseFloat(dom!.root.style.opacity);
    expect(opacityMid).toBeLessThan(1.0);
    expect(opacityMid).toBeGreaterThan(0.0);

    // Opponent p1 5 words ahead (index 24)
    manager.onCursorUpdate("p1", 24, 1200);
    manager.renderFrame(1300);
    expect(dom!.root.style.opacity).toBe("0.00");
    expect(dom!.root.style.visibility).toBe("hidden");
  });
});
