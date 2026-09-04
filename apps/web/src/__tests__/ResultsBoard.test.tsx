import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { ResultsBoard } from "../components/ResultsBoard";
import { useConnectionStore } from "../store/connection";
import { useRaceStore } from "../store/race";
import type { PlayerFinalStats } from "@typing-race/shared";

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  useConnectionStore.setState({ playerId: "player-1" });
});

describe("ResultsBoard", () => {
  const sampleResults: PlayerFinalStats[] = [
    { playerId: "player-1", finishTimeMs: 20000, wpm: 80, accuracy: 0.98 },
    { playerId: "player-2", finishTimeMs: 21200, wpm: 75, accuracy: 0.96 },
    { playerId: "player-3", finishTimeMs: 25000, wpm: 60, accuracy: 0.92 },
    { playerId: "player-4", finishTimeMs: 28000, wpm: 50, accuracy: 0.88 },
  ];

  it("renders ranked list sorting by finish time with podium medals", () => {
    const { getByLabelText, container } = render(
      <ResultsBoard results={sampleResults} isHost={false} />,
    );

    expect(getByLabelText("1st Place")).toBeDefined();
    expect(getByLabelText("2nd Place")).toBeDefined();
    expect(getByLabelText("3rd Place")).toBeDefined();

    const rows = container.querySelectorAll('[data-testid="result-row"]');
    expect(rows.length).toBe(4);
  });

  it("uses WPM as tiebreaker when finishTimeMs is identical", () => {
    const tiedResults: PlayerFinalStats[] = [
      { playerId: "p-slow-wpm", finishTimeMs: 20000, wpm: 60, accuracy: 0.9 },
      { playerId: "p-fast-wpm", finishTimeMs: 20000, wpm: 75, accuracy: 0.9 },
    ];

    const { container } = render(
      <ResultsBoard results={tiedResults} isHost={false} />,
    );

    const rows = container.querySelectorAll('[data-testid="result-row"]');
    expect(rows[0]?.getAttribute("data-player-id")).toBe("p-fast-wpm");
    expect(rows[1]?.getAttribute("data-player-id")).toBe("p-slow-wpm");
  });

  it("formats time deltas relative to winner correctly", () => {
    const { getByText } = render(
      <ResultsBoard results={sampleResults} isHost={false} />,
    );

    expect(getByText("Winner")).toBeDefined();
    // 21200 - 20000 = 1200ms -> +1.2s
    expect(getByText("+1.2s")).toBeDefined();
    // 25000 - 20000 = 5000ms -> +5.0s
    expect(getByText("+5.0s")).toBeDefined();
  });

  it("highlights the local player row with (You) tag", () => {
    const { getByText, container } = render(
      <ResultsBoard results={sampleResults} isHost={false} />,
    );

    expect(getByText("(You)")).toBeDefined();
    const myRow = container.querySelector('[data-player-id="player-1"]');
    expect(myRow?.classList.contains("font-bold")).toBe(true);
  });

  it("renders empty state when awaiting finishers", () => {
    const { getByText } = render(
      <ResultsBoard results={[]} isHost={false} />,
    );

    expect(getByText("Awaiting Race Finishers")).toBeDefined();
    expect(
      getByText("Complete the passage to view final standings, WPM, and accuracy metrics."),
    ).toBeDefined();
  });

  it("triggers onRematch when host clicks Play Again", () => {
    const onRematch = vi.fn();
    const { getByTestId } = render(
      <ResultsBoard results={sampleResults} isHost={true} onRematch={onRematch} />,
    );

    const playAgainBtn = getByTestId("rematch-button");
    fireEvent.click(playAgainBtn);
    expect(onRematch).toHaveBeenCalled();
  });

  it("shows selected type and length in Play Again button", () => {
    useRaceStore.setState({ corpusType: "random_words", corpusCategory: "short" });
    const { getByText } = render(
      <ResultsBoard results={sampleResults} isHost={true} />,
    );

    expect(getByText("Play Again (Random Words - Short)")).toBeDefined();
  });

  it("triggers onLeaveRoom when host clicks Leave Room", () => {
    const onLeaveRoom = vi.fn();
    const { getByText } = render(
      <ResultsBoard results={sampleResults} isHost={true} onLeaveRoom={onLeaveRoom} />,
    );

    const leaveBtn = getByText("🚪 Leave Room");
    fireEvent.click(leaveBtn);
    expect(onLeaveRoom).toHaveBeenCalled();
  });

  it("triggers onLeaveRoom when guest clicks Leave Room", () => {
    const onLeaveRoom = vi.fn();
    const { getByText } = render(
      <ResultsBoard results={sampleResults} isHost={false} onLeaveRoom={onLeaveRoom} />,
    );

    const leaveBtn = getByText("🚪 Leave Room");
    fireEvent.click(leaveBtn);
    expect(onLeaveRoom).toHaveBeenCalled();
  });
});
