import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { PerformanceChart } from "../components/PerformanceChart";
import type { PlayerFinalStats } from "@typing-race/shared";

afterEach(() => {
  cleanup();
});

const nicknameMap = new Map([
  ["p1", "Alice"],
  ["p2", "Bob"],
]);

describe("PerformanceChart", () => {
  const ranked: PlayerFinalStats[] = [
    { playerId: "p1", finishTimeMs: 20000, wpm: 80, accuracy: 0.98 },
    { playerId: "p2", finishTimeMs: 22000, wpm: 60, accuracy: 0.9 },
  ];

  it("renders one WPM bar and one accuracy bar per player", () => {
    const { container, getByText } = render(
      <PerformanceChart ranked={ranked} nicknameMap={nicknameMap} myId="p2" />,
    );

    expect(getByText("WPM")).toBeDefined();
    expect(getByText("Accuracy")).toBeDefined();
    expect(getByText("80.0")).toBeDefined();
    expect(getByText("60.0")).toBeDefined();
    expect(getByText("98.0%")).toBeDefined();
    expect(getByText("90.0%")).toBeDefined();
    expect(container.querySelectorAll('[data-testid="performance-chart"]').length).toBe(1);
  });

  it("marks the local player with a (You) suffix", () => {
    const { getAllByText } = render(
      <PerformanceChart ranked={ranked} nicknameMap={nicknameMap} myId="p2" />,
    );
    // One in the WPM panel, one in the Accuracy panel.
    expect(getAllByText("Bob (You)").length).toBe(2);
  });

  it("renders nothing when there are no results", () => {
    const { container } = render(
      <PerformanceChart ranked={[]} nicknameMap={nicknameMap} myId="p2" />,
    );
    expect(container.querySelectorAll('[data-testid="performance-chart"]').length).toBe(0);
  });
});
