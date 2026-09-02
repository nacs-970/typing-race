/**
 * Decode + validate an inbound WS frame, then dispatch by `type`.
 * Invalid frames log a warning and are dropped — keeps the connection
 * open so devs can iterate without losing state.
 */
import { clientToServerSchema } from "@typing-race/shared";
import { logger } from "../logger.ts";
import { echoPing, type WsData } from "./handlers.ts";
import {
  createRoom,
  addPlayer,
  removePlayer,
  getRoom,
  findPlayerBySessionToken,
  rebindPlayerSocket,
  ipRateLimiter,
  rooms,
} from "../rooms/manager.ts";
import { transition } from "../race/controller.ts";
import { validateKeystroke } from "../race/validate-keystroke.ts";
import {
  broadcastToRoom,
  broadcastLobbyState,
  buildRejoinedRoomFrame,
  buildRaceEndFrame,
  broadcastPlayerReconnected,
} from "./broadcast.ts";
import { shuffle, dealNextPassage } from "../race/corpus.ts";
import { getPassageById, isValidPassageId, hostPickedPreview, PASSAGES } from "@typing-race/shared";
import type { Countdown, CursorUpdate } from "@typing-race/shared";

/**
 * Decode + validate an inbound WS frame, then dispatch by `type`.
 */
