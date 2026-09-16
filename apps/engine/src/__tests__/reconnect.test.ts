import { describe, test, expect, beforeEach } from "bun:test";
import { RoomManager } from "../rooms/manager.ts";
import { InMemoryRoomStore } from "../rooms/store.ts";
import { InMemoryEventBridge, type EngineToGatewayEvent } from "@typing-race/shared/bridge";

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

describe("sessionToken & reconnect handshake", () => {
  test("1. addPlayer generates valid UUID v4 sessionToken", async () => {
    const { code } = await manager.createRoom("h1", "Host");
    const result = await manager.addPlayer(code, "p2", "Guest");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.player.sessionToken).toBeDefined();
    expect(UUID_V4_REGEX.test(result.player.sessionToken)).toBe(true);
  });

  test("2. findPlayerBySessionToken finds player by token, returns null if invalid", async () => {
    const { code } = await manager.createRoom("h1", "Host");
    const res = await manager.addPlayer(code, "p2", "Guest");
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const found = await manager.findPlayerBySessionToken(code, res.player.sessionToken);
    expect(found).not.toBeNull();
    expect(found?.playerId).toBe("p2");

    const invalid = await manager.findPlayerBySessionToken(code, "wrong-token");
    expect(invalid).toBeNull();
  });

  test("3. rejoinPlayer updates player state and emits rejoined_room and player_reconnected", async () => {
    const { code, room } = await manager.createRoom("h1", "Host");
    const res = await manager.addPlayer(code, "p2", "Guest");
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    await manager.handlePlayerDisconnect("p2", code, 1000);
    expect(room.players.get("p2")?.disconnectedAt).toBe(1000);

    const ok = await manager.rejoinPlayer(code, res.player.sessionToken, "p2-new-socket", 2000);
    expect(ok).toBe(true);

    const player = room.players.get("p2-new-socket");
    expect(player).toBeDefined();
    expect(player?.disconnectedAt).toBeNull();
    expect(player?.reconnectedAt).toBe(2000);

    const sawRejoined = gatewayEvents.some(
      (e) => e.type === "send_to_client" && e.payload.type === "rejoined_room",
    );
    expect(sawRejoined).toBe(true);

    const sawReconnected = gatewayEvents.some(
      (e) => e.type === "broadcast_to_room" && e.payload.type === "player_reconnected",
    );
    expect(sawReconnected).toBe(true);
  });

  test("4. rejoinPlayer on a genuinely new playerId (multi-tab takeover) notifies and evicts the old socket", async () => {
    const { code } = await manager.createRoom("h1", "Host");
    const res = await manager.addPlayer(code, "p2", "Guest");
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const ok = await manager.rejoinPlayer(code, res.player.sessionToken, "p2-new-tab", 2000);
    expect(ok).toBe(true);

    const sessionTakenOverEvents = gatewayEvents.filter(
      (e) =>
        e.type === "send_to_client" &&
        e.playerId === "p2" &&
        e.payload.type === "session_taken_over",
    );
    expect(sessionTakenOverEvents.length).toBe(1);

    const disconnectEvents = gatewayEvents.filter(
      (e) =>
        e.type === "disconnect_client" &&
        e.playerId === "p2" &&
        e.code === 1000 &&
        e.reason === "Session taken over by another tab",
    );
    expect(disconnectEvents.length).toBe(1);
  });

  test("5. rejoinPlayer on the same still-open connection (duplicate/retried rejoin_room) does not notify or evict", async () => {
    const { code } = await manager.createRoom("h1", "Host");
    const res = await manager.addPlayer(code, "p2", "Guest");
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const ok = await manager.rejoinPlayer(code, res.player.sessionToken, "p2", 2000);
    expect(ok).toBe(true);

    const sessionTakenOverEvents = gatewayEvents.filter(
      (e) => e.type === "send_to_client" && e.payload.type === "session_taken_over",
    );
    expect(sessionTakenOverEvents.length).toBe(0);

    const disconnectEvents = gatewayEvents.filter(
      (e) => e.type === "disconnect_client" && e.playerId === "p2",
    );
    expect(disconnectEvents.length).toBe(0);

    const sawRejoined = gatewayEvents.some(
      (e) => e.type === "send_to_client" && e.payload.type === "rejoined_room",
    );
    expect(sawRejoined).toBe(true);

    const sawReconnected = gatewayEvents.some(
      (e) => e.type === "broadcast_to_room" && e.payload.type === "player_reconnected",
    );
    expect(sawReconnected).toBe(true);
  });
});
