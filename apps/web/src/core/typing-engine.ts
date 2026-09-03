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
  private isFinished: boolean = false;
  public static readonly MAX_CONSECUTIVE_ERRORS = 5;
  private consecutiveErrors: number = 0;
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
    this.isFinished = false;
    this.consecutiveErrors = 0;
  }

  public handleKeyDown(ev: KeyboardEvent): boolean {
    if (this.isFinished) {
      return false;
    }

    if (ev.ctrlKey || ev.metaKey || ev.altKey) {
      return false;
    }

    // Allow Backspace / Delete even when holding down (ev.repeat === true)
    if (ev.key === "Backspace" || ev.key === "Delete") {
      if (this.ownIndex <= 0) {
        return false;
      }
      this.ownIndex -= 1;
      if (this.charStates[this.ownIndex] === "error") {
        this.consecutiveErrors = Math.max(0, this.consecutiveErrors - 1);
      }
      this.charStates[this.ownIndex] = "pending";
      const now = Date.now();
      this.emit("correction", 1, now);
      this.updateStats(now);
      return true;
    }

    // Anti-drag / hold grief prevention: reject auto-repeating character inputs
    if (ev.repeat) {
      return false;
    }

    const ch = ev.key === "Spacebar" ? " " : ev.key;
    if (ch.length !== 1) {
      return false;
    }

    if (this.ownIndex >= this.passageText.length) {
      return false;
    }

    const currentIndex = this.ownIndex;
    const expected = this.passageText[currentIndex] ?? "";
    const isCorrect = ch === expected;

    // Space boundary prevention:
    // 1. Cannot type Space if expected character is other char (no space dragging or skipping)
    // 2. Cannot type other char if expected character is a Space (must press space between words)
    if (ch === " " && expected !== " ") {
      return false;
    }
    if (expected === " " && ch !== " ") {
      return false;
    }

    // Gibberish spam prevention: cannot advance with more than MAX_CONSECUTIVE_ERRORS uncorrected errors
    if (!isCorrect && this.consecutiveErrors >= TypingEngine.MAX_CONSECUTIVE_ERRORS) {
      return false;
    }

    const now = Date.now();
    if (this.startTimeMs === null) {
      this.startTimeMs = now;
    }

    this.totalKeystrokes += 1;
    this.charStates[currentIndex] = isCorrect ? "correct" : "error";
    this.ownIndex += 1;
    if (isCorrect) {
      this.consecutiveErrors = 0;
    } else {
      this.consecutiveErrors += 1;
    }

    this.emit("keystroke", currentIndex, ch, now);
    this.updateStats(now);

    if (this.ownIndex === this.passageText.length) {
      // Ending abuse guard: cannot finish with wrong final character or < 50% accuracy
      const correctChars = this.getCorrectChars();
      const uncorrectedErrors = this.getUncorrectedErrors();
      const typedCount = correctChars + uncorrectedErrors;
      const isAccurateEnough = typedCount > 0 && correctChars / typedCount >= 0.5;
      if (!isCorrect || !isAccurateEnough) {
        return true;
      }
      this.isFinished = true;
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

  public getIsFinished(): boolean {
    return this.isFinished;
  }

  public getUncorrectedErrors(): number {
    let count = 0;
    for (const s of this.charStates) {
      if (s === "error") count++;
    }
    return count;
  }

  public getCorrectChars(): number {
    let count = 0;
    for (const s of this.charStates) {
      if (s === "correct") count++;
    }
    return count;
  }

  public getConsecutiveErrors(): number {
    return this.consecutiveErrors;
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
