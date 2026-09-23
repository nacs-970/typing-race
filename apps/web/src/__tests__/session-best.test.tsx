import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StrictMode } from "react";
import { render, cleanup } from "@testing-library/react";
import { ResultsBoard } from "../components/ResultsBoard";
import { useConnectionStore } from "../store/connection";
import type { PlayerFinalStats } from "@typing-race/shared";

/**
 * happy-dom does not expose a bare global `sessionStorage` (only
 * `window.sessionStorage`), same quirk documented for `localStorage` in
 * App.test.tsx. Stub a minimal in-memory implementation so ResultsBoard's
 * bare `sessionStorage.getItem/setItem` calls resolve in this test file.
 */
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

let memoryStorage: MemoryStorage;

const results: PlayerFinalStats[] = [
  { playerId: "player-1", finishTimeMs: 20000, wpm: 80, accuracy: 0.98 },
  { playerId: "player-2", finishTimeMs: 21200, wpm: 75, accuracy: 0.96 },
];

beforeEach(() => {
  memoryStorage = new MemoryStorage();
  vi.stubGlobal("sessionStorage", memoryStorage);
  useConnectionStore.setState({ playerId: "player-1" });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ResultsBoard session best — Step H", () => {
  it("shows 'New best today' and stores it when there is no previous best", () => {
    const { getByText } = render(<ResultsBoard results={results} isHost={false} />);

    expect(getByText("New best today")).toBeDefined();
    expect(memoryStorage.getItem("typing_race_best_wpm")).toBe("80.0");
  });

  it("shows the stored best when it beats the new result", () => {
    memoryStorage.setItem("typing_race_best_wpm", "95.0");

    const { getByText } = render(<ResultsBoard results={results} isHost={false} />);

    expect(getByText("Your best today: 95.0 wpm")).toBeDefined();
  });

  it("shows nothing when the viewer has no result row", () => {
    useConnectionStore.setState({ playerId: "someone-else" });

    const { queryByText } = render(<ResultsBoard results={results} isHost={false} />);

    expect(queryByText(/best today/)).toBeNull();
  });

  it("stays 'New best today' under StrictMode's double effect invocation", () => {
    const { getByText, queryByText } = render(
      <StrictMode>
        <ResultsBoard results={results} isHost={false} />
      </StrictMode>,
    );

    expect(getByText("New best today")).toBeDefined();
    expect(queryByText(/^Your best today/)).toBeNull();
    expect(memoryStorage.getItem("typing_race_best_wpm")).toBe("80.0");
  });

  it("does not re-evaluate against its own just-written value on an unrelated re-render", () => {
    const { getByText, rerender } = render(<ResultsBoard results={results} isHost={false} />);
    expect(getByText("New best today")).toBeDefined();

    rerender(<ResultsBoard results={[...results]} isHost={false} />);

    expect(getByText("New best today")).toBeDefined();
    expect(memoryStorage.getItem("typing_race_best_wpm")).toBe("80.0");
  });
});
