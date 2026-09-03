import { describe, test, expect, beforeEach, vi } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { RaceView } from "../components/RaceView.tsx";
import { ResultsBoard } from "../components/ResultsBoard.tsx";
import { useRaceStore, resetRaceUi } from "../store/race.ts";
import { TypingEngine } from "../core/typing-engine.ts";
import { CursorManager } from "../core/cursor-manager.ts";
import { PassageLayout } from "../core/layout.ts";
import type { PlayerFinalStats } from "@typing-race/shared";

const PASSAGE = "the quick brown fox jumps over the lazy dog"; // 43 chars

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  resetRaceUi();
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

describe("RaceView — char-state accents & zero-commit overlay", () => {
  test("1. char with no state in ownCharStates renders as data-state=pending", () => {
    const { container } = render(
      <RaceView passageText="hi" playerId="me" onKeystroke={() => {}} onCorrection={() => {}} />,
    );
    const spans = container.querySelectorAll(".char");
    expect(spans.length).toBe(2);
    expect(spans[0]?.classList.contains("char-pending")).toBe(true);
    expect(spans[0]?.getAttribute("data-state")).toBe("pending");
    expect(spans[1]?.classList.contains("char-pending")).toBe(true);
    expect(spans[1]?.getAttribute("data-state")).toBe("pending");
  });

  test("2. char at index 0 with state correct renders data-state=correct", () => {
    useRaceStore.setState({ ownCharStates: ["correct", "pending"] });
    const { container } = render(
      <RaceView passageText="hi" playerId="me" onKeystroke={() => {}} onCorrection={() => {}} />,
    );
    const spans = container.querySelectorAll(".char");
    expect(spans[0]?.classList.contains("char-correct")).toBe(true);
    expect(spans[0]?.getAttribute("data-state")).toBe("correct");
    expect(spans[1]?.classList.contains("char-pending")).toBe(true);
  });

  test("3. char at index 1 with state error renders data-state=error", () => {
    useRaceStore.setState({ ownCharStates: ["pending", "error"] });
    const { container } = render(
      <RaceView passageText="hi" playerId="me" onKeystroke={() => {}} onCorrection={() => {}} />,
    );
    const spans = container.querySelectorAll(".char");
    expect(spans[0]?.classList.contains("char-pending")).toBe(true);
    expect(spans[1]?.classList.contains("char-error")).toBe(true);
    expect(spans[1]?.getAttribute("data-state")).toBe("error");
  });

  test("4. passage text splits correctly per char (43-char passage → 43 spans)", () => {
    const { container } = render(
      <RaceView
        passageText={PASSAGE}
        playerId="me"
        onKeystroke={() => {}} onCorrection={() => {}}
      />,
    );
    const spans = container.querySelectorAll(".char");
    expect(spans.length).toBe(PASSAGE.length);
  });

  test("5. mounts isolated cursor overlay without inline opponent cursor children", () => {
    const { container, getByTestId } = render(
      <RaceView
        passageText={PASSAGE}
        playerId="me"
      />,
    );
    const overlay = container.querySelector('[data-testid="cursor-overlay"]');
    expect(overlay).not.toBeNull();
    expect(overlay?.classList.contains("cursor-overlay")).toBe(true);
    // React render tree does NOT render opponent cursor elements directly inside char spans
    expect(container.querySelectorAll(".opponent-cursor").length).toBe(0);
  });

  test("6. typing keys trigger TypingEngine keystrokes", () => {
    const onKeystroke = vi.fn();
    render(
      <RaceView
        passageText={PASSAGE}
        playerId="me"
        onKeystroke={onKeystroke}
      />,
    );

    fireEvent.keyDown(window, { key: "t" });
    expect(onKeystroke).toHaveBeenCalledWith(0, "t");
  });
});

describe("ResultsBoard — ranking", () => {
  test("7. renders ranked list — finishTimeMs asc, WPM desc as tiebreaker", () => {
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
    const rows = container.querySelectorAll("tbody tr");
    expect(rows.length).toBe(3);
    expect(rows[0]?.textContent).toContain("b");
    expect(rows[1]?.textContent).toContain("c");
    expect(rows[2]?.textContent).toContain("a");
  });
});