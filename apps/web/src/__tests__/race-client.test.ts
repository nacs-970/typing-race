import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  RaceClient,
  getSessionCookie,
  setSessionCookie,
  clearSessionCookie,
} from "../net/race-client";
import { useConnectionStore } from "../store/connection";
import { useCursorStore } from "../store/cursor";
import { useRaceStore } from "../store/race";
import { useClockStore } from "../store/clock";

class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  listeners: Record<string, Function[]> = {};
  sent: string[] = [];

  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.emit("open", {});
    }, 0);
  }

  addEventListener(event: string, fn: Function): void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }

  removeEventListener(event: string, fn: Function): void {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter((l) => l !== fn);
    }
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.emit("close", {});
  }

  emit(event: string, data: any): void {
    if (this.listeners[event]) {
      for (const listener of this.listeners[event]) {
        listener(data);
      }
    }
  }
}

describe("RaceClient", () => {
  let originalWebSocket: any;

  beforeEach(() => {
    originalWebSocket = globalThis.WebSocket;
    (globalThis as any).WebSocket = MockWebSocket;
    useConnectionStore.setState({ playerId: "p-local", status: "closed", serverTs: 0 });
    useCursorStore.setState({ ownIndex: 0, cursors: new Map() });
    useRaceStore.setState({
      ownCharStates: [],
      ownWpm: 0,
      opponentWpm: {},
      graceBanner: null,
      raceEndResults: null,
      passageText: null,
      countdownStartsAtServerMs: null,
      hostPickedPassagePreview: null,
      hostGraceSeconds: 5,
    });
  });

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
  });

  it("handles cookie get, set, clear operations", () => {
    const roomCode = "ABCDEF";
    const token = "11111111-1111-4111-8111-111111111111";

    setSessionCookie(roomCode, token);
    expect(getSessionCookie(roomCode)).toBe(token);

    clearSessionCookie(roomCode);
    expect(getSessionCookie(roomCode)).toBeNull();
  });

  it("connects and sets connection store status", async () => {
    const client = new RaceClient("ws://test/ws");
    client.connect();

    expect(useConnectionStore.getState().status).toBe("connecting");

    await new Promise((r) => setTimeout(r, 10));
    expect(useConnectionStore.getState().status).toBe("open");

    client.disconnect();
    expect(useConnectionStore.getState().status).toBe("closed");
  });

  it("dispatches joined_room message to connection, clock and race stores", () => {
    const client = new RaceClient("ws://test/ws");

    client.dispatch({
      type: "joined_room",
      playerId: "p-local",
      roomCode: "XYZ123",
      clockOffsetMs: 42,
      hostPickedPassagePreview: "Short preview...",
      sessionToken: "22222222-2222-4222-8222-222222222222",
      you: { nickname: "LocalPlayer", isHost: true },
      players: [
        {
          playerId: "p-local",
          nickname: "LocalPlayer",
          isHost: true,
          progress: 0,
        },
      ],
    });

    expect(useConnectionStore.getState().playerId).toBe("p-local");
    expect(useClockStore.getState().offsetMs).toBe(42);
    expect(useRaceStore.getState().hostPickedPassagePreview).toBe("Short preview...");
    expect(getSessionCookie("XYZ123")).toBe("22222222-2222-4222-8222-222222222222");

    clearSessionCookie("XYZ123");
  });

  it("dispatches cursor_update for local player and opponent", () => {
    const client = new RaceClient("ws://test/ws");

    // Local player cursor update
    client.dispatch({
      type: "cursor_update",
      playerId: "p-local",
      index: 3,
      serverTs: 1000,
      charStates: ["correct", "correct", "error"],
      wpm: 65,
      words: [{ start: 0, end: 3, correct: false }],
    });

    expect(useCursorStore.getState().ownIndex).toBe(3);
    expect(useRaceStore.getState().ownWpm).toBe(65);
    expect(useRaceStore.getState().ownCharStates).toEqual(["correct", "correct", "error"]);
    expect(useRaceStore.getState().ownWords).toEqual([{ start: 0, end: 3, correct: false }]);

    // Opponent cursor update
    client.dispatch({
      type: "cursor_update",
      playerId: "p-opp",
      index: 5,
      serverTs: 1020,
      wpm: 72,
    });

    const oppCursor = useCursorStore.getState().cursors.get("p-opp");
    expect(oppCursor).toBeDefined();
    expect(oppCursor?.index).toBe(5);
    expect(useRaceStore.getState().opponentWpm["p-opp"]).toBe(72);
  });

  it("dispatches rejoined_room and populates ownWords", () => {
    const client = new RaceClient("ws://test/ws");

    client.dispatch({
      type: "rejoined_room",
      roomCode: "XYZ123",
      roomState: "racing",
      passageId: "p-1",
      passageText: "hello world",
      startsAtServerMs: 1000,
      graceEndsAtServerMs: null,
      clockOffsetMs: 50,
      you: {
        playerId: "p-local",
        nickname: "Me",
        isHost: true,
        progress: 5,
        charStates: ["correct", "correct", "correct", "correct", "correct"],
        wpm: 60,
        uncorrectedErrors: 0,
        words: [{ start: 0, end: 5, correct: true }],
      },
      players: [],
    });

    expect(useRaceStore.getState().ownWords).toEqual([{ start: 0, end: 5, correct: true }]);
  });

  it("dispatches race_end resetting cursors and populating results", () => {
    const client = new RaceClient("ws://test/ws");

    useCursorStore.setState({
      ownIndex: 10,
      cursors: new Map([["p-opp", { playerId: "p-opp", index: 10, serverTs: 1000 }]]),
    });

    const results = [
      {
        playerId: "p-local",
        nickname: "Me",
        rank: 1,
        finishTimeMs: 15000,
        wpm: 80,
        netWpm: 80,
        rawWpm: 85,
        accuracy: 0.98,
        uncorrectedErrors: 0,
      },
    ];

    client.dispatch({
      type: "race_end",
      reason: "finished",
      finishedPlayerIds: ["11111111-1111-4111-8111-111111111111"],
      results,
    });

    expect(useCursorStore.getState().ownIndex).toBe(0);
    expect(useCursorStore.getState().cursors.size).toBe(0);
    expect(useRaceStore.getState().raceEndResults).toEqual(results);
    expect(useRaceStore.getState().ownCharStates).toEqual([]);
    expect(useRaceStore.getState().ownWpm).toBe(0);
  });

  it("notifies subscribers when frames arrive", () => {
    const client = new RaceClient("ws://test/ws");
    const sub = vi.fn();
    const unsub = client.subscribe(sub);

    const msg = {
      type: "race_start" as const,
      startsAtServerMs: 1000,
      passageId: "11111111-1111-4111-8111-111111111111",
      passageText: "Ready, set, go!",
    };

    client.dispatch(msg);
    expect(sub).toHaveBeenCalledWith(msg);

    unsub();
    client.dispatch(msg);
    expect(sub).toHaveBeenCalledTimes(1);
  });
});
