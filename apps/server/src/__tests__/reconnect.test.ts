import { describe, test, expect, beforeEach } from "bun:test";
import {
  rooms,
  createRoom,
  addPlayer,
  findPlayerBySessionToken,
  rebindPlayerSocket,
  getRoom,
} from "../rooms/manager.ts";
import { dispatch } from "../ws/dispatch.ts";
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

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

beforeEach(() => {
  rooms.clear();
});

describe("Phase 4 Plan 01: sessionToken & reconnect handshake", () => {
  test("1. addPlayer generates valid UUID v4 sessionToken", () => {
    const ws = fakeWs("p1");
    const { code } = createRoom(asWs(ws), "Host");
    const ws2 = fakeWs("p2");
    const result = addPlayer(code, "p2", "Guest", asWs(ws2));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.player.sessionToken).toBeDefined();
    expect(UUID_V4_REGEX.test(result.player.sessionToken)).toBe(true);
    expect(ws2.data.sessionToken).toBe(result.player.sessionToken);
  });

  test("2. findPlayerBySessionToken finds player by token, returns null if invalid", () => {
    const ws = fakeWs("p1");
    const { code } = createRoom(asWs(ws), "Host");
    const ws2 = fakeWs("p2");
    const res = addPlayer(code, "p2", "Guest", asWs(ws2));
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const found = findPlayerBySessionToken(code, res.player.sessionToken);
    expect(found).not.toBeNull();
    expect(found?.playerId).toBe("p2");

    const notFound = findPlayerBySessionToken(code, crypto.randomUUID());
    expect(notFound).toBeNull();

    const badRoom = findPlayerBySessionToken("XXXXXX", res.player.sessionToken);
    expect(badRoom).toBeNull();
  });

  test("3. rebindPlayerSocket re-binds WebSocket reference and WsData", () => {
    const ws1 = fakeWs("p1");
    const { code, room } = createRoom(asWs(ws1), "Host");
    const hostPlayer = room.players.get("p1")!;
    expect(hostPlayer.wsRef).toBe(asWs(ws1));

    const newWs = fakeWs("fresh-connection");
    rebindPlayerSocket(room, hostPlayer, asWs(newWs));

    expect(hostPlayer.wsRef).toBe(asWs(newWs));
    expect(newWs.data.playerId).toBe("p1");
    expect(newWs.data.roomCode).toBe(code);
    expect(newWs.data.nickname).toBe("Host");
    expect(newWs.data.sessionToken).toBe(hostPlayer.sessionToken);
  });

  test("4. dispatch rejoin_room successfully re-binds socket and returns joined_room", () => {
    const ws1 = fakeWs("p1");
    const { code, room } = createRoom(asWs(ws1), "Host");
    const hostPlayer = room.players.get("p1")!;
    const token = hostPlayer.sessionToken;

    // Simulate new tab opening
    const wsNew = fakeWs("temp-id");
    dispatch(
      asWs(wsNew),
      JSON.stringify({
        type: "rejoin_room",
        roomCode: code,
        sessionToken: token,
      }),
    );

    expect(hostPlayer.wsRef).toBe(asWs(wsNew));
    expect(wsNew.sent.length).toBeGreaterThan(0);
    const lastMsg = JSON.parse(wsNew.sent[wsNew.sent.length - 1]);
    expect(lastMsg.type).toBe("joined_room");
    expect(lastMsg.sessionToken).toBe(token);
    expect(lastMsg.playerId).toBe("p1");
  });

  test("5. dispatch rejoin_room rejects invalid sessionToken with SESSION_INVALID", () => {
    const ws1 = fakeWs("p1");
    const { code } = createRoom(asWs(ws1), "Host");

    const wsNew = fakeWs("temp-id");
    dispatch(
      asWs(wsNew),
      JSON.stringify({
        type: "rejoin_room",
        roomCode: code,
        sessionToken: crypto.randomUUID(),
      }),
    );

    expect(wsNew.sent.length).toBe(1);
    const err = JSON.parse(wsNew.sent[0]);
    expect(err.type).toBe("error");
    expect(err.code).toBe("SESSION_INVALID");
  });

  test("6. dispatch rejoin_room rejects unknown room with ROOM_NOT_FOUND", () => {
    const wsNew = fakeWs("temp-id");
    dispatch(
      asWs(wsNew),
      JSON.stringify({
        type: "rejoin_room",
        roomCode: "ABCDEF",
        sessionToken: crypto.randomUUID(),
      }),
    );

    expect(wsNew.sent.length).toBe(1);
    const err = JSON.parse(wsNew.sent[0]);
    expect(err.type).toBe("error");
    expect(err.code).toBe("ROOM_NOT_FOUND");
  });
});
