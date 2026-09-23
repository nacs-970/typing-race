import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, cleanup, act } from "@testing-library/react";
import { ToastQueue } from "../components/ToastQueue";
import { useToastStore, addToast, dismissToast, clearToasts } from "../store/toast";

describe("ToastQueue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearToasts();
  });

  afterEach(() => {
    cleanup();
    clearToasts();
    vi.useRealTimers();
  });

  it("renders appended toasts in top-to-bottom order", () => {
    const { container } = render(<ToastQueue />);

    act(() => {
      addToast({ type: "info", title: "First Toast" });
      addToast({ type: "warning", title: "Second Toast" });
    });

    const cards = container.querySelectorAll("[data-toast-id]");
    expect(cards.length).toBe(2);
    expect(cards[0]?.textContent).toContain("First Toast");
    expect(cards[1]?.textContent).toContain("Second Toast");
  });

  it("dismisses a toast when close button is clicked", () => {
    const { container, getByLabelText } = render(<ToastQueue />);

    act(() => {
      addToast({ type: "info", title: "Dismissable Toast" });
    });

    expect(container.querySelectorAll("[data-toast-id]").length).toBe(1);

    const closeBtn = getByLabelText("Dismiss notification");
    fireEvent.click(closeBtn);

    expect(container.querySelectorAll("[data-toast-id]").length).toBe(0);
  });

  it("auto-dismisses toast after durationMs", () => {
    const { container } = render(<ToastQueue />);

    act(() => {
      addToast({ type: "success", title: "Ephemeral Toast", durationMs: 2000 });
    });

    expect(container.querySelectorAll("[data-toast-id]").length).toBe(1);

    act(() => {
      vi.advanceTimersByTime(2100);
    });

    expect(container.querySelectorAll("[data-toast-id]").length).toBe(0);
  });

  it("renders distinct error states matching copywriting contract", () => {
    const { getByText } = render(<ToastQueue />);

    act(() => {
      addToast({
        type: "error",
        title: "Room Lost",
        body: "Room lost — connection expired. Return to lobby or create a new room.",
      });
      addToast({
        type: "warning",
        title: "Server Restart",
        body: "The server is restarting for maintenance. Please wait a moment and try rejoining.",
      });
      addToast({
        type: "error",
        title: "Rate Limit",
        body: "Rate limit reached (max 10 rooms/hr). Wait 15 minutes or join an existing room.",
      });
    });

    expect(
      getByText("Room lost — connection expired. Return to lobby or create a new room."),
    ).toBeDefined();
    expect(
      getByText(
        "The server is restarting for maintenance. Please wait a moment and try rejoining.",
      ),
    ).toBeDefined();
    expect(
      getByText(
        "Rate limit reached (max 10 rooms/hr). Wait 15 minutes or join an existing room.",
      ),
    ).toBeDefined();
  });

  it("pauses auto-dismiss while hovered and restarts it on leave", () => {
    const { container } = render(<ToastQueue />);
    act(() => {
      addToast({ type: "error", title: "Paused Toast", durationMs: 1000 });
    });
    const card = container.querySelector("[data-toast-id]") as HTMLElement;

    fireEvent.mouseEnter(card);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(container.querySelectorAll("[data-toast-id]").length).toBe(1);

    fireEvent.mouseLeave(card);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(container.querySelectorAll("[data-toast-id]").length).toBe(0);
  });
});
