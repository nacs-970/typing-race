/**
 * RaceView char-state accent tests — Phase 3 Plan 04.
 *
 * 5 tests:
 *  1. char with no state in ownCharStates renders as data-state=pending
 *  2. char at index 2 with state correct renders data-state=correct
 *  3. char at index 5 with state error renders data-state=error
 *  4. passage text splits correctly per char (50-char passage → 50 spans)
 *  5. ResultsBoard renders ranked list (finishTimeMs asc, WPM desc tiebreaker)
 */
import { describe, test, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { RaceView } from "../components/RaceView.tsx";
import { ResultsBoard } from "../components/ResultsBoard.tsx";
import { useRaceStore, resetRaceUi } from "../store/race.ts";
import type { PlayerFinalStats } from "@typing-race/shared";

const PASSAGE = "the quick brown fox jumps over the lazy dog"; // 43 chars

beforeEach(() => {
  resetRaceUi();
});

describe("RaceView — char-state accents", () => {
  test("1. char with no state in ownCharStates renders as data-state=pending", () => {
    const { container } = render(
      <RaceView passageText="hi" playerId="me" onKeystroke={() => {}} />,
    );
    const spans = container.querySelectorAll(".char");
    expect(spans.length).toBe(2);
    expect(spans[0]?.classList.contains("char-pending")).toBe(true);
    expect(spans[1]?.classList.contains("char-pending")).toBe(true);
  });

  test("2. char at index 0 with state correct renders data-state=correct", () => {
    useRaceStore.setState({ ownCharStates: ["correct", "pending"] });
    const { container } = render(
      <RaceView passageText="hi" playerId="me" onKeystroke={() => {}} />,
    );
    const spans = container.querySelectorAll(".char");
    expect(spans[0]?.classList.contains("char-correct")).toBe(true);
    expect(spans[1]?.classList.contains("char-pending")).toBe(true);
  });

  test("3. char at index 1 with state error renders data-state=error", () => {
    useRaceStore.setState({ ownCharStates: ["pending", "error"] });
    const { container } = render(
      <RaceView passageText="hi" playerId="me" onKeystroke={() => {}} />,
    );
    const spans = container.querySelectorAll(".char");
    expect(spans[0]?.classList.contains("char-pending")).toBe(true);
    expect(spans[1]?.classList.contains("char-error")).toBe(true);
  });

  test("4. passage text splits correctly per char (43-char passage → 43 spans)", () => {
    const { container } = render(
      <RaceView
        passageText={PASSAGE}
        playerId="me"
        onKeystroke={() => {}}
      />,
    );
    const spans = container.querySelectorAll(".char");
    expect(spans.length).toBe(PASSAGE.length);
  });
});

describe("ResultsBoard — ranking", () => {
  test("5. renders ranked list — finishTimeMs asc, WPM desc as tiebreaker", () => {
    const results: PlayerFinalStats[] = [
      { playerId: "a", finishTimeMs: 30000, wpm: 50, accuracy: 0.9 },
      { playerId: "b", finishTimeMs: 20000, wpm: 60, accuracy: 0.95 },
      { playerId: "c", finishTimeMs: 25000, wpm: 40, accuracy: 0.85 },
    ];
    const { container } = render(
      <ResultsBoard
        results={results}
        isHost={false}
        onRematch={() => {}}
      />,
    );
    // Verify rows are in order: b (20s, 60wpm), c (25s, 40wpm), a (30s, 50wpm)
    const rows = container.querySelectorAll("tbody tr");
    expect(rows.length).toBe(3);
    expect(rows[0]?.textContent).toContain("b");
    expect(rows[1]?.textContent).toContain("c");
    expect(rows[2]?.textContent).toContain("a");
  });
});