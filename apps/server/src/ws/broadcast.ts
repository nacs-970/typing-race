/**
 * Broadcast helpers — server iterates `room.players` and sends WS frames.
 * Inbound: a `Room` (NOT a `string` code) — caller has already resolved.
 */
import type {
  JoinedRoom,
  LobbyState,
  PlayerLeft,
  RaceEnd,
  GraceCountdown,
  PlayerFinalStats,
  RejoinedRoom,
  PlayerDisconnected,
  PlayerReconnected,
} from "@typing-race/shared";
import type { Room, Player } from "../race/types.ts";
import { computeAccuracy, countCorrectChars } from "../race/scoring.ts";

/** Send a frame to every player in the room. Errors swallowed (one slow client ≠ DoS). */
export function broadcastToRoom(room: Room, frame: object): void {
  const json = JSON.stringify(frame);
  for (const player of room.players.values()) {
    try {
      player.wsRef.send(json);
    } catch {
      // ignore — Phase 4 will log
    }
  }
}

export function broadcastLobbyState(room: Room): void {
  const players = [...room.players.values()].map((p) => ({
    playerId: p.playerId,
    nickname: p.nickname,
    isHost: p.isHost,
    progress: p.progress,
  }));
  const frame: LobbyState = {
    type: "lobby_state",
    roomCode: room.code,
    players,
    hostPickedPassagePreview: room.hostPickedPassagePreview ?? undefined,
  };
  broadcastToRoom(room, frame);
}

export function broadcastPlayerLeft(room: Room, playerId: string): void {
  const frame: PlayerLeft = { type: "player_left", playerId };
  broadcastToRoom(room, frame);
}

export function broadcastJoinedRoom(room: Room, playerId: string): void {
  const target = room.players.get(playerId);
  if (!target) return;
  const players = [...room.players.values()].map((p) => ({
    playerId: p.playerId,
    nickname: p.nickname,
    isHost: p.isHost,
    progress: p.progress,
  }));
  const frame: JoinedRoom = {
    type: "joined_room",
    playerId: target.playerId,
    sessionToken: target.sessionToken,
    roomCode: room.code,
    you: { nickname: target.nickname, isHost: target.isHost },
    players,
    clockOffsetMs: target.clientOffsetMs,
    hostPickedPassagePreview: room.hostPickedPassagePreview ?? undefined,
  };
  try {
    target.wsRef.send(JSON.stringify(frame));
  } catch {
    // ignore
  }
}

/** Build a race_end frame with per-player final stats (D-10).
 *  Players who never finished (no finishedAtServerMs) get `now` as finishTime
 *  so they still appear in the results — D-08 grace gives them a fair shot.
 */
export function buildRaceEndFrame(room: Room, now: number = Date.now()): RaceEnd {
  const results: PlayerFinalStats[] = [...room.players.values()].map((p) => {
    const correctChars = countCorrectChars(p.charStates);
    return {
      playerId: p.playerId,
      finishTimeMs: p.finishedAtServerMs ?? now,
      wpm: p.currentWpm,
      accuracy: computeAccuracy({
        correctChars,
        totalKeystrokes: p.totalKeystrokes,
      }),
    };
  });
  const finishedPlayerIds = results
    .filter((r) => room.players.get(r.playerId)?.finishedAtServerMs !== null)
    .map((r) => r.playerId);
  return {
    type: "race_end",
    reason: "finished",
    finishedPlayerIds,
    results,
  };
}

/** Broadcast grace_countdown to the room — D-15. */
export function broadcastGraceCountdown(room: Room, now: number = Date.now()): void {
  if (room.firstFinisherId === null || room.graceEndsAtServerMs === null) return;
  const leader = room.players.get(room.firstFinisherId);
  if (!leader) return;
  const frame: GraceCountdown = {
    type: "grace_countdown",
    remainingMs: Math.max(0, room.graceEndsAtServerMs - now),
    leaderPlayerId: room.firstFinisherId,
    leaderNickname: leader.nickname,
  };
  broadcastToRoom(room, frame);
}

/** Build full authoritative race snapshot for a rejoining player (Plan 04-02). */
export function buildRejoinedRoomFrame(room: Room, player: Player): RejoinedRoom {
  const isLobby = room.state === "lobby";
  return {
    type: "rejoined_room",
    roomCode: room.code,
    roomState: room.state,
    passageId: isLobby ? null : room.passageId,
    passageText: isLobby ? null : room.passageText,
    startsAtServerMs: isLobby ? null : room.startsAtServerMs,
    graceEndsAtServerMs: isLobby ? null : room.graceEndsAtServerMs,
    clockOffsetMs: player.clientOffsetMs,
    you: {
      playerId: player.playerId,
      nickname: player.nickname,
      isHost: player.isHost,
      progress: player.progress,
      charStates: player.charStates,
      wpm: player.currentWpm,
      uncorrectedErrors: player.uncorrectedErrors,
    },
    players: [...room.players.values()].map((p) => ({
      playerId: p.playerId,
      nickname: p.nickname,
      isHost: p.isHost,
      progress: p.progress,
      charStates: p.charStates,
      wpm: p.currentWpm,
      isDisconnected: p.disconnectedAt !== null,
    })),
  };
}

export function broadcastPlayerDisconnected(
  room: Room,
  player: Player,
  timeoutMs: number = 60_000,
): void {
  const frame: PlayerDisconnected = {
    type: "player_disconnected",
    playerId: player.playerId,
    nickname: player.nickname,
    timeoutMs,
  };
  broadcastToRoom(room, frame);
}

export function broadcastPlayerReconnected(room: Room, player: Player): void {
  const frame: PlayerReconnected = {
    type: "player_reconnected",
    playerId: player.playerId,
    nickname: player.nickname,
  };
  broadcastToRoom(room, frame);
}