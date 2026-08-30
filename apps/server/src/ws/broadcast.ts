/**
 * Broadcast helpers — server iterates `room.players` and sends WS frames.
 * Inbound: a `Room` (NOT a `string` code) — caller has already resolved.
 */
import type { JoinedRoom, LobbyState, PlayerLeft } from "@typing-race/shared";
import type { Room } from "../race/types.ts";

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
    roomCode: room.code,
    you: { nickname: target.nickname, isHost: target.isHost },
    players,
    clockOffsetMs: target.clientOffsetMs,
  };
  try {
    target.wsRef.send(JSON.stringify(frame));
  } catch {
    // ignore
  }
}