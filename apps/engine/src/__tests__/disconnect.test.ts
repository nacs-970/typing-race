import { describe, test, expect, beforeEach } from "bun:test";
import { RoomManager } from "../rooms/manager.ts";
import { RaceController } from "../race/controller.ts";
import { InMemoryRoomStore } from "../rooms/store.ts";
import { InMemoryEventBridge, type EngineToGatewayEvent } from "@typing-race/shared/bridge";

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

describe("Disconnect UX, 60s Grace Period & Eviction", () => {
  test("1. handlePlayerDisconnect initiates 60s grace period and broadcasts player_disconnected", async () => {
    const { code, room } = await manager.createRoom("h1", "Host");
    await manager.addPlayer(code, "g1", "Guest");

    await manager.handlePlayerDisconnect("g1", code, 1000);

    const guest = room.players.get("g1");
    expect(guest?.disconnectedAt).toBe(1000);

    const sawDisconnect = gatewayEvents.some(
      (e) =>
        e.type === "broadcast_to_room" &&
        e.payload.type === "player_disconnected" &&
        e.payload.playerId === "g1" &&
        e.payload.timeoutMs === 60_000,
    );
    expect(sawDisconnect).toBe(true);
  });

  test("2. tick() does NOT evict player before 60s expires", async () => {
    const { code, room } = await manager.createRoom("h1", "Host");
    await manager.addPlayer(code, "g1", "Guest");

    await manager.handlePlayerDisconnect("g1", code, 10_000);

    // 59 seconds later
    await controller.tick(69_000);

    const updated = await store.get(code);
    expect(updated?.players.has("g1")).toBe(true);
  });

  test("3. tick() evicts player after 60s expires, promotes guest or deletes empty room", async () => {
    const { code, room } = await manager.createRoom("h1", "Host");
    await manager.addPlayer(code, "g1", "Guest");

    await manager.handlePlayerDisconnect("g1", code, 10_000);

    // 60 seconds later
    await controller.tick(70_000);

    const updated = await store.get(code);
    expect(updated?.players.has("g1")).toBe(false);
    expect(updated?.players.size).toBe(1);

    // Now host disconnects and timer expires
    await manager.handlePlayerDisconnect("h1", code, 75_000);
    await controller.tick(135_000);

    expect(await store.has(code)).toBe(false);
  });
});
