import { describe, test, expect, beforeEach } from "bun:test";
import { transition, RaceController, InvalidTransitionError } from "../race/controller.ts";
import { InMemoryRoomStore } from "../rooms/store.ts";
import { InMemoryEventBridge, type EngineToGatewayEvent } from "@typing-race/shared/bridge";
import { RoomManager } from "../rooms/manager.ts";
import type { Room } from "../race/types.ts";

function fakeRoom(code: string, state: Room["state"], startsAtServerMs: number | null = null): Room {
  return {
    code,
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
    firstFinisherId: null,
    graceEndsAtServerMs: null,
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

describe("transition FSM", () => {
  test("1. lobby → countdown allowed", () => {
    const room = fakeRoom("ROOM1", "lobby");
    transition(room, "countdown");
    expect(room.state).toBe("countdown");
    expect(room.startsAtServerMs).not.toBeNull();
    expect(room.startsAtServerMs!).toBeGreaterThan(Date.now() - 100);
  });

  test("2. lobby → racing forbidden", () => {
    const room = fakeRoom("ROOM2", "lobby");
    expect(() => transition(room, "racing")).toThrow(InvalidTransitionError);
  });

  test("3. countdown → racing allowed + keeps startsAtServerMs", () => {
    const room = fakeRoom("ROOM3", "countdown");
    room.startsAtServerMs = Date.now() + 1000;
    transition(room, "racing");
    expect(room.state).toBe("racing");
    expect(room.startsAtServerMs).not.toBeNull();
  });

  test("6. finished → lobby allowed (rematch)", () => {
    const room = fakeRoom("ROOM4", "finished");
    transition(room, "lobby");
    expect(room.state).toBe("lobby");
  });
});

describe("tick()", () => {
  test("4. transitions countdown → racing when timer expires, broadcasts race_start", async () => {
    const room = fakeRoom("ROOM5", "countdown");
    room.passageId = "p1";
    room.passageText = "hello";
    room.startsAtServerMs = 1000; // past
    await store.set(room.code, room);

    await controller.tick(2000);

    const updated = await store.get(room.code);
    expect(updated?.state).toBe("racing");

    const sawRaceStart = gatewayEvents.some(
      (e) => e.type === "broadcast_to_room" && e.payload.type === "race_start",
    );
    expect(sawRaceStart).toBe(true);
  });

  test("5. tick() does NOT transition lobby or finished rooms", async () => {
    const r1 = fakeRoom("ROOM6", "lobby");
    const r2 = fakeRoom("ROOM7", "finished");
    await store.set(r1.code, r1);
    await store.set(r2.code, r2);

    await controller.tick(2000);

    expect((await store.get(r1.code))?.state).toBe("lobby");
    expect((await store.get(r2.code))?.state).toBe("finished");
  });
});
