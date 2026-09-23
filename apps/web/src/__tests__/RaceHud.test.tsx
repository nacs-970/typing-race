import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, cleanup, act } from "@testing-library/react";
import { RaceHud } from "../components/RaceHud";
import { TypingEngine } from "../core/typing-engine";
import { useCursorStore } from "../store/cursor";

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  useCursorStore.setState({ ownIndex: 0, cursors: new Map() });
});

describe("RaceHud", () => {
  it("renders rounded Net WPM integer from TypingEngine stats", () => {
    const engine = new TypingEngine();
    engine.init("hello world");

    const { getByTestId } = render(
      <RaceHud typingEngine={engine} passageLength={11} />,
    );

    expect(getByTestId("net-wpm-value").textContent).toBe("0");

    // Manually emit stats_updated wrapped in act
    act(() => {
      (engine as any).emit("stats_updated", {
        rawWpm: 72.4,
        netWpm: 68.8,
        accuracy: 0.954,
        uncorrectedErrors: 1,
      });
    });

    expect(getByTestId("net-wpm-value").textContent).toBe("69");
  });

  it("dynamically reflects rank badge based on opponent progress", () => {
    const engine = new TypingEngine();
    engine.init("hello world");

    // Local progress is 5, opponents are at 2 and 4 -> local is #1
    useCursorStore.setState({ ownIndex: 5 });

    const opponents = [
      { playerId: "p1", progress: 2 },
      { playerId: "p2", progress: 4 },
    ];

    const { getByTestId, rerender } = render(
      <RaceHud typingEngine={engine} passageLength={11} players={opponents} />,
    );

    expect(getByTestId("rank-badge").textContent).toBe("#1");

    // If opponent p1 surges to 8 -> local is #2
    const updatedOpponents = [
      { playerId: "p1", progress: 8 },
      { playerId: "p2", progress: 4 },
    ];

    rerender(
      <RaceHud typingEngine={engine} passageLength={11} players={updatedOpponents} />,
    );

    expect(getByTestId("rank-badge").textContent).toBe("#2");
  });

  it("calculates progress percentage according to typed character ratio", () => {
    const engine = new TypingEngine();
    engine.init("1234567890"); // length 10
    useCursorStore.setState({ ownIndex: 4 }); // 40%

    const { getByTestId } = render(
      <RaceHud typingEngine={engine} passageLength={10} />,
    );

    const fill = getByTestId("progress-fill");
    expect(fill.style.width).toBe("40%");
  });

  it("renders hover breakdown tooltip on hover", () => {
    const engine = new TypingEngine();
    engine.init("sample text");

    const { getByTestId, queryByTestId } = render(
      <RaceHud typingEngine={engine} passageLength={11} />,
    );

    expect(queryByTestId("wpm-tooltip")).toBeNull();

    // Trigger hover
    const wpmDisplay = getByTestId("wpm-display");
    fireEvent.mouseEnter(wpmDisplay);

    const tooltip = getByTestId("wpm-tooltip");
    expect(tooltip).not.toBeNull();
    expect(tooltip.textContent).toContain("Net WPM:");
    expect(tooltip.textContent).toContain("Raw WPM:");
    expect(tooltip.textContent).toContain("Accuracy:");
    expect(tooltip.textContent).toContain("Errors:");

    // Trigger leave
    fireEvent.mouseLeave(wpmDisplay);
    expect(queryByTestId("wpm-tooltip")).toBeNull();
  });

  it("shows accuracy under the WPM number", () => {
    const engine = new TypingEngine();
    engine.init("hello world");

    const { getByTestId } = render(
      <RaceHud typingEngine={engine} passageLength={11} />,
    );

    expect(getByTestId("accuracy-line").textContent).toBe("100.0%");

    act(() => {
      (engine as any).emit("stats_updated", {
        rawWpm: 72.4,
        netWpm: 68.8,
        accuracy: 0.954,
        uncorrectedErrors: 1,
      });
    });

    expect(getByTestId("accuracy-line").textContent).toBe("95.4%");
  });

  it("requires two clicks on Leave before calling onLeaveRoom", () => {
    const engine = new TypingEngine();
    engine.init("hello world");
    const onLeaveRoom = vi.fn();

    const { getByText } = render(
      <RaceHud typingEngine={engine} passageLength={11} onLeaveRoom={onLeaveRoom} />,
    );

    const leaveBtn = getByText("Leave.");
    fireEvent.click(leaveBtn);
    expect(onLeaveRoom).not.toHaveBeenCalled();
    expect(getByText("Leave?")).toBeDefined();

    fireEvent.click(getByText("Leave?"));
    expect(onLeaveRoom).toHaveBeenCalledTimes(1);
  });
});
