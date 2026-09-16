import type {
  JoinedRoom,
  LobbyState,
  PlayerLeft,
  RaceStart,
  RaceEnd,
  GraceCountdown,
  PlayerFinalStats,
  RejoinedRoom,
  PlayerDisconnected,
  PlayerReconnected,
  CursorUpdate,
  Countdown,
} from "@typing-race/shared";
import type { Room, Player, CharState } from "./types.ts";
import { computeAccuracy, countCorrectChars, aggregateWordCorrectness } from "./scoring.ts";

export function buildLobbyStateFrame(room: Room): LobbyState {
  const players = [...room.players.values()].map((p) => ({
    playerId: p.playerId,
    nickname: p.nickname,
    isHost: p.isHost,
    progress: p.progress,
    isReady: p.isReady ?? false,
  }));
  return {
    type: "lobby_state",
    roomCode: room.code,
    players,
    hostPickedPassagePreview: room.hostPickedPassagePreview ?? undefined,
    corpusType: room.corpusType,
    corpusCategory: room.corpusCategory,
  };
}

export function buildJoinedRoomFrame(room: Room, target: Player): JoinedRoom {
  const players = [...room.players.values()].map((p) => ({
    playerId: p.playerId,
    nickname: p.nickname,
    isHost: p.isHost,
    progress: p.progress,
    isReady: p.isReady ?? false,
  }));
  return {
    type: "joined_room",
    playerId: target.playerId,
    sessionToken: target.sessionToken,
    roomCode: room.code,
    you: { nickname: target.nickname, isHost: target.isHost },
    players,
    clockOffsetMs: target.clientOffsetMs,
    hostPickedPassagePreview: room.hostPickedPassagePreview ?? undefined,
    corpusType: room.corpusType,
    corpusCategory: room.corpusCategory,
  };
}

export function buildPlayerLeftFrame(playerId: string): PlayerLeft {
  return { type: "player_left", playerId };
}

export function buildRaceStartFrame(
  startsAtServerMs: number,
  passageId: string,
  passageText: string,
): RaceStart {
  return {
    type: "race_start",
    startsAtServerMs,
    passageId,
    passageText,
  };
}

export function buildCountdownFrame(
  startsAtServerMs: number,
  secondsRemaining: number,
): Countdown {
  return {
    type: "countdown",
    startsAtServerMs,
    secondsRemaining,
  };
}

export function buildRaceEndFrame(room: Room, now: number = Date.now()): RaceEnd {
  const raceStartMs = room.startsAtServerMs ?? now;
  const results: PlayerFinalStats[] = [...room.players.values()].map((p) => {
    const correctChars = countCorrectChars(p.charStates);
    const rawFinishMs = p.finishedAtServerMs ?? now;
    const finishTimeMs = Math.max(0, rawFinishMs - raceStartMs);
    return {
      playerId: p.playerId,
      finishTimeMs,
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

export function buildGraceCountdownFrame(
  room: Room,
  now: number = Date.now(),
): GraceCountdown | null {
  if (room.firstFinisherId === null || room.graceEndsAtServerMs === null) {
    return null;
  }
  const leader = room.players.get(room.firstFinisherId);
  if (!leader) return null;
  return {
    type: "grace_countdown",
    remainingMs: Math.max(0, room.graceEndsAtServerMs - now),
    leaderPlayerId: room.firstFinisherId,
    leaderNickname: leader.nickname,
  };
}

export function buildCursorUpdateFrame(
  player: Player,
  passageText: string | null,
  serverTs: number = Date.now(),
): CursorUpdate {
  return {
    type: "cursor_update",
    playerId: player.playerId,
    index: player.progress,
    serverTs,
    charStates: player.charStates,
    wpm: player.currentWpm,
    words: passageText ? aggregateWordCorrectness(passageText, player.charStates).map(({ start, end, correct }) => ({ start, end, correct })) : [],
  };
}

export function buildRejoinedRoomFrame(room: Room, player: Player): RejoinedRoom {
  const isLobby = room.state === "lobby";
  const isFinished = room.state === "finished";
  const sanitizeCharStates = (charStates: CharState[], progress: number) =>
    charStates.map((st, i) => (i < progress && st === "pending" ? ("error" as const) : st));

  const computeWords = (charStates: CharState[]) =>
    room.passageText && !isLobby
      ? aggregateWordCorrectness(room.passageText, charStates).map(({ start, end, correct }) => ({ start, end, correct }))
      : [];

  return {
    type: "rejoined_room",
    roomCode: room.code,
    roomState: room.state,
    passageId: isLobby ? null : room.passageId,
    passageText: isLobby ? null : room.passageText,
    startsAtServerMs: isLobby || isFinished ? null : room.startsAtServerMs,
    graceEndsAtServerMs: isLobby || isFinished ? null : room.graceEndsAtServerMs,
    clockOffsetMs: player.clientOffsetMs,
    corpusType: room.corpusType,
    corpusCategory: room.corpusCategory,
    you: {
      playerId: player.playerId,
      nickname: player.nickname,
      isHost: player.isHost,
      progress: player.progress,
      charStates: sanitizeCharStates(player.charStates, player.progress),
      wpm: player.currentWpm,
      uncorrectedErrors: player.uncorrectedErrors,
      words: computeWords(player.charStates),
    },
    players: [...room.players.values()].map((p) => ({
      playerId: p.playerId,
      nickname: p.nickname,
      isHost: p.isHost,
      progress: p.progress,
      charStates: sanitizeCharStates(p.charStates, p.progress),
      wpm: p.currentWpm,
      isDisconnected: p.disconnectedAt !== null,
      words: computeWords(p.charStates),
    })),
  };
}

export function buildPlayerDisconnectedFrame(
  player: Player,
  timeoutMs: number = 60_000,
): PlayerDisconnected {
  return {
    type: "player_disconnected",
    playerId: player.playerId,
    nickname: player.nickname,
    timeoutMs,
  };
}

export function buildPlayerReconnectedFrame(player: Player): PlayerReconnected {
  return {
    type: "player_reconnected",
    playerId: player.playerId,
    nickname: player.nickname,
  };
}
