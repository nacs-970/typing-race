import { describe, test, expect, beforeEach } from "bun:test";
import {
  rooms,
  createRoom,
  addPlayer,
  handlePlayerDisconnect,
} from "../rooms/manager.ts";
import { dispatch } from "../ws/dispatch.ts";
import { tick } from "../race/controller.ts";
import type { WsData } from "../ws/handlers.ts";

type FakeWs = {
  data: WsData;
  send: (data: string) => void;
  sent: string[];
};

function fakeWs(playerId: string): FakeWs {
  const ws: FakeWs = {
    data: {
      playerId,
      roomCode: null,
      nickname: null,
      clientOffsetMs: 0,
      lastPongAt: Date.now(),
    },
    sent: [],
    send(data: string) {
      ws.sent.push(data);
    },
  };
  return ws;
}

function asWs(fake: FakeWs): import("bun").ServerWebSocket<WsData> {
  return fake as unknown as import("bun").ServerWebSocket<WsData>;
}

beforeEach(() => {
  rooms.clear();
});

describe("Phase 4 Plan 04: Disconnect UX, 60s Grace Period & Eviction", () => {
  test("1. handlePlayerDisconnect initiates 60s grace period and broadcasts player_disconnected", () => {
    const wsHost = fakeWs("host-1");
    const { code, room } = createRoom(asWs(wsHost), "Host");

    const wsGuest = fakeWs("guest-1");
    addPlayer(code, "guest-1", "Guest", asWs(wsGuest));

    // Guest socket drops
    handlePlayerDisconnect(code, "guest-1");

    const guestPlayer = room.players.get("guest-1")!;
    expect(guestPlayer.disconnectedAt).not.toBeNull();

    // Host should receive player_disconnected
    const disconnectMsg = wsHost.sent.find((s) => s.includes("player_disconnected"));
    expect(disconnectMsg).toBeDefined();
    const parsed = JSON.parse(disconnectMsg!);
    expect(parsed.playerId).toBe("guest-1");
    expect(parsed.nickname).toBe("Guest");
    expect(parsed.timeoutMs).toBe(60_000);
  });

  test("2. Solo player in lobby is removed immediately on disconnect", () => {
    const wsHost = fakeWs("host-1");
    const { code } = createRoom(asWs(wsHost), "Host");
    expect(rooms.has(code)).toBe(true);

    handlePlayerDisconnect(code, "host-1");
    expect(rooms.has(code)).toBe(false);
  });

  test("3. tick() retains disconnected player before 60s and evicts after 60s", () => {
    const wsHost = fakeWs("host-1");
    const { code, room } = createRoom(asWs(wsHost), "Host");

    const wsGuest = fakeWs("guest-1");
    addPlayer(code, "guest-1", "Guest", asWs(wsGuest));

    const disconnectTime = 100_000;
    const guestPlayer = room.players.get("guest-1")!;
    guestPlayer.disconnectedAt = disconnectTime;

    // At t = 130s (30s elapsed): should NOT be evicted
    tick(disconnectTime + 30_000);
    expect(room.players.has("guest-1")).toBe(true);

    // At t = 160s (60s elapsed): should be evicted
    tick(disconnectTime + 60_000);
    expect(room.players.has("guest-1")).toBe(false);

    // Host should have received player_left
    const leftMsg = wsHost.sent.find((s) => s.includes("player_left"));
    expect(leftMsg).toBeDefined();
  });

  test("4. If host disconnects and is evicted, host is migrated to next player", () => {
    const wsHost = fakeWs("host-1");
    const { code, room } = createRoom(asWs(wsHost), "Host");

    const wsGuest = fakeWs("guest-1");
    addPlayer(code, "guest-1", "Guest", asWs(wsGuest));

    const hostPlayer = room.players.get("host-1")!;
    const disconnectTime = 100_000;
    hostPlayer.disconnectedAt = disconnectTime;

    // After 60s, host is evicted
    tick(disconnectTime + 60_000);
    expect(room.players.has("host-1")).toBe(false);
    expect(room.hostId).toBe("guest-1");

    const guestPlayer = room.players.get("guest-1")!;
    expect(guestPlayer.isHost).toBe(true);
  });

  test("5. Rejoining clears disconnectedAt and broadcasts player_reconnected", () => {
    const wsHost = fakeWs("host-1");
    const { code, room } = createRoom(asWs(wsHost), "Host");

    const wsGuest = fakeWs("guest-1");
    addPlayer(code, "guest-1", "Guest", asWs(wsGuest));
    const guestPlayer = room.players.get("guest-1")!;
    const guestToken = guestPlayer.sessionToken;

    // Socket disconnects
    handlePlayerDisconnect(code, "guest-1");
    expect(guestPlayer.disconnectedAt).not.toBeNull();

    // Guest reconnects
    const wsGuestNew = fakeWs("guest-new");
    dispatch(
      asWs(wsGuestNew),
      JSON.stringify({
        type: "rejoin_room",
        roomCode: code,
        sessionToken: guestToken,
      }),
    );

    expect(guestPlayer.disconnectedAt).toBeNull();

    // Host should receive player_reconnected
    const reconnectedMsg = wsHost.sent.find((s) => s.includes("player_reconnected"));
    expect(reconnectedMsg).toBeDefined();
    const parsed = JSON.parse(reconnectedMsg!);
    expect(parsed.playerId).toBe("guest-1");
    expect(parsed.nickname).toBe("Guest");
  });
});
