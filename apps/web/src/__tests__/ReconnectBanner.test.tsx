import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { ReconnectBanner } from "../components/ReconnectBanner";
import { useConnectionStore } from "../store/connection";

describe("ReconnectBanner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useConnectionStore.setState({ status: "connecting", playerId: null, serverTs: null });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders nothing before the connection has ever been open", () => {
    const { queryByTestId } = render(<ReconnectBanner />);
    expect(queryByTestId("reconnect-banner")).toBeNull();
  });

  it("renders nothing while the connection is open", () => {
    act(() => {
      useConnectionStore.setState({ status: "open" });
    });
    const { queryByTestId } = render(<ReconnectBanner />);
    expect(queryByTestId("reconnect-banner")).toBeNull();
  });

  it("shows the reconnecting banner once an open connection drops", () => {
    act(() => {
      useConnectionStore.setState({ status: "open" });
    });
    const { queryByTestId, getByText } = render(<ReconnectBanner />);
    expect(queryByTestId("reconnect-banner")).toBeNull();

    act(() => {
      useConnectionStore.setState({ status: "closed" });
    });

    expect(queryByTestId("reconnect-banner")).not.toBeNull();
    expect(getByText(/Reconnecting\.\.\. \(0s\)/)).toBeDefined();
  });

  it("counts elapsed seconds while reconnecting", () => {
    act(() => {
      useConnectionStore.setState({ status: "open" });
    });
    const { getByText } = render(<ReconnectBanner />);

    act(() => {
      useConnectionStore.setState({ status: "closed" });
    });
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(getByText(/Reconnecting\.\.\. \(3s\)/)).toBeDefined();
  });

  it("hides the banner again once the connection reopens", () => {
    act(() => {
      useConnectionStore.setState({ status: "open" });
    });
    const { queryByTestId } = render(<ReconnectBanner />);

    act(() => {
      useConnectionStore.setState({ status: "closed" });
    });
    expect(queryByTestId("reconnect-banner")).not.toBeNull();

    act(() => {
      useConnectionStore.setState({ status: "open" });
    });
    expect(queryByTestId("reconnect-banner")).toBeNull();
  });

  it("suppresses the banner when sessionTakenOver is true", () => {
    act(() => {
      useConnectionStore.setState({ status: "open" });
    });
    const { queryByTestId, rerender } = render(
      <ReconnectBanner sessionTakenOver={false} />,
    );

    act(() => {
      useConnectionStore.setState({ status: "closed" });
    });
    expect(queryByTestId("reconnect-banner")).not.toBeNull();

    rerender(<ReconnectBanner sessionTakenOver={true} />);
    expect(queryByTestId("reconnect-banner")).toBeNull();
  });
});
