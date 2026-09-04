import { describe, test, expect } from "bun:test";
import {
  buildLobbyStateFrame,
  buildJoinedRoomFrame,
  buildPlayerLeftFrame,
  buildRaceStartFrame,
  buildCountdownFrame,
  buildRaceEndFrame,
  buildGraceCountdownFrame,
  buildCursorUpdateFrame,
  buildRejoinedRoomFrame,
  buildPlayerDisconnectedFrame,
  buildPlayerReconnectedFrame,
} from "../race/frames.ts";
import type { Room, Player } from "../race/types.ts";

function createFakePlayer(id: string, nickname: string, isHost: boolean = false): Player {
  return {
    playerId: id,
    sessionToken: "token-" + id,
    nickname,
    isHost,
    progress: 0,
    lastKeystrokeAt: 0,
    lastCursorAtMs: 0,
    clientOffsetMs: 5,
    joinedAt: 1000,
    charStates: [],
    totalKeystrokes: 0,
    uncorrectedErrors: 0,
    currentWpm: 0,
    finishedAtServerMs: null,
    disconnectedAt: null,
    reconnectedAt: null,
    isReady: true,
  };
}

function createFakeRoom(code: string = "ABC123"): Room {
  const p1 = createFakePlayer("p1", "Alice", true);
  const p2 = createFakePlayer("p2", "Bob", false);
  const players = new Map<string, Player>([
    ["p1", p1],
    ["p2", p2],
  ]);

  return {
    code,
    hostId: "p1",
    state: "lobby",
    passageId: null,
    passageText: null,
    startsAtServerMs: null,
    players,
    createdAt: 1000,
    lastActivityAt: 1000,
    graceSeconds: 5,
    hostPickedPassagePreview: null,
    lastPassageId: null,
    usedPassageIds: new Set<string>(),
    deckOrder: [],
    deckCursor: 0,
    firstFinisherId: null,
    graceEndsAtServerMs: null,
  };
}

describe("frames builders", () => {
  test("buildLobbyStateFrame produces valid lobby_state frame", () => {
    const room = createFakeRoom();
    const frame = buildLobbyStateFrame(room);
    expect(frame.type).toBe("lobby_state");
    expect(frame.roomCode).toBe("ABC123");
    expect(frame.players).toHaveLength(2);
    expect(frame.players[0]?.playerId).toBe("p1");
    expect(frame.players[0]?.isHost).toBe(true);
  });

  test("buildJoinedRoomFrame produces valid joined_room frame", () => {
    const room = createFakeRoom();
    const p1 = room.players.get("p1")!;
    const frame = buildJoinedRoomFrame(room, p1);
    expect(frame.type).toBe("joined_room");
    expect(frame.playerId).toBe("p1");
    expect(frame.roomCode).toBe("ABC123");
    expect(frame.you.nickname).toBe("Alice");
    expect(frame.clockOffsetMs).toBe(5);
  });

  test("buildPlayerLeftFrame produces player_left frame", () => {
    const frame = buildPlayerLeftFrame("p2");
    expect(frame.type).toBe("player_left");
    expect(frame.playerId).toBe("p2");
  });

  test("buildRaceStartFrame and buildCountdownFrame", () => {
    const start = buildRaceStartFrame(5000, "passage-1", "hello world");
    expect(start.type).toBe("race_start");
    expect(start.startsAtServerMs).toBe(5000);
    expect(start.passageId).toBe("passage-1");

    const count = buildCountdownFrame(5000, 3);
    expect(count.type).toBe("countdown");
    expect(count.secondsRemaining).toBe(3);
  });

  test("buildRaceEndFrame computes results and finished player list", () => {
    const room = createFakeRoom();
    room.startsAtServerMs = 1000;
    const p1 = room.players.get("p1")!;
    p1.finishedAtServerMs = 3000;
    p1.currentWpm = 60;
    p1.charStates = ["correct", "correct", "correct"];
    p1.totalKeystrokes = 3;

    const frame = buildRaceEndFrame(room, 4000);
    expect(frame.type).toBe("race_end");
    expect(frame.reason).toBe("finished");
    expect(frame.finishedPlayerIds).toEqual(["p1"]);
    expect(frame.results).toBeDefined();
    const r1 = frame.results!.find((r) => r.playerId === "p1")!;
    expect(r1.finishTimeMs).toBe(2000);
    expect(r1.wpm).toBe(60);
    expect(r1.accuracy).toBe(1);
  });

  test("buildGraceCountdownFrame returns frame or null", () => {
    const room = createFakeRoom();
    expect(buildGraceCountdownFrame(room, 2000)).toBeNull();

    room.firstFinisherId = "p1";
    room.graceEndsAtServerMs = 6000;
    const frame = buildGraceCountdownFrame(room, 2000);
    expect(frame).not.toBeNull();
    expect(frame?.type).toBe("grace_countdown");
    expect(frame?.leaderPlayerId).toBe("p1");
    expect(frame?.remainingMs).toBe(4000);
  });

  test("buildCursorUpdateFrame produces cursor_update frame", () => {
    const p = createFakePlayer("p1", "Alice");
    p.progress = 5;
    p.currentWpm = 45;
    p.charStates = ["correct", "correct", "correct", "correct", "correct"];

    const frame = buildCursorUpdateFrame(p, 1500);
    expect(frame.type).toBe("cursor_update");
    expect(frame.playerId).toBe("p1");
    expect(frame.index).toBe(5);
    expect(frame.serverTs).toBe(1500);
    expect(frame.wpm).toBe(45);
  });

  test("buildRejoinedRoomFrame produces full race snapshot", () => {
    const room = createFakeRoom();
    room.state = "racing";
    room.passageId = "p-1";
    room.passageText = "hello";
    room.startsAtServerMs = 1000;

    const p = room.players.get("p1")!;
    p.progress = 3;
    p.charStates = ["correct", "correct", "pending", "pending", "pending"];

    const frame = buildRejoinedRoomFrame(room, p);
    expect(frame.type).toBe("rejoined_room");
    expect(frame.roomState).toBe("racing");
    expect(frame.passageId).toBe("p-1");
    expect(frame.you.charStates[2]).toBe("error"); // sanitized index < progress & pending -> error
  });

  test("buildPlayerDisconnectedFrame and buildPlayerReconnectedFrame", () => {
    const p = createFakePlayer("p1", "Alice");
    const d = buildPlayerDisconnectedFrame(p, 60000);
    expect(d.type).toBe("player_disconnected");
    expect(d.timeoutMs).toBe(60000);

    const r = buildPlayerReconnectedFrame(p);
    expect(r.type).toBe("player_reconnected");
    expect(r.playerId).toBe("p1");
  });
});
