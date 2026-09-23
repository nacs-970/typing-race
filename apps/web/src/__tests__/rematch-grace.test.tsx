import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { ResultsBoard } from "../components/ResultsBoard";
import { useConnectionStore } from "../store/connection";
import { useRaceStore } from "../store/race";
import { ws } from "../net/ws";
import type { PlayerFinalStats } from "@typing-race/shared";

const sampleResults: PlayerFinalStats[] = [
  { playerId: "player-1", finishTimeMs: 20000, wpm: 80, accuracy: 0.98 },
  { playerId: "player-2", finishTimeMs: 21200, wpm: 75, accuracy: 0.96 },
];

beforeEach(() => {
  useConnectionStore.setState({ playerId: "player-1" });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useRaceStore.setState({ graceSeconds: 5 });
});

describe("ResultsBoard rematch — Step E (host's grace)", () => {
  it("sends the store's graceSeconds on rematch instead of a hardcoded 5", () => {
    useRaceStore.setState({ graceSeconds: 10 });
    const sendSpy = vi.spyOn(ws, "send");

    const { getByTestId } = render(
      <ResultsBoard results={sampleResults} isHost={true} />,
    );

    fireEvent.click(getByTestId("rematch-button"));

    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "start_race", graceSeconds: 10 }),
    );
  });
});
