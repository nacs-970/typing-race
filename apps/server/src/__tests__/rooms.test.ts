/**
 * Room Manager tests — Phase 2 Plan 02 tracer.
 *
 * 8 unit tests:
 *  1. createRoom produces a 6-char regex-valid code in rooms Map
 *  2. 10 sequential createRoom calls produce 10 distinct codes
 *  3. addPlayer with unknown code returns ROOM_NOT_FOUND
 *  4. 9th player to a full room returns ROOM_FULL
 *  5. removePlayer decrements player count and broadcasts player_left
 *  6. Removing the last player deletes the room
 *  7. When host leaves, next-joined player is promoted
 *  8. MAX_PLAYERS_PER_ROOM === 8 (constant lock)
 */
import { describe, test, expect, beforeEach } from "bun:test";
import {
  rooms,
  createRoom,
  addPlayer,
  removePlayer,
  MAX_PLAYERS_PER_ROOM,
} from "../rooms/manager.ts";
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

/** Cast helper — Bun's ServerWebSocket has 16 methods, we only need `data` + `send`. */
function asWs(fake: FakeWs): import("bun").ServerWebSocket<WsData> {
  return fake as unknown as import("bun").ServerWebSocket<WsData>;
}

beforeEach(() => {
  rooms.clear();
});

describe("createRoom", () => {
  test("1. produces 6-char regex-valid code in rooms Map", () => {
    const ws = fakeWs("h1");
    const { code, room } = createRoom(asWs(ws), "Alice");
    expect(code).toHaveLength(6);
    expect(/^[A-HJ-NP-Z2-9]{6}$/.test(code)).toBe(true);
    expect(rooms.get(code)).toBe(room);
    expect(room.state).toBe("lobby");
    expect(room.players.size).toBe(1);
  });

  test("2. 10 sequential createRoom calls produce 10 distinct codes", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const ws = fakeWs(`h${i}`);
      const { code } = createRoom(asWs(ws), `Host${i}`);
      codes.add(code);
    }
    expect(codes.size).toBe(10);
  });
});

describe("addPlayer", () => {
  test("3. unknown code returns ROOM_NOT_FOUND", () => {
    const ws = fakeWs("p1");
    const result = addPlayer("XXXXXX", "p1", "Bob", asWs(ws));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("ROOM_NOT_FOUND");
  });

  test("4. 9th player to full room returns ROOM_FULL", () => {
    const hostWs = fakeWs("h");
    const { code } = createRoom(asWs(hostWs), "Host");
    for (let i = 0; i < 7; i++) {
      const ws = fakeWs(`p${i}`);
      const r = addPlayer(code, `p${i}`, `P${i}`, asWs(ws));
      expect(r.ok).toBe(true);
    }
    const ninth = addPlayer(code, "p8", "P8", asWs(fakeWs("p8")));
    expect(ninth.ok).toBe(false);
    if (!ninth.ok) expect(ninth.code).toBe("ROOM_FULL");
  });
});

describe("removePlayer", () => {
  test("5. decrements player count + broadcasts player_left", () => {
    const h = fakeWs("h");
    const { code, room: room0 } = createRoom(asWs(h), "Host");
    const guestWs = fakeWs("g");
    addPlayer(code, "g", "Guest", asWs(guestWs));
    expect(room0.players.size).toBe(2);

    removePlayer(code, "g");

    expect(room0.players.size).toBe(1);
    // host should have received lobby_state with just [host]
    // plus player_left frame for g
    const sawPlayerLeft = h.sent.some((s) =>
      s.includes('"type":"player_left"') && s.includes('"playerId":"g"'),
    );
    expect(sawPlayerLeft).toBe(true);
  });

  test("6. removing the last player deletes the room", () => {
    const h = fakeWs("h");
    const { code, room } = createRoom(asWs(h), "Host");
    removePlayer(code, "h");
    expect(rooms.has(code)).toBe(false);
    expect(room.players.size).toBe(0);
  });

  test("7. when host leaves, next-joined player is promoted", () => {
    const h = fakeWs("h");
    const { code, room } = createRoom(asWs(h), "Host");
    const g1 = fakeWs("g1");
    addPlayer(code, "g1", "G1", asWs(g1));
    const g2 = fakeWs("g2");
    addPlayer(code, "g2", "G2", asWs(g2));

    removePlayer(code, "h");

    expect(room.hostId).not.toBe("h");
    // Next-joined (g1) is now host
    expect(room.players.get("g1")?.isHost).toBe(true);
    expect(room.players.get("g2")?.isHost).toBe(false);
  });

  test("8. MAX_PLAYERS_PER_ROOM === 8 (constant lock)", () => {
    expect(MAX_PLAYERS_PER_ROOM).toBe(8);
  });
});