import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useConfirmClick } from "../components/useConfirmClick";

afterEach(() => {
  vi.useRealTimers();
});

describe("useConfirmClick", () => {
  it("arms on the first click without running the action", () => {
    const action = vi.fn();
    const { result } = renderHook(() => useConfirmClick(action));

    expect(result.current.armed).toBe(false);

    act(() => {
      result.current.onClick();
    });

    expect(result.current.armed).toBe(true);
    expect(action).not.toHaveBeenCalled();
  });

  it("runs the action and disarms on a second click within the timeout", () => {
    const action = vi.fn();
    const { result } = renderHook(() => useConfirmClick(action));

    act(() => {
      result.current.onClick();
    });
    act(() => {
      result.current.onClick();
    });

    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.armed).toBe(false);
  });

  it("disarms itself when the timeout elapses without a second click", () => {
    vi.useFakeTimers();
    const action = vi.fn();
    const { result } = renderHook(() => useConfirmClick(action, 3000));

    act(() => {
      result.current.onClick();
    });
    expect(result.current.armed).toBe(true);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.armed).toBe(false);
    expect(action).not.toHaveBeenCalled();

    // A click after the timeout arms again instead of running the action.
    act(() => {
      result.current.onClick();
    });
    expect(result.current.armed).toBe(true);
    expect(action).not.toHaveBeenCalled();
  });

  it("clears the pending timer on unmount", () => {
    vi.useFakeTimers();
    const action = vi.fn();
    const { result, unmount } = renderHook(() => useConfirmClick(action, 3000));

    act(() => {
      result.current.onClick();
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(action).not.toHaveBeenCalled();
  });
});
