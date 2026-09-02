/**
 * In-memory room store. Server-internal — no untrusted input crosses.
 * Collision retry uses Plan 01's `genRoomCode()` with up to 3 attempts
 * (887M keyspace, birthday-collision ~0.006% at 10k active rooms).
 */
import { genRoomCode, isValidRoomCode, type PlayerId } from "@typing-race/shared";
import type { Player, Room } from "../race/types.ts";
import type { WsData } from "../ws/handlers.ts";
import {
  broadcastJoinedRoom,
  broadcastLobbyState,
  broadcastPlayerLeft,
  broadcastPlayerDisconnected,
} from "../ws/broadcast.ts";
import { logger } from "../logger.ts";

export const MAX_PLAYERS_PER_ROOM = 8;
const COLLISION_RETRIES = 3;

export const rooms = new Map<string, Room>();

export function createRoom(
  hostWs: import("bun").ServerWebSocket<WsData>,
  nickname: string,
): { code: string; room: Room } {
  let code: string;
  let attempts = 0;
  do {
    code = genRoomCode();
    attempts++;
    if (attempts > COLLISION_RETRIES) {
      throw new Error("room code collision after retries");
    }
  } while (rooms.has(code));

  const room: Room = {
    code,
    hostId: hostWs.data.playerId,
    state: "lobby",
    passageId: null,
    passageText: null,
    startsAtServerMs: null,
    players: new Map(),
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    // Phase 3 fields (D-04 deck, D-09 grace)
    graceSeconds: 5,
    hostPickedPassagePreview: null,
    lastPassageId: null,
    usedPassageIds: new Set(),
    deckOrder: [],
    deckCursor: 0,
    // Phase 3 Plan 04
    firstFinisherId: null,
    graceEndsAtServerMs: null,
  };
  rooms.set(code, room);

  // Host joins immediately (they created the room)
  const result = addPlayer(code, hostWs.data.playerId, nickname, hostWs, true);
  if (!result.ok) throw new Error("host add failed: " + result.code);
  // Tell the host they're joined (joined_room carries clockOffsetMs; others see lobby_state)
  broadcastJoinedRoom(room, hostWs.data.playerId);
  return { code, room };
}

export function getRoom(code: string): Room | null {
  return rooms.get(code) ?? null;
}

export type AddPlayerResult =
  | { ok: true; player: Player; room: Room }
  | { ok: false; code: "ROOM_NOT_FOUND" | "ROOM_FULL" };

export function addPlayer(
  code: string,
  playerId: PlayerId,
  nickname: string,
  ws: import("bun").ServerWebSocket<WsData>,
  isHostOverride?: boolean,
): AddPlayerResult {
  if (!isValidRoomCode(code)) return { ok: false, code: "ROOM_NOT_FOUND" };
  const room = rooms.get(code);
  if (!room) return { ok: false, code: "ROOM_NOT_FOUND" };
  if (room.players.size >= MAX_PLAYERS_PER_ROOM) {
    return { ok: false, code: "ROOM_FULL" };
  }

  const isFirstPlayer = room.players.size === 0;
  const sessionToken = crypto.randomUUID();
  const player: Player = {
    playerId,
    sessionToken,
    nickname,
    isHost: isHostOverride ?? isFirstPlayer,
    wsRef: ws,
    progress: 0,
    lastKeystrokeAt: 0,
    lastCursorAtMs: 0,
    clientOffsetMs: 0,
    joinedAt: Date.now(),
    // Phase 3 fields
    charStates: [],
    totalKeystrokes: 0,
    uncorrectedErrors: 0,
    currentWpm: 0,
    finishedAtServerMs: null,
    disconnectedAt: null,
    reconnectedAt: null,
  };
  room.players.set(playerId, player);
  room.lastActivityAt = Date.now();
  ws.data.roomCode = code;
  ws.data.nickname = nickname;
  ws.data.sessionToken = sessionToken;

  broadcastLobbyState(room);
  return { ok: true, player, room };
}

export function findPlayerBySessionToken(
  code: string,
  sessionToken: string,
): Player | null {
  const room = rooms.get(code);
  if (!room) return null;
  for (const player of room.players.values()) {
    if (player.sessionToken === sessionToken) {
      return player;
    }
  }
  return null;
}

export function rebindPlayerSocket(
  room: Room,
  player: Player,
  newWs: import("bun").ServerWebSocket<WsData>,
): void {
  const oldWs = player.wsRef;
  if (oldWs && oldWs !== newWs) {
    try {
      oldWs.send(JSON.stringify({ type: "session_taken_over" }));
      oldWs.close(1000, "Session taken over by another tab");
    } catch {
      // ignore
    }
  }
  player.wsRef = newWs;
  player.disconnectedAt = null;
  player.reconnectedAt = Date.now();
  newWs.data.playerId = player.playerId;
  newWs.data.roomCode = room.code;
  newWs.data.nickname = player.nickname;
  newWs.data.sessionToken = player.sessionToken;
  room.lastActivityAt = Date.now();
}

export function removePlayer(code: string, playerId: PlayerId): void {
  const room = rooms.get(code);
  if (!room) return;
  const removed = room.players.delete(playerId);
  if (!removed) return;
  room.lastActivityAt = Date.now();

  if (room.players.size === 0) {
    rooms.delete(code);
    return;
  }

  // If the host left, promote the next-joined player
  if (room.hostId === playerId) {
    const next = [...room.players.values()].sort(
      (a, b) => a.joinedAt - b.joinedAt,
    )[0];
    if (next) {
      next.isHost = true;
      room.hostId = next.playerId;
    }
  }
  broadcastPlayerLeft(room, playerId);
  broadcastLobbyState(room);
}

export function handlePlayerDisconnect(code: string, playerId: PlayerId): void {
  const room = rooms.get(code);
  if (!room) return;
  const player = room.players.get(playerId);
  if (!player) return;

  // If only 1 player in lobby or room is empty, remove immediately
  if (room.state === "lobby" && room.players.size <= 1) {
    removePlayer(code, playerId);
    return;
  }

  // Active room or lobby with multiple players: 60s disconnect grace period
  player.disconnectedAt = Date.now();
  logger.info(
    { playerId, roomCode: code, nickname: player.nickname },
    "[rooms] player disconnected — 60s grace started",
  );
  broadcastPlayerDisconnected(room, player, 60_000);
}

export class IpRateLimiter {
  private windowMs: number;
  private maxCreations: number;
  private records = new Map<string, number[]>();

  constructor(maxCreations: number = 10, windowMs: number = 3600_000) {
    this.maxCreations = maxCreations;
    this.windowMs = windowMs;
  }

  checkAndConsume(ip: string, now: number = Date.now()): boolean {
    const timestamps = this.records.get(ip) ?? [];
    // prune expired
    const valid = timestamps.filter((t) => now - t < this.windowMs);
    if (valid.length >= this.maxCreations) {
      this.records.set(ip, valid);
      return false;
    }
    valid.push(now);
    this.records.set(ip, valid);
    return true;
  }

  reset(): void {
    this.records.clear();
  }
}

export const ipRateLimiter = new IpRateLimiter(10, 3600_000);