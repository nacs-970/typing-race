import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, act, fireEvent } from "@testing-library/react";
import { clearToasts } from "../store/toast.ts";
import type { ServerToClient } from "@typing-race/shared";

/**
 * Minimal WebSocket stub so importing `../net/ws.ts` (which constructs a
 * singleton RaceClient and calls `.connect()` at module load) never touches
 * a real socket. Mirrors the MockWebSocket used in race-client.test.ts.
 */
class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  listeners: Record<string, Array<(ev: unknown) => void>> = {};

  constructor(url: string) {
    this.url = url;
  }

  addEventListener(event: string, fn: (ev: unknown) => void): void {
    (this.listeners[event] ??= []).push(fn);
  }

  removeEventListener(event: string, fn: (ev: unknown) => void): void {
    this.listeners[event] = (this.listeners[event] ?? []).filter((l) => l !== fn);
  }

  send(): void {
    // no-op — tests drive frames via ws.dispatch(), not real socket traffic
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
  }
}

vi.stubGlobal("WebSocket", MockWebSocket);

/**
 * App.tsx reads `localStorage.getItem("typing_race_nickname")` in its
 * nickname useState initializer. This test's happy-dom environment does not
 * expose a bare global `localStorage` (only `window.localStorage`), so stub
 * a minimal in-memory implementation — this is a test-harness concern, not
 * a change to App.tsx's behavior.
 */
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}
vi.stubGlobal("localStorage", new MemoryStorage());

/**
 * App.tsx also fires a real `syncClock()` (fetch to /api/clock-sync) on
 * mount, unrelated to the SERVER_SHUTTING_DOWN toast under test. Stub fetch
 * to fail fast (App.tsx already catches and warns on sync failure) instead
 * of letting the test process attempt a real network connection.
 */
vi.stubGlobal(
  "fetch",
  vi.fn(() => Promise.reject(new Error("network disabled in test"))),
);

afterEach(() => {
  cleanup();
  clearToasts();
});

describe("App — SERVER_SHUTTING_DOWN error frame", () => {
  it("renders a distinct 'Server Restarting' toast instead of the generic error fallback", async () => {
    // Dynamic import: App.tsx statically imports the `ws` singleton from
    // ../net/ws.ts, whose module body calls `ws.connect()` (constructing a
    // real `new WebSocket(...)`) at import time. The global WebSocket stub
    // above must be in place before that module evaluates, so the import
    // must happen after `vi.stubGlobal`, not be hoisted above it.
    const { App } = await import("../App.tsx");
    const { ws } = await import("../net/ws.ts");

    const { getByText, queryByText } = render(<App />);

    act(() => {
      ws.dispatch({
        type: "error",
        code: "SERVER_SHUTTING_DOWN",
        message: "server is shutting down",
      } satisfies ServerToClient);
    });

    expect(getByText("Server Restarting")).toBeDefined();
    expect(
      getByText(
        "The server is restarting for maintenance. Please wait a moment and try rejoining.",
      ),
    ).toBeDefined();

    // The generic fallback title must NOT be used for this code.
    expect(queryByText("Error")).toBeNull();
  });
});

describe("App — player_disconnected notice", () => {
  it("can be dismissed with its close button", async () => {
    const { App } = await import("../App.tsx");
    const { ws } = await import("../net/ws.ts");

    const { container, getByLabelText } = render(<App />);

    act(() => {
      ws.dispatch({
        type: "player_disconnected",
        playerId: "3f1c2b9e-8a4d-4c6e-9b1a-2d7e5f0c8a11",
        nickname: "Hi",
        timeoutMs: 60000,
      } satisfies ServerToClient);
    });

    expect(container.querySelectorAll(".toast-disconnect").length).toBe(1);

    fireEvent.click(getByLabelText("Dismiss disconnect notice for Hi"));

    expect(container.querySelectorAll(".toast-disconnect").length).toBe(0);
  });
});

describe("App — landing: invite-link prefill", () => {
  afterEach(() => {
    window.location.hash = "";
    document.cookie = "typing_race_K7QX2M=; path=/; max-age=0; SameSite=Lax";
  });

  it("prefills the room code from the URL hash when there is no session cookie", async () => {
    document.cookie = "typing_race_K7QX2M=; path=/; max-age=0; SameSite=Lax";
    window.location.hash = "#K7QX2M";

    const { App } = await import("../App.tsx");
    const { container } = render(<App />);

    const input = container.querySelector("#room-code-input") as HTMLInputElement;
    expect(input.value).toBe("K7QX2M");
  });

  it("leaves the room code field empty when a session cookie exists for the hash", async () => {
    document.cookie = "typing_race_K7QX2M=some-token; path=/; SameSite=Lax";
    window.location.hash = "#K7QX2M";

    const { App } = await import("../App.tsx");
    const { container } = render(<App />);

    const input = container.querySelector("#room-code-input") as HTMLInputElement;
    expect(input.value).toBe("");
  });
});

describe("App — landing: Enter submits", () => {
  it("pressing Enter in the room-code field sends join_room", async () => {
    const { App } = await import("../App.tsx");
    const { ws } = await import("../net/ws.ts");
    const sendSpy = vi.spyOn(ws, "send");

    const { container } = render(<App />);
    const input = container.querySelector("#room-code-input") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "K7QX2M" } });
    // happy-dom does not implement native "Enter submits the form"
    // (implicit submission); a real browser translates that keypress into
    // a submit event on the input's form, so simulate that directly.
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "join_room", code: "K7QX2M" }),
    );
  });

  it("pressing Enter in the nickname field sends create_room", async () => {
    const { App } = await import("../App.tsx");
    const { ws } = await import("../net/ws.ts");
    const sendSpy = vi.spyOn(ws, "send");

    const { container } = render(<App />);
    const input = container.querySelector("#nickname-input") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "Ann" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "create_room" }),
    );
  });
});
