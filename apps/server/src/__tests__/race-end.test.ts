/**
 * Race-end detection tests — Phase 3 Plan 04.
 *
 * 9 tests covering E3, D-08/14/15 + rematch auto-deal:
 *  1. tick() detects first finisher in racing → transitions to grace, broadcasts grace_countdown
 *  2. tick() in grace state expires grace → transitions to finished, broadcasts race_end
 *  3. race_end.results contains all players in arbitrary order
 *  4. race_end.results[].accuracy uses computeAccuracy formula
 *  5. all-finished shortcut: racing → finished without grace
 *  6. grace_countdown.leaderPlayerId === first finisher
 *  7. race_end.finishedPlayerIds still present (backwards compat)
 *  8. validateKeystroke accepts keystroke when state === grace
 *  9. start_race without passageId (rematch) auto-deals from deck
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { tick, transition } from "../race/controller.ts";
import { rooms, createRoom, addPlayer } from "../rooms/manager.ts";
import { dispatch } from "../ws/dispatch.ts";
import type { Room, Player } from "../race/types.ts";
import type { WsData } from "../ws/handlers.ts";
import { PASSAGES } from "@typing-race/shared";

const PASSAGE = "hi"; // 2 chars; tests mark position 0 finished for the grace flow

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
    firstFinisherId: null,
    graceEndsAtServerMs: null,
  };
}

function fakeWs(playerId: string) {
  const ws = {
    data: {
      playerId,
      roomCode: null as string | null,
      nickname: null as string | null,
      clientOffsetMs: 0,
    } satisfies WsData,
    sent: [] as string[],
    send(data: string) {
      ws.sent.push(data);
    },
  };
  return ws;
}
function asWs(ws: ReturnType<typeof fakeWs>): import("bun").ServerWebSocket<WsData> {
  return ws as unknown as import("bun").ServerWebSocket<WsData>;
}

function addPlayerToRoom(
  room: Room,
  playerId: string,
  ws: ReturnType<typeof fakeWs>,
  isHost = false,
) {
  const player: Player = {
    playerId,
    sessionToken: `token-${playerId}`,
    nickname: `P-${playerId}`,
    isHost,
    wsRef: asWs(ws),
    progress: 0,
    lastKeystrokeAt: 0,
    lastCursorAtMs: 0,
    clientOffsetMs: 0,
    joinedAt: Date.now(),
    charStates: [],
    totalKeystrokes: 0,
    uncorrectedErrors: 0,
    currentWpm: 0,
    finishedAtServerMs: null,
    disconnectedAt: null,
    reconnectedAt: null,
  };
  room.players.set(playerId, player);
}

beforeEach(() => {
  rooms.clear();
});

describe("tick() race-end detection", () => {
  test("1. racing → grace when first finisher detected, broadcasts grace_countdown", () => {
    const room = fakeRoom("racing", Date.now() - 1000);
    const hostWs = fakeWs("h");
    const guestWs = fakeWs("g");
    addPlayerToRoom(room, "h", hostWs, true);
    addPlayerToRoom(room, "g", guestWs);
    // First player has finished; second is still typing
    room.players.get("h")!.finishedAtServerMs = Date.now() - 200;
    room.players.get("g")!.finishedAtServerMs = null;
    rooms.set(room.code, room);

    hostWs.sent.length = 0;
    guestWs.sent.length = 0;

    tick(Date.now());

    expect(room.state).toBe("grace");
    expect(room.firstFinisherId).toBe("h");
    expect(room.graceEndsAtServerMs).not.toBeNull();
    // grace_countdown broadcast to BOTH players
    expect(hostWs.sent.some((s) => s.includes('"grace_countdown"'))).toBe(true);
    expect(guestWs.sent.some((s) => s.includes('"grace_countdown"'))).toBe(true);
  });

  test("2. grace → finished when grace expires, broadcasts race_end", () => {
    const room = fakeRoom("grace", Date.now() - 1000);
    room.firstFinisherId = "h";
    room.graceEndsAtServerMs = Date.now() - 100; // already expired
    const hostWs = fakeWs("h");
    const guestWs = fakeWs("g");
    addPlayerToRoom(room, "h", hostWs, true);
    addPlayerToRoom(room, "g", guestWs);
    room.players.get("h")!.finishedAtServerMs = Date.now() - 500;
    room.players.get("g")!.finishedAtServerMs = null;
    rooms.set(room.code, room);

    hostWs.sent.length = 0;
    guestWs.sent.length = 0;
    tick(Date.now());

    expect(room.state).toBe("finished");
    expect(hostWs.sent.some((s) => s.includes('"race_end"'))).toBe(true);
    expect(guestWs.sent.some((s) => s.includes('"race_end"'))).toBe(true);
  });

  test("3. race_end.results contains all players in arbitrary order", () => {
    const room = fakeRoom("grace", Date.now() - 1000);
    room.firstFinisherId = "h";
    room.graceEndsAtServerMs = Date.now() - 100;
    const hostWs = fakeWs("h");
    const guestWs = fakeWs("g");
    addPlayerToRoom(room, "h", hostWs, true);
    addPlayerToRoom(room, "g", guestWs);
    room.players.get("h")!.finishedAtServerMs = Date.now() - 500;
    room.players.get("g")!.finishedAtServerMs = null;
    rooms.set(room.code, room);
    tick(Date.now());

    const raceEnd = JSON.parse(
      hostWs.sent.find((s) => s.includes('"race_end"')) ?? "{}",
    );
    expect(raceEnd.results.length).toBe(2);
    const ids = raceEnd.results.map((r: { playerId: string }) => r.playerId);
    expect(ids).toContain("h");
    expect(ids).toContain("g");
  });

  test("4. race_end.results[].accuracy uses computeAccuracy (correctChars / totalKeystrokes)", () => {
    const room = fakeRoom("grace", Date.now() - 1000);
    room.firstFinisherId = "h";
    room.graceEndsAtServerMs = Date.now() - 100;
    const hostWs = fakeWs("h");
    addPlayerToRoom(room, "h", hostWs, true);
    const p = room.players.get("h")!;
    p.totalKeystrokes = 100;
    p.uncorrectedErrors = 5; // correctChars = (length - uncorrected); for empty charStates 0; set up
    p.charStates = Array.from({ length: 105 }, (_, i) =>
      i < 100 ? "correct" : "pending",
    );
    p.finishedAtServerMs = Date.now() - 500;
    rooms.set(room.code, room);
    tick(Date.now());

    const raceEnd = JSON.parse(
      hostWs.sent.find((s) => s.includes('"race_end"')) ?? "{}",
    );
    const hResult = raceEnd.results.find(
      (r: { playerId: string }) => r.playerId === "h",
    );
    // correctChars = 105 - 5 = 100; totalKeystrokes = 100; accuracy = 1.0
    expect(hResult.accuracy).toBe(1.0);
  });

  test("5. all-finished shortcut: racing → finished without grace", () => {
    const room = fakeRoom("racing", Date.now() - 1000);
    const hostWs = fakeWs("h");
    const guestWs = fakeWs("g");
    addPlayerToRoom(room, "h", hostWs, true);
    addPlayerToRoom(room, "g", guestWs);
    // BOTH finished — no grace period
    room.players.get("h")!.finishedAtServerMs = Date.now() - 500;
    room.players.get("g")!.finishedAtServerMs = Date.now() - 300;
    rooms.set(room.code, room);

    hostWs.sent.length = 0;
    tick(Date.now());

    expect(room.state).toBe("finished");
    // race_end broadcast; no grace_countdown
    expect(hostWs.sent.some((s) => s.includes('"race_end"'))).toBe(true);
    expect(hostWs.sent.some((s) => s.includes('"grace_countdown"'))).toBe(false);
    expect(room.firstFinisherId).toBeNull();
  });

  test("6. grace_countdown.leaderPlayerId === first finisher", () => {
    const room = fakeRoom("racing", Date.now() - 1000);
    const hostWs = fakeWs("h");
    const guestWs = fakeWs("g");
    addPlayerToRoom(room, "h", hostWs, true);
    addPlayerToRoom(room, "g", guestWs);
    room.players.get("h")!.finishedAtServerMs = Date.now() - 200;
    rooms.set(room.code, room);

    guestWs.sent.length = 0;
    tick(Date.now());

    const gc = JSON.parse(
      guestWs.sent.find((s) => s.includes('"grace_countdown"')) ?? "{}",
    );
    expect(gc.leaderPlayerId).toBe("h");
    expect(gc.leaderNickname).toBe("P-h");
    expect(gc.remainingMs).toBeGreaterThan(0);
    expect(gc.remainingMs).toBeLessThanOrEqual(5000);
  });

  test("7. race_end.finishedPlayerIds still present (Phase 2 backwards compat)", () => {
    const room = fakeRoom("grace", Date.now() - 1000);
    room.firstFinisherId = "h";
    room.graceEndsAtServerMs = Date.now() - 100;
    const hostWs = fakeWs("h");
    const guestWs = fakeWs("g");
    addPlayerToRoom(room, "h", hostWs, true);
    addPlayerToRoom(room, "g", guestWs);
    room.players.get("h")!.finishedAtServerMs = Date.now() - 500;
    room.players.get("g")!.finishedAtServerMs = null;
    rooms.set(room.code, room);
    tick(Date.now());

    const raceEnd = JSON.parse(
      hostWs.sent.find((s) => s.includes('"race_end"')) ?? "{}",
    );
    // finishedPlayerIds: only h (g never finished; race_end still lists h via results filter)
    expect(Array.isArray(raceEnd.finishedPlayerIds)).toBe(true);
    expect(raceEnd.finishedPlayerIds).toContain("h");
  });
});

describe("FSM transition: racing → grace", () => {
  test("8. transition(racing → grace) accepted (D-14)", () => {
    const room = fakeRoom("racing");
    expect(() => transition(room, "grace")).not.toThrow();
    expect(room.state).toBe("grace");
  });

  test("transition(grace → finished) accepted", () => {
    const room = fakeRoom("grace");
    expect(() => transition(room, "finished")).not.toThrow();
    expect(room.state).toBe("finished");
  });

  test("transition(racing → lobby) rejected (forbidden; must go through finished)", () => {
    const room = fakeRoom("racing");
    expect(() => transition(room, "lobby")).toThrow();
  });
});

describe("rematch: start_race without passageId auto-deals", () => {
  test("9. start_race without passageId auto-deals from D-04 deck; room.passageId set; deck advances", () => {
    const hostWs = fakeWs("h");
    const { code, room } = createRoom(asWs(hostWs), "Alice");
    addPlayer(code, "g", "Bob", asWs(fakeWs("g")));
    // Pre-seed deck (simulating previous race)
    const p0 = PASSAGES[0];
    const p1 = PASSAGES[1];
    const p2 = PASSAGES[2];
    if (!p0 || !p1 || !p2) throw new Error("PASSAGES empty");
    room.deckOrder = [p0.id, p1.id, p2.id];
    room.deckCursor = 1;
    room.lastPassageId = p0.id;
    room.usedPassageIds = new Set([p0.id]);

    hostWs.sent.length = 0;
    const before = room.lastPassageId;
    dispatch(
      asWs(hostWs),
      JSON.stringify({ type: "start_race", graceSeconds: 5 }),
    );

    expect(room.state).toBe("countdown");
    // Auto-dealt passageId should be one of the deck entries (not lastPassageId)
    expect(room.passageId).not.toBe(before);
    expect(room.passageId).not.toBeNull();
    if (!room.passageId) throw new Error("expected non-null passageId");
    expect(room.lastPassageId).toBe(room.passageId);
    expect(room.usedPassageIds.has(room.passageId)).toBe(true);
    // Deck should have advanced
    expect(room.deckCursor).toBe(2);
  });
});