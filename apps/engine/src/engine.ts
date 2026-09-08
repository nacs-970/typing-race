import type { EventBridge, GatewayToEngineEvent } from "@typing-race/shared/bridge";
import type { RoomStore } from "./rooms/store.ts";
import { InMemoryRoomStore } from "./rooms/store.ts";
export { InMemoryRoomStore, type RoomStore };
import { RoomManager } from "./rooms/manager.ts";
import { RaceController, transition } from "./race/controller.ts";
import { validateKeystroke } from "./race/validate-keystroke.ts";
import { shuffle, dealNextPassage } from "./race/corpus.ts";
import {
  getPassageById,
  isValidPassageId,
  hostPickedPreview,
  PASSAGES,
  getRandomCorpus,
} from "@typing-race/shared";
import {
  buildCursorUpdateFrame,
  buildCountdownFrame,
  buildLobbyStateFrame,
} from "./race/frames.ts";
import { logger } from "./logger.ts";

export class EngineWorker {
  public roomManager: RoomManager;
  public controller: RaceController;
  private unsubscribe?: () => void;
  private tickTimer?: ReturnType<typeof setInterval>;
  private draining = false;
  private drainPromise?: Promise<void>;

  constructor(
    public bridge: EventBridge,
    public store: RoomStore,
  ) {
    this.roomManager = new RoomManager(this.store, this.bridge);
    this.controller = new RaceController(this.store, this.bridge, this.roomManager);
  }

  drain(timeoutMs = 90_000, pollIntervalMs = 500): Promise<void> {
    if (this.drainPromise) return this.drainPromise;
    this.draining = true;
    void this.bridge.publishToGateway({ type: "draining" });

    const hardTimeout = new Promise<void>(resolve => setTimeout(resolve, timeoutMs));
    let pollTimer: ReturnType<typeof setTimeout>;

    const pollLoop = new Promise<void>((resolve) => {
      const check = async () => {
        try {
          const rooms = await this.store.list();
          const active = rooms.filter(r => r.state === "countdown" || r.state === "racing" || r.state === "grace");
          if (active.length === 0) {
            resolve();
            return;
          }
        } catch (e) {
          logger.error({ err: e }, "[engine] drain poll error");
        }
        pollTimer = setTimeout(check, pollIntervalMs);
      };
      void check();
    });

    this.drainPromise = Promise.race([pollLoop, hardTimeout]).then(() => {
      clearTimeout(pollTimer);
      void this.bridge.publishToGateway({ type: "drained" });
    });
    return this.drainPromise;
  }

