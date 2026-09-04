import { describe, test, expect, beforeEach } from "bun:test";
import { RaceController } from "../race/controller.ts";
import { RoomManager } from "../rooms/manager.ts";
import { InMemoryRoomStore } from "../rooms/store.ts";
import { InMemoryEventBridge, type EngineToGatewayEvent } from "@typing-race/shared/bridge";
import type { Room, Player } from "../race/types.ts";

function createPlayer(id: string, nickname: string, isHost = false): Player {
  return {
    playerId: id,
    sessionToken: "token-" + id,
    nickname,
    isHost,
    progress: 0,
    lastKeystrokeAt: 0,
    lastCursorAtMs: 0,
    clientOffsetMs: 0,
    joinedAt: 0,
    charStates: [],
    totalKeystrokes: 0,
    uncorrectedErrors: 0,
    currentWpm: 0,
    finishedAtServerMs: null,
    disconnectedAt: null,
    reconnectedAt: null,
  };
}

let store: InMemoryRoomStore;
let bridge: InMemoryEventBridge;
let manager: RoomManager;
let controller: RaceController;
let gatewayEvents: EngineToGatewayEvent[];

beforeEach(() => {
  store = new InMemoryRoomStore();
  bridge = new InMemoryEventBridge();
  manager = new RoomManager(store, bridge);
  controller = new RaceController(store, bridge, manager);
  gatewayEvents = [];
  bridge.onGatewayEvent((e) => {
    gatewayEvents.push(e);
  });
});

describe("race-end detection", () => {
  test("1. tick() detects first finisher in racing → transitions to grace, broadcasts grace_countdown", async () => {
    const room: Room = {
      code: "ABC123",
      hostId: "p1",
      state: "racing",
      passageId: "pass-1",
      passageText: "hi",
      startsAtServerMs: 1000,
      players: new Map([
        ["p1", createPlayer("p1", "Alice", true)],
        ["p2", createPlayer("p2", "Bob", false)],
      ]),
      createdAt: 1000,
      lastActivityAt: 1000,
      graceSeconds: 5,
      hostPickedPassagePreview: null,
      lastPassageId: null,
      usedPassageIds: new Set(),
      deckOrder: [],
      deckCursor: 0,
      firstFinisherId: null,
      graceEndsAtServerMs: null,
    };

    // p1 finished, p2 still typing
    room.players.get("p1")!.finishedAtServerMs = 2000;
    await store.set(room.code, room);

    await controller.tick(2500);

    const updated = await store.get(room.code);
    expect(updated?.state).toBe("grace");
    expect(updated?.firstFinisherId).toBe("p1");
    expect(updated?.graceEndsAtServerMs).toBe(2500 + 5000);

    const sawGraceCountdown = gatewayEvents.some(
      (e) => e.type === "broadcast_to_room" && e.payload.type === "grace_countdown",
    );
    expect(sawGraceCountdown).toBe(true);
  });

  test("2. all-finished shortcut: racing → finished without grace", async () => {
    const room: Room = {
      code: "ABC123",
      hostId: "p1",
      state: "racing",
      passageId: "pass-1",
      passageText: "hi",
      startsAtServerMs: 1000,
      players: new Map([
        ["p1", createPlayer("p1", "Alice", true)],
        ["p2", createPlayer("p2", "Bob", false)],
      ]),
      createdAt: 1000,
      lastActivityAt: 1000,
      graceSeconds: 5,
      hostPickedPassagePreview: null,
      lastPassageId: null,
      usedPassageIds: new Set(),
      deckOrder: [],
      deckCursor: 0,
      firstFinisherId: null,
      graceEndsAtServerMs: null,
    };

    // Both finished
    room.players.get("p1")!.finishedAtServerMs = 2000;
    room.players.get("p2")!.finishedAtServerMs = 2100;
    await store.set(room.code, room);

    await controller.tick(2500);

    const updated = await store.get(room.code);
    expect(updated?.state).toBe("finished");

    const raceEndEvent = gatewayEvents.find(
      (e) => e.type === "broadcast_to_room" && e.payload.type === "race_end",
    );
    expect(raceEndEvent).toBeDefined();
    if (raceEndEvent && raceEndEvent.type === "broadcast_to_room" && raceEndEvent.payload.type === "race_end") {
      expect(raceEndEvent.payload.finishedPlayerIds).toEqual(["p1", "p2"]);
      expect(raceEndEvent.payload.results).toHaveLength(2);
    }
  });

  test("3. tick() in grace state expires grace → transitions to finished, broadcasts race_end", async () => {
    const room: Room = {
      code: "ABC123",
      hostId: "p1",
      state: "grace",
      passageId: "pass-1",
      passageText: "hi",
      startsAtServerMs: 1000,
      players: new Map([
        ["p1", createPlayer("p1", "Alice", true)],
        ["p2", createPlayer("p2", "Bob", false)],
      ]),
      createdAt: 1000,
      lastActivityAt: 1000,
      graceSeconds: 5,
      hostPickedPassagePreview: null,
      lastPassageId: null,
      usedPassageIds: new Set(),
      deckOrder: [],
      deckCursor: 0,
      firstFinisherId: "p1",
      graceEndsAtServerMs: 5000,
    };

    room.players.get("p1")!.finishedAtServerMs = 2000;
    // p2 never finished
    await store.set(room.code, room);

    // Tick at 5500 (past graceEndsAtServerMs)
    await controller.tick(5500);

    const updated = await store.get(room.code);
    expect(updated?.state).toBe("finished");

    const sawRaceEnd = gatewayEvents.some(
      (e) => e.type === "broadcast_to_room" && e.payload.type === "race_end",
    );
    expect(sawRaceEnd).toBe(true);
  });
});