export function dispatch(
  ws: import("bun").ServerWebSocket<WsData>,
  raw: string | ArrayBuffer | Uint8Array,
): void {
  let text: string;
  if (typeof raw === "string") {
    text = raw;
  } else if (raw instanceof ArrayBuffer) {
    text = new TextDecoder().decode(new Uint8Array(raw));
  } else {
    text = new TextDecoder().decode(raw);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    logger.warn({ err, raw: text.slice(0, 200) }, "[ws] invalid JSON");
    return;
  }

  const result = clientToServerSchema.safeParse(parsed);
  if (!result.success) {
    logger.warn(
      { issues: result.error.issues, raw: text.slice(0, 200) },
      "[ws] frame failed schema validation",
    );
    return;
  }

  const msg = result.data;
  switch (msg.type) {
    case "ping":
      echoPing(ws, msg.clientTs);
      break;

    case "create_room": {
      const ip = ws.data.ip ?? "127.0.0.1";
      if (!ipRateLimiter.checkAndConsume(ip)) {
        ws.send(
          JSON.stringify({
            type: "error",
            code: "RATE_LIMITED",
            message: "Too many rooms created from this IP. Limit is 10 per hour.",
          }),
        );
        return;
      }
      if (ws.data.roomCode) {
        ws.send(
          JSON.stringify({
            type: "error",
            code: "ALREADY_IN_ROOM",
            message: "leave current room first",
          }),
        );
        return;
      }
      const { code } = createRoom(ws, msg.nickname);
      ws.data.roomCode = code;
      ws.data.nickname = msg.nickname;
      logger.info({ playerId: ws.data.playerId, code }, "[ws] create_room");
      break;
    }

    case "join_room": {
      if (ws.data.roomCode) {
        ws.send(
          JSON.stringify({
            type: "error",
            code: "ALREADY_IN_ROOM",
            message: "leave current room first",
          }),
        );
        return;
      }
      const r = addPlayer(msg.code, ws.data.playerId, msg.nickname, ws);
      if (!r.ok) {
        ws.send(
          JSON.stringify({ type: "error", code: r.code, message: r.code }),
        );
        return;
      }
      // Send joined_room to THIS client with their offset; lobby_state broadcast
      // already went out from addPlayer to everyone.
      ws.send(
        JSON.stringify({
          type: "joined_room",
          playerId: ws.data.playerId,
          sessionToken: r.player.sessionToken,
          roomCode: r.room.code,
          you: { nickname: msg.nickname, isHost: r.player.isHost },
          players: [...r.room.players.values()].map((p) => ({
            playerId: p.playerId,
            nickname: p.nickname,
            isHost: p.isHost,
            progress: p.progress,
          })),
          clockOffsetMs: ws.data.clientOffsetMs,
        }),
      );
      logger.info(
        { playerId: ws.data.playerId, code: msg.code },
        "[ws] join_room",
      );
      break;
    }

    case "rejoin_room": {
      const room = getRoom(msg.roomCode);
      if (!room) {
        ws.send(
          JSON.stringify({
            type: "error",
            code: "ROOM_NOT_FOUND",
            message: `room ${msg.roomCode} not found`,
          }),
        );
        return;
      }
      const player = findPlayerBySessionToken(msg.roomCode, msg.sessionToken);
      if (!player) {
        ws.send(
          JSON.stringify({
            type: "error",
            code: "SESSION_INVALID",
            message: "session token invalid for this room",
          }),
        );
        return;
      }
      rebindPlayerSocket(room, player, ws);
      logger.info(
        { playerId: player.playerId, roomCode: room.code },
        "[ws] rejoin_room successful",
      );
      broadcastPlayerReconnected(room, player);
      if (room.state === "lobby") {
        broadcastLobbyState(room);
      }
      if (
        room.state === "grace" &&
        room.graceEndsAtServerMs !== null &&
        Date.now() >= room.graceEndsAtServerMs
      ) {
        try {
          transition(room, "finished");
          broadcastToRoom(room, buildRaceEndFrame(room));
        } catch {
          // ignore
        }
      }
      ws.send(JSON.stringify(buildRejoinedRoomFrame(room, player)));
      if (room.state === "finished") {
        ws.send(JSON.stringify(buildRaceEndFrame(room)));
      }
      break;
    }

    case "leave_room": {
      if (!ws.data.roomCode) return;
      removePlayer(ws.data.roomCode, ws.data.playerId);
      ws.data.roomCode = null;
      logger.info({ playerId: ws.data.playerId }, "[ws] leave_room");
      break;
    }

    case "return_to_lobby": {
      const code = ws.data.roomCode;
      if (!code) return;
      const room = rooms.get(code);
      if (!room || room.hostId !== ws.data.playerId) return; // host only
      if (room.state !== "finished" && room.state !== "countdown") return;

      try {
        transition(room, "lobby");
      } catch {
        return;
      }
      
      broadcastToRoom(room, { type: "return_to_lobby" });
      broadcastLobbyState(room);
      break;
    }

    case "start_race": {
      const code = ws.data.roomCode;
      if (!code) return;
      const room = rooms.get(code);
      if (!room || room.hostId !== ws.data.playerId) {
        ws.send(
          JSON.stringify({
            type: "error",
            code: "NOT_IN_ROOM",
            message: "host-only or not in room",
          }),
        );
        return;
      }
      if (room.state !== "lobby" && room.state !== "finished") return;
      if (room.state === "finished") {
        try {
          // Internal FSM requires going through lobby before countdown
          transition(room, "lobby");
        } catch {
          return;
        }
      }

      // D-09: graceSeconds already validated by Zod (3-10, default 5)
      // Determine passage: explicit pick (D-01) or auto-deal for rematch (D-04)
      let passageId: string;
      if (msg.passageId !== undefined) {
        // D-01: validate host-picked passageId against corpus
        if (!isValidPassageId(msg.passageId)) {
          ws.send(
            JSON.stringify({
              type: "error",
              code: "INVALID_FRAME",
              message: "unknown passageId",
            }),
          );
          return;
        }
        passageId = msg.passageId;
      } else {
        // Rematch path: server auto-deals next passageId from D-04 no-repeat deck
        if (room.deckOrder.length === 0) {
          room.deckOrder = shuffle(PASSAGES.map((p) => p.id));
          room.deckCursor = 0;
        }
        const dealt = dealNextPassage({
          allPassageIds: PASSAGES.map((p) => p.id),
          deckOrder: room.deckOrder,
          deckCursor: room.deckCursor,
          lastPassageId: room.lastPassageId,
        });
        room.deckOrder = dealt.deckOrder as string[];
        room.deckCursor = dealt.deckCursor;
        passageId = dealt.passageId;
      }

      const passage = getPassageById(passageId);
      if (!passage) return;
      try {
        transition(room, "countdown");
      } catch {
        return;
      }
      // D-02: stash preview for non-host lobby view
      room.passageId = passage.id;
      room.passageText = passage.text;
      room.graceSeconds = msg.graceSeconds;
      room.hostPickedPassagePreview = hostPickedPreview(passage);
      // D-04: deck state — if empty, initialize on first race; if explicit pick out of order, do NOT advance deck (explicit pick is its own record)
      if (room.deckOrder.length === 0) {
        room.deckOrder = shuffle(PASSAGES.map((p) => p.id));
        room.deckCursor = 0;
      }
      room.lastPassageId = passage.id;
      room.usedPassageIds.add(passage.id);
      // Re-broadcast lobby_state with preview so joiners see it
      const frame: Countdown = {
        type: "countdown",
        startsAtServerMs: room.startsAtServerMs!,
        secondsRemaining: 3,
      };
      broadcastToRoom(room, frame);
      logger.info(
        {
          code,
          passageId: passage.id,
          graceSeconds: msg.graceSeconds,
          startsAtServerMs: room.startsAtServerMs,
        },
        "[ws] start_race",
      );
      break;
    }

    case "clock_sync": {
      // WS backup path; HTTP /api/clock-sync is primary.
      const t1 = Date.now();
      const t2 = Date.now();
      // ((t1 - t0) + (t2 - t3)) / 2
      ws.data.clientOffsetMs = ((t1 - msg.t0) + (t2 - msg.t3)) / 2;
      ws.send(
        JSON.stringify({
          type: "pong",
          clientTs: msg.t0,
          serverTs: t1,
        }),
      );
      break;
    }

    case "keystroke": {
      const code = ws.data.roomCode;
      if (!code) {
        ws.send(JSON.stringify({ type: "error", code: "NOT_IN_ROOM", message: "no room" }));
        return;
      }
      const room = rooms.get(code);
      if (!room || !room.passageText) {
        ws.send(JSON.stringify({ type: "error", code: "NOT_IN_ROOM", message: "no active race" }));
        return;
      }
      const player = room.players.get(ws.data.playerId);
      if (!player) {
        ws.send(JSON.stringify({ type: "error", code: "NOT_IN_ROOM", message: "not in room" }));
        return;
      }
      const result = validateKeystroke({
        room,
        player,
        frame: msg,
        passageText: room.passageText,
        now: Date.now(),
      });
      if (!result.ok) {
        ws.send(
          JSON.stringify({
            type: "error",
            code: result.reason,
            message: "keystroke rejected",
          }),
        );
        return;
      }
      // Accepted — broadcast cursor_update to OTHER players
      // index = player.progress (the next char to type), so opponents
      // see the cursor at the same place the typist sees their own.
      const cursorFrame: CursorUpdate = {
        type: "cursor_update",
        playerId: player.playerId,
        index: player.progress,
        serverTs: Date.now(),
        charStates: result.newCharStates,
        wpm: result.playerPatch.currentWpm,
      };
      for (const other of room.players.values()) {
        if (other.playerId === player.playerId) continue;
        try {
          other.wsRef.send(JSON.stringify(cursorFrame));
        } catch {
          // ignore — slow client
        }
      }
      break;
    }

    case "cursor_position": {
      const code = ws.data.roomCode;
      if (!code) return;
      const room = rooms.get(code);
      if (!room || room.state !== "racing") return; // silent drop
      const player = room.players.get(ws.data.playerId);
      if (!player) return;
      // Throttle at 10Hz (≥100ms)
      const now = Date.now();
      if (now - player.lastCursorAtMs < 100) return;
      player.lastCursorAtMs = now;
      const cursorFrame: CursorUpdate = {
        type: "cursor_update",
        playerId: player.playerId,
        index: player.progress,
        serverTs: now,
      };
      for (const other of room.players.values()) {
        if (other.playerId === player.playerId) continue;
        try {
          other.wsRef.send(JSON.stringify(cursorFrame));
        } catch {
          // ignore
        }
      }
      break;
    }

    case "correction": {
      const code = ws.data.roomCode;
      if (!code) return;
      const room = rooms.get(code);
      if (!room) return;
      if (room.state !== "racing" && room.state !== "grace") return;
      const player = room.players.get(ws.data.playerId);
      if (!player) return;
      if (!room.passageText) return;
      // Clamp to [0, progress]. Decrement by backspaces; cap to 0.
      const newProgress = Math.max(0, player.progress - msg.backspaces);
      // Revert char-states for the reverted range
      for (let i = newProgress; i < player.progress; i++) {
        player.charStates[i] = "pending";
      }
      player.progress = newProgress;
      // Update lastKeystrokeAt for cursor throttle
      player.lastKeystrokeAt = Date.now();
      // Broadcast cursor_update to OTHER players
      const cursorFrame: CursorUpdate = {
        type: "cursor_update",
        playerId: player.playerId,
        index: player.progress,
        serverTs: Date.now(),
        charStates: player.charStates,
        wpm: player.currentWpm,
      };
      for (const other of room.players.values()) {
        if (other.playerId === player.playerId) continue;
        try {
          other.wsRef.send(JSON.stringify(cursorFrame));
        } catch {
          // ignore
        }
      }
      // Echo to sender so their ownIndex / ownCharStates update
      try {
        ws.send(JSON.stringify(cursorFrame));
      } catch {
        // ignore
      }
      break;
    }

    default: {
      const _exhaustive: never = msg;
      void _exhaustive;
    }
  }
}