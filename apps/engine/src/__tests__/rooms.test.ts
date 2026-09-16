import { describe, test, expect, beforeEach } from "bun:test";
import { RoomManager, MAX_PLAYERS_PER_ROOM } from "../rooms/manager.ts";
import { InMemoryRoomStore } from "../rooms/store.ts";
import { InMemoryEventBridge, type EngineToGatewayEvent } from "@typing-race/shared/bridge";

let store: InMemoryRoomStore;
let bridge: InMemoryEventBridge;
let manager: RoomManager;
let gatewayEvents: EngineToGatewayEvent[];

beforeEach(() => {
  store = new InMemoryRoomStore();
  bridge = new InMemoryEventBridge();
  manager = new RoomManager(store, bridge);
  gatewayEvents = [];
  bridge.onGatewayEvent((e) => {
    gatewayEvents.push(e);
  });
});

describe("createRoom", () => {
  test("1. produces 6-char regex-valid code in rooms store", async () => {
    const { code, room } = await manager.createRoom("h1", "Alice");
    expect(code).toHaveLength(6);
    expect(/^[A-HJ-NP-Z2-9]{6}$/.test(code)).toBe(true);
    expect(await store.get(code)).toBe(room);
    expect(room.state).toBe("lobby");
    expect(room.players.size).toBe(1);
    expect(gatewayEvents.some((e) => e.type === "player_room_assigned")).toBe(true);
  });

  test("2. 10 sequential createRoom calls produce 10 distinct codes", async () => {
    const codes = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const { code } = await manager.createRoom(`h${i}`, `Host${i}`);
      codes.add(code);
    }
    expect(codes.size).toBe(10);
  });
});

describe("addPlayer", () => {
  test("3. unknown code returns ROOM_NOT_FOUND", async () => {
    const result = await manager.addPlayer("XXXXXX", "p1", "Bob");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("ROOM_NOT_FOUND");
  });

  test("4. 9th player to full room returns ROOM_FULL", async () => {
    const { code } = await manager.createRoom("h", "Host");
    for (let i = 0; i < 7; i++) {
      const r = await manager.addPlayer(code, `p${i}`, `P${i}`);
      expect(r.ok).toBe(true);
    }
    const ninth = await manager.addPlayer(code, "p8", "P8");
    expect(ninth.ok).toBe(false);
    if (!ninth.ok) expect(ninth.code).toBe("ROOM_FULL");
  });
});

describe("removePlayer", () => {
  test("5. decrements player count + broadcasts player_left", async () => {
    const { code, room } = await manager.createRoom("h", "Host");
    await manager.addPlayer(code, "g", "Guest");
    expect(room.players.size).toBe(2);

    await manager.removePlayer(code, "g");
    expect(room.players.size).toBe(1);

    const sawPlayerLeft = gatewayEvents.some(
      (e) => e.type === "broadcast_to_room" && e.payload.type === "player_left" && e.payload.playerId === "g",
    );
    expect(sawPlayerLeft).toBe(true);
  });

  test("6. removing the last player deletes the room", async () => {
    const { code } = await manager.createRoom("h", "Host");
    expect(await store.has(code)).toBe(true);

    await manager.removePlayer(code, "h");
    expect(await store.has(code)).toBe(false);
  });

  test("9. removing the second-to-last player proactively broadcasts ROOM_CLOSED to notify the one remaining player", async () => {
    // Fires at size===1, not size===0: whoever's departure drops a room to
    // zero is, by construction, the room's own last socket (ClientManager
    // tracks room.players 1:1) — nobody is ever still registered to receive
    // a broadcast at that instant. One player earlier, a real recipient
    // (the remaining player) exists.
    const { code } = await manager.createRoom("h", "Host");
    await manager.addPlayer(code, "g", "Guest");
    gatewayEvents = [];

    await manager.removePlayer(code, "g");

    const sawRoomClosed = gatewayEvents.some(
      (e) => e.type === "broadcast_to_room" && e.roomCode === code && e.payload.type === "error" && e.payload.code === "ROOM_CLOSED",
    );
    expect(sawRoomClosed).toBe(true);
  });

  test("9b. removing the last remaining player does not re-broadcast ROOM_CLOSED (no recipient left)", async () => {
    const { code } = await manager.createRoom("h", "Host");
    await manager.addPlayer(code, "g", "Guest");
    await manager.removePlayer(code, "g");
    gatewayEvents = [];

    await manager.removePlayer(code, "h");

    const sawRoomClosed = gatewayEvents.some(
      (e) => e.type === "broadcast_to_room" && e.payload.type === "error" && e.payload.code === "ROOM_CLOSED",
    );
    expect(sawRoomClosed).toBe(false);
    expect(await store.has(code)).toBe(false);
  });

  test("7. when host leaves, next-joined player is promoted", async () => {
    const { code, room } = await manager.createRoom("h", "Host");
    await manager.addPlayer(code, "g1", "Guest1");
    await manager.addPlayer(code, "g2", "Guest2");

    await manager.removePlayer(code, "h");

    expect(room.players.size).toBe(2);
    expect(room.hostId).toBe("g1");
    expect(room.players.get("g1")?.isHost).toBe(true);
  });

  test("8. MAX_PLAYERS_PER_ROOM === 8", () => {
    expect(MAX_PLAYERS_PER_ROOM).toBe(8);
  });
});