  start(): void {
    this.unsubscribe = this.bridge.onEngineEvent((event) => {
      void this.handleEvent(event);
    });
    this.tickTimer = setInterval(() => {
      void this.controller.tick(Date.now());
    }, 1000);
    logger.info("[engine] worker started");
  }

  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = undefined;
    }
    logger.info("[engine] worker stopped");
  }

  async handleEvent(event: GatewayToEngineEvent): Promise<void> {
    switch (event.type) {
      case "client_connected": {
        logger.info({ playerId: event.playerId, ip: event.ip }, "[engine] client connected");
        break;
      }

      case "client_disconnected": {
        await this.roomManager.handlePlayerDisconnect(
          event.playerId,
          event.roomCode,
          event.serverTs,
        );
        break;
      }

      case "client_message": {
        await this.handleClientMessage(event);
        break;
      }
    }
  }

  private async handleClientMessage(
    event: Extract<GatewayToEngineEvent, { type: "client_message" }>,
  ): Promise<void> {
    const { playerId, roomCode, message, serverTs, clientOffsetMs } = event;

    switch (message.type) {
      case "ping":
      case "clock_sync":
        break;

      case "create_room": {
        if (this.draining) {
          void this.bridge.publishToGateway({
            type: "send_to_client",
            playerId,
            payload: { type: "error", code: "SERVER_SHUTTING_DOWN", message: "Server is shutting down" },
          });
          return;
        }
        try {
          const { code, room } = await this.roomManager.createRoom(playerId, message.nickname);
          const player = room.players.get(playerId);
          if (player) {
            player.clientOffsetMs = clientOffsetMs;
            await this.store.set(code, room);
          }
        } catch (err: any) {
          logger.error({ err }, "[engine] create_room failed");
          await this.bridge.publishToGateway({
            type: "send_to_client",
            playerId,
            payload: {
              type: "error",
              code: "INTERNAL",
              message: "failed to create room",
            },
          });
        }
        break;
      }

      case "join_room": {
        if (this.draining) {
          void this.bridge.publishToGateway({
            type: "send_to_client",
            playerId,
            payload: { type: "error", code: "SERVER_SHUTTING_DOWN", message: "Server is shutting down" },
          });
          return;
        }
        const result = await this.roomManager.addPlayer(message.code, playerId, message.nickname);
        if (!result.ok) {
          const isNotFound = result.code === "ROOM_NOT_FOUND";
          await this.bridge.publishToGateway({
            type: "send_to_client",
            playerId,
            payload: {
              type: "error",
              code: isNotFound ? "ROOM_DOES_NOT_EXIST" : result.code,
              message: isNotFound ? "Room does not exist" : result.code,
            },
          });
          return;
        }
        result.player.clientOffsetMs = clientOffsetMs;
        await this.store.set(message.code, result.room);
        break;
      }

      case "rejoin_room": {
        const ok = await this.roomManager.rejoinPlayer(
          message.roomCode,
          message.sessionToken,
          playerId,
          serverTs,
        );
        if (!ok) {
          await this.bridge.publishToGateway({
            type: "send_to_client",
            playerId,
            payload: {
              type: "error",
              code: "SESSION_INVALID",
              message: "session invalid or room expired",
            },
          });
        }
        break;
      }

      case "leave_room": {
        if (!roomCode) return;
        await this.roomManager.removePlayer(roomCode, playerId);
        break;
      }

      case "set_ready": {
        if (!roomCode) return;
        const room = await this.store.get(roomCode);
        if (!room || room.state !== "lobby") return;
        const player = room.players.get(playerId);
        if (!player) return;
        player.isReady = message.ready;
        await this.store.set(roomCode, room);
        await this.bridge.publishToGateway({
          type: "broadcast_to_room",
          roomCode,
          payload: buildLobbyStateFrame(room),
        });
        break;
      }

      case "return_to_lobby": {
        if (!roomCode) return;
        const room = await this.store.get(roomCode);
        if (!room || room.hostId !== playerId) return;
        if (room.state !== "finished" && room.state !== "countdown") return;

        try {
          transition(room, "lobby");
        } catch {
          return;
        }

        for (const p of room.players.values()) {
          p.isReady = false;
        }
        await this.store.set(roomCode, room);

        await this.bridge.publishToGateway({
          type: "broadcast_to_room",
          roomCode,
          payload: { type: "return_to_lobby" },
        });
        await this.bridge.publishToGateway({
          type: "broadcast_to_room",
          roomCode,
          payload: buildLobbyStateFrame(room),
        });
        break;
      }

      case "set_corpus_config": {
        if (!roomCode) return;
        const room = await this.store.get(roomCode);
        if (!room || room.hostId !== playerId) return;
        if (room.state !== "lobby" && room.state !== "finished") return;

        room.corpusType = message.corpusType;
        room.corpusCategory = message.corpusCategory;
        await this.store.set(roomCode, room);

        await this.bridge.publishToGateway({
          type: "broadcast_to_room",
          roomCode,
          payload: buildLobbyStateFrame(room),
        });
        break;
      }

      case "start_race": {
        if (this.draining) {
          void this.bridge.publishToGateway({
            type: "send_to_client",
            playerId,
            payload: { type: "error", code: "SERVER_SHUTTING_DOWN", message: "Server is shutting down" },
          });
          return;
        }
        if (!roomCode) return;
        const room = await this.store.get(roomCode);
        if (!room || room.hostId !== playerId) {
          await this.bridge.publishToGateway({
            type: "send_to_client",
            playerId,
            payload: {
              type: "error",
              code: "NOT_IN_ROOM",
              message: "host-only or not in room",
            },
          });
          return;
        }

        if (room.state !== "lobby" && room.state !== "finished") return;
        if (room.state === "finished") {
          try {
            transition(room, "lobby");
          } catch {
            return;
          }
        }

        if (message.corpusType) room.corpusType = message.corpusType;
        if (message.corpusCategory) room.corpusCategory = message.corpusCategory;

        let passageId: string;
        let passageText: string;
        let preview: string;

        if (message.passageId !== undefined) {
          if (!isValidPassageId(message.passageId)) {
            await this.bridge.publishToGateway({
              type: "send_to_client",
              playerId,
              payload: {
                type: "error",
                code: "INVALID_FRAME",
                message: "unknown passageId",
              },
            });
            return;
          }
          const passage = getPassageById(message.passageId);
          if (!passage) return;
          passageId = passage.id;
          passageText = passage.text;
          preview = hostPickedPreview(passage);
        } else {
          const corpus = getRandomCorpus(
            room.corpusType ?? "passage",
            room.corpusCategory ?? "mid",
            room.lastPassageId ?? undefined,
          );
          passageId = corpus.id;
          passageText = corpus.text;
          preview = hostPickedPreview(corpus);
        }

        try {
          transition(room, "countdown");
        } catch {
          return;
        }

        room.passageId = passageId;
        room.passageText = passageText;
        room.graceSeconds = message.graceSeconds;
        room.hostPickedPassagePreview = preview;
        room.lastPassageId = passageId;
        room.usedPassageIds.add(passageId);
        await this.store.set(roomCode, room);

        const countdownFrame = buildCountdownFrame(room.startsAtServerMs!, 3);
        await this.bridge.publishToGateway({
          type: "broadcast_to_room",
          roomCode,
          payload: countdownFrame,
        });
        break;
      }

      case "keystroke": {
        if (!roomCode) {
          await this.bridge.publishToGateway({
            type: "send_to_client",
            playerId,
            payload: { type: "error", code: "NOT_IN_ROOM", message: "no room" },
          });
          return;
        }
        const room = await this.store.get(roomCode);
        if (!room || !room.passageText) {
          await this.bridge.publishToGateway({
            type: "send_to_client",
            playerId,
            payload: { type: "error", code: "NOT_IN_ROOM", message: "no active race" },
          });
          return;
        }
        const player = room.players.get(playerId);
        if (!player) {
          await this.bridge.publishToGateway({
            type: "send_to_client",
            playerId,
            payload: { type: "error", code: "NOT_IN_ROOM", message: "not in room" },
          });
          return;
        }

        const result = validateKeystroke({
          room,
          player,
          frame: message,
          passageText: room.passageText,
          now: serverTs,
        });

        if (!result.ok) {
          await this.bridge.publishToGateway({
            type: "send_to_client",
            playerId,
            payload: {
              type: "error",
              code: result.reason,
              message: "keystroke rejected",
            },
          });
          return;
        }

        await this.store.set(roomCode, room);

        const cursorFrame = buildCursorUpdateFrame(player, serverTs);
        await this.bridge.publishToGateway({
          type: "broadcast_to_room",
          roomCode,
          payload: cursorFrame,
          excludePlayerId: player.playerId,
        });

        if (
          player.finishedAtServerMs !== null &&
          (room.state === "racing" || room.state === "grace")
        ) {
          await this.controller.tick(serverTs);
        }
        break;
      }

      case "cursor_position": {
        if (!roomCode) return;
        const room = await this.store.get(roomCode);
        if (!room || room.state !== "racing") return;
        const player = room.players.get(playerId);
        if (!player) return;

        if (serverTs - player.lastCursorAtMs < 100) return;
        player.lastCursorAtMs = serverTs;
        await this.store.set(roomCode, room);

        await this.bridge.publishToGateway({
          type: "broadcast_to_room",
          roomCode,
          payload: {
            type: "cursor_update",
            playerId: player.playerId,
            index: player.progress,
            serverTs,
          },
          excludePlayerId: player.playerId,
        });
        break;
      }

      case "correction": {
        if (!roomCode) return;
        const room = await this.store.get(roomCode);
        if (!room || (room.state !== "racing" && room.state !== "grace")) return;
        const player = room.players.get(playerId);
        if (!player || !room.passageText || player.finishedAtServerMs !== null) return;

        const newProgress = Math.max(0, player.progress - message.backspaces);
        for (let i = newProgress; i < player.progress; i++) {
          player.charStates[i] = "pending";
        }
        player.progress = newProgress;
        player.lastKeystrokeAt = serverTs;
        await this.store.set(roomCode, room);

        const cursorFrame = buildCursorUpdateFrame(player, serverTs);
        await this.bridge.publishToGateway({
          type: "broadcast_to_room",
          roomCode,
          payload: cursorFrame,
          excludePlayerId: player.playerId,
        });
        await this.bridge.publishToGateway({
          type: "send_to_client",
          playerId: player.playerId,
          payload: cursorFrame,
        });
        break;
      }
    }
  }
}
