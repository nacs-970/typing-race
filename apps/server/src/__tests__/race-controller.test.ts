/**
 * Race Controller FSM tests — Phase 2 Plan 02 tracer.
 *
 * 6 unit tests:
 *  1. transition accepts lobby → countdown
 *  2. transition rejects lobby → racing (forbidden)
 *  3. transition accepts countdown → racing + sets startsAtServerMs
 *  4. tick() transitions countdown → racing when timer expires + broadcasts race_start
 *  5. tick() does NOT transition lobby or finished rooms
 *  6. transition accepts finished → lobby (rematch)
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { transition, tick, InvalidTransitionError } from "../race/controller.ts";
import { rooms } from "../rooms/manager.ts";
import type { Room } from "../race/types.ts";
import type { WsData } from "../ws/handlers.ts";

function fakeRoom(state: Room["state"], startsAtServerMs: number | null = null): Room {
  return {
    code: "ABCDEF",
    hostId: "h",
    state,
    passageId: null,
    passageText: null,
    startsAtServerMs,
    players: new Map(),
    createdAt: 0,
    lastActivityAt: 0,
    graceSeconds: 5,
    hostPickedPassagePreview: null,
    lastPassageId: null,
    usedPassageIds: new Set(),
    deckOrder: [],
    deckCursor: 0,
  };
}

beforeEach(() => {
  rooms.clear();
});

describe("transition FSM", () => {
  test("1. lobby → countdown allowed", () => {
    const room = fakeRoom("lobby");
    transition(room, "countdown");
    expect(room.state).toBe("countdown");
    expect(room.startsAtServerMs).not.toBeNull();
    expect(room.startsAtServerMs!).toBeGreaterThan(Date.now() - 100);
  });

  test("2. lobby → racing forbidden", () => {
    const room = fakeRoom("lobby");
    expect(() => transition(room, "racing")).toThrow(InvalidTransitionError);
  });

  test("3. countdown → racing allowed + keeps startsAtServerMs", () => {
    const room = fakeRoom("countdown");
    room.startsAtServerMs = Date.now() + 1000;
    transition(room, "racing");
    expect(room.state).toBe("racing");
    expect(room.startsAtServerMs).not.toBeNull();
  });

  test("6. finished → lobby allowed (rematch)", () => {
    const room = fakeRoom("finished");
    transition(room, "lobby");
    expect(room.state).toBe("lobby");
  });
});

describe("tick()", () => {
  test("4. transitions countdown → racing when timer expires, broadcasts race_start", () => {
    const sent: string[] = [];
    const fakeWs = {
      data: { playerId: "p", roomCode: null, nickname: null, clientOffsetMs: 0 } satisfies WsData,
      send(d: string) { sent.push(d); },
    };
    const room = fakeRoom("countdown");
    room.players.set("p", {
      playerId: "p",
      nickname: "P",
      isHost: false,
      wsRef: fakeWs as unknown as import("bun").ServerWebSocket<WsData>,
      progress: 0,
      lastKeystrokeAt: 0,
      clientOffsetMs: 0,
      joinedAt: 0,
      charStates: [],
      totalKeystrokes: 0,
      uncorrectedErrors: 0,
      currentWpm: 0,
      finishedAtServerMs: null,
    });
    room.startsAtServerMs = 1000; // already past
    rooms.set(room.code, room);

    tick(2000);

    expect(room.state).toBe("racing");
    expect(sent.some((s) => s.includes('"type":"race_start"'))).toBe(true);
  });

  test("5. does NOT transition lobby or finished rooms", () => {
    const lobby = fakeRoom("lobby");
    const finished = fakeRoom("finished");
    rooms.set(lobby.code, lobby);
    rooms.set(finished.code, finished);

    tick(Date.now());

    expect(lobby.state).toBe("lobby");
    expect(finished.state).toBe("finished");
  });
});