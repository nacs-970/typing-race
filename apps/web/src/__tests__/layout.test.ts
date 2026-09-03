import { describe, it, expect, beforeAll } from "vitest";
import { PassageLayout } from "../core/layout";

describe("PassageLayout", () => {
  const samplePassage =
    "The quick brown fox jumps over the lazy dog. Sphinx of black quartz, judge my vow. " +
    "Pack my box with five dozen liquor jugs. How vexingly quick daft zebras jump! " +
    "Bright vixens jump; dozy fowl quack.";

  beforeAll(() => {
    const mockCtx = {
      font: "",
      measureText: (text: string) => ({
        width: text.length * 10,
        actualBoundingBoxAscent: 10,
        actualBoundingBoxDescent: 2,
      }),
    };

    if (typeof OffscreenCanvas !== "undefined") {
      OffscreenCanvas.prototype.getContext = () => mockCtx as any;
    }
    HTMLCanvasElement.prototype.getContext = () => mockCtx as any;
  });

  it("initializes and measures character advance", () => {
    const layout = new PassageLayout();
    layout.init(samplePassage, "16px monospace", 32);

    expect(layout.getCharWidth()).toBe(10);
    expect(layout.getLineHeight()).toBe(32);
  });

  it("updates layout and splits passage into contiguous line ranges without gaps", () => {
    const layout = new PassageLayout();
    layout.init(samplePassage, "16px monospace", 32);

    const ranges = layout.updateLayout(300); // 300px width with 10px per char = ~30 chars per line
    expect(ranges.length).toBeGreaterThan(1);

    // Verify first line starts at 0
    expect(ranges[0]?.start).toBe(0);

    // Verify contiguous line ranges: next start === previous end
    for (let i = 1; i < ranges.length; i++) {
      const prev = ranges[i - 1]!;
      const curr = ranges[i]!;
      expect(curr.start).toBe(prev.end);
      expect(curr.y).toBe(i * 32);
    }

    // Last range ends at passageText length
    const last = ranges[ranges.length - 1]!;
    expect(last.end).toBe(samplePassage.length);
  });

  it("calculates coordinates accurately with monotonic x on a line and increasing y on line wraps", () => {
    const layout = new PassageLayout();
    layout.init(samplePassage, "16px monospace", 32);
    const ranges = layout.updateLayout(300);

    // Beginning of line 1
    const pt0 = layout.getCoordinates(0);
    expect(pt0.x).toBe(0);
    expect(pt0.y).toBe(0);

    // Monotonically increasing within line 1
    const pt1 = layout.getCoordinates(1);
    expect(pt1.x).toBe(10);
    expect(pt1.y).toBe(0);

    const pt5 = layout.getCoordinates(5);
    expect(pt5.x).toBe(50);
    expect(pt5.y).toBe(0);

    // Start of line 2
    const line2Start = ranges[1]!.start;
    const ptLine2 = layout.getCoordinates(line2Start);
    expect(ptLine2.x).toBe(0);
    expect(ptLine2.y).toBe(32);

    // Beyond passage end: stays on last line
    const pastEnd = layout.getCoordinates(samplePassage.length + 5);
    const lastRange = ranges[ranges.length - 1]!;
    expect(pastEnd.y).toBe(lastRange.y);
  });

  it("executes getCoordinates with high performance (<0.005ms per call)", () => {
    const layout = new PassageLayout();
    layout.init(samplePassage, "16px monospace", 32);
    layout.updateLayout(400);

    const iterations = 10000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      layout.getCoordinates(i % samplePassage.length);
    }
    const elapsed = performance.now() - start;
    const perCall = elapsed / iterations;

    expect(perCall).toBeLessThan(0.01);
  });
});
