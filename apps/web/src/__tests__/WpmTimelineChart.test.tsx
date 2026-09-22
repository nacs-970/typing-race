import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { WpmTimelineChart } from "../components/WpmTimelineChart";
import type { PlayerFinalStats } from "@typing-race/shared";

afterEach(() => {
  cleanup();
});

const nicknameMap = new Map([
  ["p1", "Alice"],
  ["p2", "Bob"],
]);

const ranked: PlayerFinalStats[] = [
  { playerId: "p1", finishTimeMs: 20000, wpm: 80, accuracy: 0.98 },
  { playerId: "p2", finishTimeMs: 22000, wpm: 60, accuracy: 0.9 },
];

describe("WpmTimelineChart", () => {
  it("renders one path per player with samples", () => {
    const wpmHistory = {
      p1: [
        { t: 0, wpm: 0 },
        { t: 1000, wpm: 40 },
        { t: 2000, wpm: 80 },
      ],
      p2: [
        { t: 0, wpm: 0 },
        { t: 1000, wpm: 60 },
      ],
    };
    const { container } = render(
      <WpmTimelineChart ranked={ranked} nicknameMap={nicknameMap} wpmHistory={wpmHistory} />,
    );

    expect(container.querySelectorAll("path").length).toBe(2);
    expect(container.querySelectorAll("circle").length).toBe(2);
  });

  it("renders nothing when no player has samples", () => {
    const { container } = render(
      <WpmTimelineChart ranked={ranked} nicknameMap={nicknameMap} wpmHistory={{}} />,
    );
    expect(container.querySelectorAll('[data-testid="wpm-timeline-chart"]').length).toBe(0);
  });
});
