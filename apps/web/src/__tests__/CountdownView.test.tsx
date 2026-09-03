import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { CountdownView } from "../components/CountdownView";
import { useClockStore } from "../store/clock";

describe("CountdownView", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(100000);
    useClockStore.setState({ offsetMs: 0 });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders '3' when 2500ms remaining", () => {
    const startsAt = 100000 + 2500;
    const { getByTestId } = render(<CountdownView startsAtServerMs={startsAt} />);
    expect(getByTestId("countdown-num").textContent).toBe("3");
  });

  it("renders '2' when 1500ms remaining", () => {
    const startsAt = 100000 + 1500;
    const { getByTestId } = render(<CountdownView startsAtServerMs={startsAt} />);
    expect(getByTestId("countdown-num").textContent).toBe("2");
  });

  it("renders '1' when 500ms remaining", () => {
    const startsAt = 100000 + 500;
    const { getByTestId } = render(<CountdownView startsAtServerMs={startsAt} />);
    expect(getByTestId("countdown-num").textContent).toBe("1");
  });

  it("renders 'GO!' and calls onCountdownComplete when countdown elapses", () => {
    const onComplete = vi.fn();
    const startsAt = 100000 + 800; // 800ms left -> '1'
    const { getByTestId } = render(
      <CountdownView startsAtServerMs={startsAt} onCountdownComplete={onComplete} />,
    );

    expect(getByTestId("countdown-num").textContent).toBe("1");

    // Advance 850ms so startsAt has passed
    act(() => {
      vi.advanceTimersByTime(850);
    });

    expect(getByTestId("countdown-num").textContent).toBe("GO!");
    expect(onComplete).toHaveBeenCalled();
  });

  it("accounts for clock offset in time calculation", () => {
    // Client clock is 5000ms behind server (serverNow = Date.now() + offsetMs = 100000 + 5000 = 105000)
    useClockStore.setState({ offsetMs: 5000 });
    // Server starts at 107500 -> remaining should be 107500 - 105000 = 2500ms -> '3'
    const startsAt = 107500;
    const { getByTestId } = render(<CountdownView startsAtServerMs={startsAt} />);
    expect(getByTestId("countdown-num").textContent).toBe("3");
  });
});
