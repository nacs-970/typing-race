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

  it("calculates word distance accurately (both ahead and behind) based on passage text", () => {
    const text = "one two three four five six seven eight";
    manager.setPassageText(text);

    // Same position: 0 distance
    expect(manager.calculateWordDistance(10, 10)).toBe(0);

    // Opponent ahead (0 -> 4): 1 word distance
    const distAhead = manager.calculateWordDistance(0, 4);
    expect(distAhead).toBeGreaterThanOrEqual(1);
    expect(distAhead).toBeLessThan(2);

    // Opponent behind (4 -> 0): 1 word distance
    const distBehind = manager.calculateWordDistance(4, 0);
    expect(distBehind).toBeGreaterThanOrEqual(1);
    expect(distBehind).toBeLessThan(2);

    // Opponent 5 words ahead (0 -> 26): 5 words distance
    expect(manager.calculateWordDistance(0, 26)).toBeGreaterThanOrEqual(5);

    // Opponent 5 words behind (26 -> 0): 5 words distance
    expect(manager.calculateWordDistance(26, 0)).toBeGreaterThanOrEqual(5);
  });

  it("fades opponent cursor and nametag smoothly for opponents both ahead and behind", () => {
    const container = document.createElement("div");
    const mockLayout = {
      getCoordinates: (idx: number) => ({ x: idx * 10, y: 0 }),
      init: () => {},
      updateLayout: () => {},
    };
    // 13 words: index 0..6 before 'six', and 6 words after 'six'
    const text = "zero one two three four five six seven eight nine ten eleven twelve";
    manager.setPassageText(text);
    manager.mount(container, mockLayout as any);

    // Local player at 'six' (index 29)
    const localIdx = text.indexOf("six");
    manager.setLocalProgress(localIdx);

    // Opponent p1 at same position: opacity 1.0
    manager.onCursorUpdate("p1", localIdx, 1000);
    manager.renderFrame(1100);

    const dom = manager.getElements().get("p1");
    expect(dom).toBeDefined();
    expect(dom!.root.style.opacity).toBe("1.00");
    expect(dom!.root.style.visibility).toBe("visible");

    // Opponent p1 2 words ahead ('eight'): partially faded
    const twoAhead = text.indexOf("eight");
    manager.onCursorUpdate("p1", twoAhead, 1100);
    manager.renderFrame(1200);
    const opacityAhead = parseFloat(dom!.root.style.opacity);
    expect(opacityAhead).toBeLessThan(1.0);
    expect(opacityAhead).toBeGreaterThan(0.0);

    // Opponent p1 5+ words ahead ('eleven'): completely faded away
    const fiveAhead = text.indexOf("eleven");
    manager.onCursorUpdate("p1", fiveAhead, 1200);
    manager.renderFrame(1300);
    expect(dom!.root.style.opacity).toBe("0.00");
    expect(dom!.root.style.visibility).toBe("hidden");

    // Opponent p1 2 words behind ('four'): partially faded
    const twoBehind = text.indexOf("four");
    manager.onCursorUpdate("p1", twoBehind, 1300);
    manager.renderFrame(1400);
    const opacityBehind = parseFloat(dom!.root.style.opacity);
    expect(opacityBehind).toBeLessThan(1.0);
    expect(opacityBehind).toBeGreaterThan(0.0);

    // Opponent p1 5+ words behind ('zero'): completely faded away
    const fiveBehind = text.indexOf("zero");
    manager.onCursorUpdate("p1", fiveBehind, 1400);
    manager.renderFrame(1500);
    expect(dom!.root.style.opacity).toBe("0.00");
    expect(dom!.root.style.visibility).toBe("hidden");
  });
});
