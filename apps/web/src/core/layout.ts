import {
  prepareWithSegments,
  layoutWithLines,
  type PreparedTextWithSegments,
} from "@chenglou/pretext";

export interface LineRange {
  start: number;
  end: number;
  width: number;
  y: number;
}

export class PassageLayout {
  private prepared: PreparedTextWithSegments | null = null;
  private lineRanges: LineRange[] = [];
  private charWidth: number = 9.6;
  private lineHeight: number = 32;
  private containerWidth: number = 800;

  public init(passageText: string, font: string = '16px "JetBrains Mono", monospace', lineHeight: number = 32): void {
    this.lineHeight = lineHeight;
    this.prepared = prepareWithSegments(passageText, font);

    if (typeof document !== "undefined") {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.font = font;
          const measured = ctx.measureText("M").width;
          if (measured > 0) {
            this.charWidth = measured;
          }
        }
      } catch {
        // Fall back to default charWidth
      }
    }
  }

  public updateLayout(containerWidth: number): LineRange[] {
    if (!this.prepared) {
      return [];
    }

    this.containerWidth = containerWidth;
    const { lines } = layoutWithLines(this.prepared, containerWidth, this.lineHeight);

    let runningCharIndex = 0;
    this.lineRanges = lines.map((line, idx) => {
      const start = runningCharIndex;
      runningCharIndex += line.text.length;
      return {
        start,
        end: runningCharIndex,
        width: line.width,
        y: idx * this.lineHeight,
      };
    });

    return this.lineRanges;
  }

  public getCoordinates(progressIndex: number): { x: number; y: number } {
    if (this.lineRanges.length === 0) {
      return { x: 0, y: 0 };
    }

    for (let i = 0; i < this.lineRanges.length; i++) {
      const range = this.lineRanges[i];
      if (!range) continue;
      // If progress falls within this line or it's the last line
      if (progressIndex >= range.start && (progressIndex < range.end || i === this.lineRanges.length - 1)) {
        const col = Math.max(0, progressIndex - range.start);
        const rawX = col * this.charWidth;
        const clampedX = Math.min(rawX, this.containerWidth);
        return { x: clampedX, y: range.y };
      }
    }

    const last = this.lineRanges[this.lineRanges.length - 1];
    if (!last) return { x: 0, y: 0 };
    const col = Math.max(0, progressIndex - last.start);
    return { x: Math.min(col * this.charWidth, this.containerWidth), y: last.y };
  }

  public getLineRanges(): readonly LineRange[] {
    return this.lineRanges;
  }

  public getCharWidth(): number {
    return this.charWidth;
  }

  public getLineHeight(): number {
    return this.lineHeight;
  }

  public getContainerWidth(): number {
    return this.containerWidth;
  }
}
