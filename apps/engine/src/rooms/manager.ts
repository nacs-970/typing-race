import { genRoomCode, isValidRoomCode, type PlayerId } from "@typing-race/shared";
import type { Player, Room } from "../race/types.ts";
import type { RoomStore } from "./store.ts";
import type { EventBridge } from "@typing-race/shared/bridge";
import {
  buildJoinedRoomFrame,
  buildLobbyStateFrame,
  buildPlayerLeftFrame,
  buildPlayerDisconnectedFrame,
  buildPlayerReconnectedFrame,
  buildRejoinedRoomFrame,
} from "../race/frames.ts";
import { logger } from "../logger.ts";

export const MAX_PLAYERS_PER_ROOM = 8;
const COLLISION_RETRIES = 3;

export class RoomManager {
  constructor(
    public store: RoomStore,
    public bridge: EventBridge,
  ) {}

  async createRoom(
    playerId: PlayerId,
    nickname: string,
  ): Promise<{ code: string; room: Room }> {
    let code: string;
    let attempts = 0;
    do {
      code = genRoomCode();
      attempts++;
      if (attempts > COLLISION_RETRIES) {
        throw new Error("room code collision after retries");
      }
    } while (await this.store.has(code));

    const room: Room = {
      code,
      hostId: playerId,
      state: "lobby",
      passageId: null,
      passageText: null,
      startsAtServerMs: null,
      players: new Map(),
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
      graceSeconds: 5,
      hostPickedPassagePreview: null,
      lastPassageId: null,
      usedPassageIds: new Set(),
      deckOrder: [],
      deckCursor: 0,
      firstFinisherId: null,
      graceEndsAtServerMs: null,
      corpusType: "passage",
      corpusCategory: "mid",
    };
    await this.store.set(code, room);

    const result = await this.addPlayer(code, playerId, nickname, true);
    if (!result.ok) throw new Error("host add failed: " + result.code);

    return { code, room };
  }

  async getRoom(code: string): Promise<Room | null> {
    return (await this.store.get(code)) ?? null;
  }

  async addPlayer(
    code: string,
    playerId: PlayerId,
    nickname: string,
    isHostOverride?: boolean,
  ): Promise<
    | { ok: true; player: Player; room: Room }
    | { ok: false; code: "ROOM_NOT_FOUND" | "ROOM_FULL" }
  > {
    if (!isValidRoomCode(code)) return { ok: false, code: "ROOM_NOT_FOUND" };
    const room = await this.store.get(code);
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
      isReady: isHostOverride ?? isFirstPlayer,
    };

    room.players.set(playerId, player);
    room.lastActivityAt = Date.now();
    await this.store.set(code, room);

    await this.bridge.publishToGateway({
      type: "player_room_assigned",
      playerId,
      roomCode: code,
    });

    await this.bridge.publishToGateway({
      type: "send_to_client",
      playerId,
      payload: buildJoinedRoomFrame(room, player),
    });

    await this.bridge.publishToGateway({
      type: "broadcast_to_room",
      roomCode: code,
      payload: buildLobbyStateFrame(room),
    });

    return { ok: true, player, room };
  }

  async removePlayer(code: string, playerId: PlayerId): Promise<void> {
    const room = await this.store.get(code);
    if (!room) return;
    const removed = room.players.delete(playerId);
    if (!removed) return;
    room.lastActivityAt = Date.now();

    await this.bridge.publishToGateway({
      type: "player_room_cleared",
      playerId,
      roomCode: code,
    });

    if (room.players.size === 0) {
      await this.store.delete(code);
      return;
    }

    if (room.hostId === playerId) {
      const activeCandidates = [...room.players.values()].filter(
        (p) => p.disconnectedAt === null,
      );
      const pool = activeCandidates.length > 0 ? activeCandidates : [...room.players.values()];
      const next = pool.sort((a, b) => a.joinedAt - b.joinedAt)[0];
      if (next) {
        next.isHost = true;
        room.hostId = next.playerId;
        logger.info(
          { roomCode: code, oldHostId: playerId, newHostId: next.playerId, nickname: next.nickname },
          "[rooms] host left — promoted earliest guest to host",
        );
      }
    }

    await this.store.set(code, room);

    await this.bridge.publishToGateway({
      type: "broadcast_to_room",
      roomCode: code,
      payload: buildPlayerLeftFrame(playerId),
    });

    await this.bridge.publishToGateway({
      type: "broadcast_to_room",
      roomCode: code,
      payload: buildLobbyStateFrame(room),
    });
  }

  async handlePlayerDisconnect(
    playerId: PlayerId,
    roomCode: string | null,
    now: number = Date.now(),
  ): Promise<void> {
    if (!roomCode) return;
    const room = await this.store.get(roomCode);
    if (!room) return;
    const player = room.players.get(playerId);
    if (!player) return;

    player.disconnectedAt = now;
    await this.store.set(roomCode, room);

    logger.info(
      { playerId, roomCode, nickname: player.nickname },
      "[rooms] player disconnected — 60s grace started",
    );

    await this.bridge.publishToGateway({
      type: "broadcast_to_room",
      roomCode,
      payload: buildPlayerDisconnectedFrame(player, 60_000),
    });
  }

  async rejoinPlayer(
    roomCode: string,
    sessionToken: string,
    newPlayerId: string,
    now: number = Date.now(),
  ): Promise<boolean> {
    const room = await this.store.get(roomCode);
    if (!room) return false;

    let targetPlayer: Player | null = null;
    let oldPlayerId: string | null = null;
    for (const [id, player] of room.players.entries()) {
      if (player.sessionToken === sessionToken) {
        targetPlayer = player;
        oldPlayerId = id;
        break;
      }
    }

    if (!targetPlayer || !oldPlayerId) return false;

    const isMultiTabTakeover = oldPlayerId !== newPlayerId;

    if (isMultiTabTakeover) {
      room.players.delete(oldPlayerId);
      targetPlayer.playerId = newPlayerId;
      room.players.set(newPlayerId, targetPlayer);
      if (room.hostId === oldPlayerId) {
        room.hostId = newPlayerId;
      }
      if (room.firstFinisherId === oldPlayerId) {
        room.firstFinisherId = newPlayerId;
      }
    }

    targetPlayer.disconnectedAt = null;
    targetPlayer.reconnectedAt = now;
    room.lastActivityAt = now;
    await this.store.set(roomCode, room);

    if (isMultiTabTakeover) {
      await this.bridge.publishToGateway({
        type: "send_to_client",
        playerId: oldPlayerId,
        payload: { type: "session_taken_over" },
      });

      await this.bridge.publishToGateway({
        type: "disconnect_client",
        playerId: oldPlayerId,
        code: 1000,
        reason: "Session taken over by another tab",
      });
    }

    await this.bridge.publishToGateway({
      type: "player_room_assigned",
      playerId: targetPlayer.playerId,
      roomCode,
    });

    await this.bridge.publishToGateway({
      type: "send_to_client",
      playerId: targetPlayer.playerId,
      payload: buildRejoinedRoomFrame(room, targetPlayer),
    });

    await this.bridge.publishToGateway({
      type: "broadcast_to_room",
      roomCode,
      payload: buildPlayerReconnectedFrame(targetPlayer),
      excludePlayerId: targetPlayer.playerId,
    });

    return true;
  }

  async findPlayerBySessionToken(
    code: string,
    sessionToken: string,
  ): Promise<Player | null> {
    const room = await this.store.get(code);
    if (!room) return null;
    for (const player of room.players.values()) {
      if (player.sessionToken === sessionToken) {
        return player;
      }
    }
    return null;
  }
}
