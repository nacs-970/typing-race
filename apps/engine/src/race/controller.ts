import type { RaceState } from "@typing-race/shared";
import type { Room } from "./types.ts";
import type { RoomStore } from "../rooms/store.ts";
import type { RoomManager } from "../rooms/manager.ts";
import type { EventBridge } from "@typing-race/shared/bridge";
import {
  buildRaceStartFrame,
  buildRaceEndFrame,
  buildGraceCountdownFrame,
} from "./frames.ts";
import { logger } from "../logger.ts";

export const COUNTDOWN_DURATION_MS = 3_000;

const ALLOWED: Record<RaceState, ReadonlyArray<RaceState>> = {
  lobby: ["countdown"],
  countdown: ["racing", "lobby"],
  racing: ["grace", "finished"],
  grace: ["finished"],
  finished: ["lobby"],
};

export class InvalidTransitionError extends Error {
  constructor(from: RaceState, to: RaceState) {
    super(`invalid FSM transition: ${from} → ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export function transition(room: Room, target: RaceState): void {
  const from = room.state;
  if (!ALLOWED[from].includes(target)) {
    throw new InvalidTransitionError(from, target);
  }
  room.state = target;
  room.lastActivityAt = Date.now();

  if (target === "countdown") {
    room.startsAtServerMs = Date.now() + COUNTDOWN_DURATION_MS;
    room.firstFinisherId = null;
    room.graceEndsAtServerMs = null;
    for (const player of room.players.values()) {
      player.charStates = [];
      player.progress = 0;
      player.totalKeystrokes = 0;
      player.uncorrectedErrors = 0;
      player.currentWpm = 0;
      player.lastKeystrokeAt = 0;
      player.lastCursorAtMs = 0;
      player.finishedAtServerMs = null;
    }
  }

  if (target === "lobby") {
    room.passageId = null;
    room.passageText = null;
    room.startsAtServerMs = null;
    room.firstFinisherId = null;
    room.graceEndsAtServerMs = null;
    room.hostPickedPassagePreview = null;
    for (const player of room.players.values()) {
      player.charStates = [];
      player.progress = 0;
      player.totalKeystrokes = 0;
      player.uncorrectedErrors = 0;
      player.currentWpm = 0;
      player.lastKeystrokeAt = 0;
      player.lastCursorAtMs = 0;
      player.finishedAtServerMs = null;
      player.isReady = player.isHost;
    }
  }
}

export class RaceController {
  constructor(
    public store: RoomStore,
    public bridge: EventBridge,
    public roomManager: RoomManager,
  ) {}

  async tick(now: number = Date.now()): Promise<void> {
    const rooms = await this.store.list();
    for (const room of rooms) {
      if (
        room.state === "countdown" &&
        room.startsAtServerMs !== null &&
        now >= room.startsAtServerMs
      ) {
        try {
          transition(room, "racing");
        } catch {
          // ignore
        }
        logger.info({ code: room.code }, "[race] started");
        const frame = buildRaceStartFrame(
          room.startsAtServerMs,
          room.passageId!,
          room.passageText!,
        );
        await this.bridge.publishToGateway({
          type: "broadcast_to_room",
          roomCode: room.code,
          payload: frame,
        });
        await this.store.set(room.code, room);
        continue;
      }

      // Racing -> grace when FIRST player finishes
      if (room.state === "racing" && room.firstFinisherId === null) {
        const firstFinisher = [...room.players.values()].find(
          (p) => p.finishedAtServerMs !== null,
        );
        if (firstFinisher) {
          const anyoneStillTyping = [...room.players.values()].some(
            (p) => p.disconnectedAt === null && p.finishedAtServerMs === null,
          );
          if (!anyoneStillTyping) {
            try {
              transition(room, "finished");
            } catch {
              // ignore
            }
            logger.info({ code: room.code, reason: "all_finished" }, "[race] ended");
            await this.bridge.publishToGateway({
              type: "broadcast_to_room",
              roomCode: room.code,
              payload: buildRaceEndFrame(room, now),
            });
            await this.store.set(room.code, room);
            continue;
          }

          try {
            transition(room, "grace");
          } catch {
            // ignore
          }
          room.firstFinisherId = firstFinisher.playerId;
          room.graceEndsAtServerMs = now + room.graceSeconds * 1000;
          logger.info(
            {
              code: room.code,
              firstFinisherId: firstFinisher.playerId,
              graceSeconds: room.graceSeconds,
            },
            "[race] grace started",
          );
          const graceFrame = buildGraceCountdownFrame(room, now);
          if (graceFrame) {
            await this.bridge.publishToGateway({
              type: "broadcast_to_room",
              roomCode: room.code,
              payload: graceFrame,
            });
          }
          await this.store.set(room.code, room);
          continue;
        }
      }

      // Grace -> finished when (a) no one is still typing OR (b) timer expired
      if (room.state === "grace") {
        const anyoneStillTyping = [...room.players.values()].some(
          (p) => p.disconnectedAt === null && p.finishedAtServerMs === null,
        );
        const expired =
          room.graceEndsAtServerMs !== null && now >= room.graceEndsAtServerMs;
        if (!anyoneStillTyping || expired) {
          try {
            transition(room, "finished");
          } catch {
            // ignore
          }
          logger.info(
            {
              code: room.code,
              reason: !anyoneStillTyping ? "all_finished" : "grace_expired",
            },
            "[race] ended",
          );
          await this.bridge.publishToGateway({
            type: "broadcast_to_room",
            roomCode: room.code,
            payload: buildRaceEndFrame(room, now),
          });
          await this.store.set(room.code, room);
          continue;
        }
      }

      // Phase 4: Evict players whose 60s disconnect grace period expired
      for (const player of [...room.players.values()]) {
        if (
          player.disconnectedAt !== null &&
          now - player.disconnectedAt >= 60_000
        ) {
          logger.info(
            { playerId: player.playerId, roomCode: room.code },
            "[controller] disconnect grace expired — evicting player",
          );
          await this.roomManager.removePlayer(room.code, player.playerId);
        }
      }
    }
  }
}
