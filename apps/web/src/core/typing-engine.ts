import type { CharState } from "../store/race";

export interface TypingEngineStats {
  rawWpm: number;
  netWpm: number;
  accuracy: number;
  uncorrectedErrors: number;
}
export type TypingStats = TypingEngineStats;

export interface TypingEngineEvents {
  keystroke: (index: number, char: string, clientTs: number) => void;
  correction: (backspaces: number, clientTs: number) => void;
  stats_updated: (stats: TypingEngineStats) => void;
  finished: (finishTimeMs: number) => void;
}

export class TypingEngine {
  private passageText: string = "";
  private ownIndex: number = 0;
  private charStates: CharState[] = [];
  private totalKeystrokes: number = 0;
  private startTimeMs: number | null = null;
  private listeners: Map<keyof TypingEngineEvents, Set<Function>> = new Map();

  constructor() {
    this.listeners.set("keystroke", new Set());
    this.listeners.set("correction", new Set());
    this.listeners.set("stats_updated", new Set());
    this.listeners.set("finished", new Set());
  }

  public init(passageText: string): void {
    this.passageText = passageText;
    this.ownIndex = 0;
    this.charStates = Array.from({ length: passageText.length }, () => "pending");
    this.totalKeystrokes = 0;
    this.startTimeMs = null;
  }

  public handleKeyDown(ev: KeyboardEvent): boolean {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) {
      return false;
    }

    if (ev.key === "Backspace") {
      if (this.ownIndex <= 0) {
        return false;
      }
      this.ownIndex -= 1;
      this.charStates[this.ownIndex] = "pending";
      const now = Date.now();
      this.emit("correction", 1, now);
      this.updateStats(now);
      return true;
    }

    const ch = ev.key === "Spacebar" ? " " : ev.key;
    if (ch.length !== 1) {
      return false;
    }

    if (this.ownIndex >= this.passageText.length) {
      return false;
    }

    const now = Date.now();
    if (this.startTimeMs === null) {
      this.startTimeMs = now;
    }

    this.totalKeystrokes += 1;
    const currentIndex = this.ownIndex;
    const expected = this.passageText[currentIndex] ?? "";
    this.charStates[currentIndex] = ch === expected ? "correct" : "error";
    this.ownIndex += 1;

    this.emit("keystroke", currentIndex, ch, now);
    this.updateStats(now);

    if (this.ownIndex === this.passageText.length) {
      const finishTimeMs = Math.max(0, now - (this.startTimeMs ?? now));
      this.emit("finished", finishTimeMs);
    }

    return true;
  }

  public subscribe<K extends keyof TypingEngineEvents>(
    event: K,
    handler: TypingEngineEvents[K],
  ): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler as Function);
    return () => {
      set?.delete(handler as Function);
    };
  }

  public updateStats(now?: number): void {
    const currentNow = now ?? Date.now();
    const elapsedMs =
      this.startTimeMs !== null ? Math.max(0, currentNow - this.startTimeMs) : 0;
    const elapsedMinutes = elapsedMs / 60_000;

    let correctChars = 0;
    let uncorrectedErrors = 0;

    for (let i = 0; i < this.ownIndex; i++) {
      if (this.charStates[i] === "correct") {
        correctChars += 1;
      } else if (this.charStates[i] === "error") {
        uncorrectedErrors += 1;
      }
    }

    const rawWpm =
      elapsedMinutes > 0 ? this.totalKeystrokes / 5 / elapsedMinutes : 0;
    const netWpm =
      elapsedMinutes > 0
        ? Math.max(0, (correctChars / 5 - uncorrectedErrors / 5) / elapsedMinutes)
        : 0;
    const accuracy =
      this.totalKeystrokes > 0 ? correctChars / this.totalKeystrokes : 1;

    this.emit("stats_updated", {
      rawWpm,
      netWpm,
      accuracy,
      uncorrectedErrors,
    });
  }

  public getOwnIndex(): number {
    return this.ownIndex;
  }

  public getCharStates(): readonly CharState[] {
    return this.charStates;
  }

  public getPassageText(): string {
    return this.passageText;
  }

  public getTotalKeystrokes(): number {
    return this.totalKeystrokes;
  }

  public getStartTimeMs(): number | null {
    return this.startTimeMs;
  }

  private emit<K extends keyof TypingEngineEvents>(
    event: K,
    ...args: Parameters<TypingEngineEvents[K]>
  ): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const handler of set) {
      try {
        (handler as any)(...args);
      } catch (err) {
        console.error(`Error in TypingEngine event handler for ${event}:`, err);
      }
    }
  }
}
