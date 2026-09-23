import React, { useCallback, useMemo } from "react";
import type { PlayerFinalStats } from "@typing-race/shared";
import { ws } from "../net/ws.ts";
import { useConnectionStore } from "../store/connection.ts";
import { useRaceStore } from "../store/race.ts";
import { useConfirmClick } from "./useConfirmClick.ts";

/**
 * Score dominates any wpm*accuracy product for a player who didn't finish
 * the passage, so finishers always outrank DNFs regardless of their partial
 * wpm/accuracy at grace-timeout. wpm is capped well under 1000 by the
 * server's anti-cheat keystroke-rate floor (see README), so 1000 is a safe
 * margin.
 */
const FINISH_BONUS = 1000;

export interface ResultsBoardProps {
  results: PlayerFinalStats[];
  /** Omitted = treat everyone as finished (matches the "all finished" race-end case). */
  finishedPlayerIds?: string[];
  isHost: boolean;
  onRematch?: () => void;
  onReturnToLobby?: () => void;
  onLeaveRoom?: () => void;
  players?: Array<{ playerId: string; nickname: string }>;
}

export function ResultsBoard({
  results,
  isHost,
  onRematch,
  onReturnToLobby,
  onLeaveRoom,
  players: propPlayers,
  finishedPlayerIds,
}: ResultsBoardProps): React.ReactElement {
  const myId = useConnectionStore((s) => s.playerId);
  const lobbyPlayers = useRaceStore((s) => s.lobbyPlayers);

  const nicknameMap = useMemo(() => {
    const map = new Map<string, string>();
    const source = propPlayers ?? lobbyPlayers;
    for (const p of source) {
      map.set(p.playerId, p.nickname);
    }
    return map;
  }, [propPlayers, lobbyPlayers]);

  const ranked = useMemo(() => {
    const score = (r: PlayerFinalStats): number => {
      const finished = finishedPlayerIds === undefined || finishedPlayerIds.includes(r.playerId);
      return r.wpm * r.accuracy + (finished ? FINISH_BONUS : 0);
    };
    return [...results].sort((a, b) => score(b) - score(a));
  }, [results, finishedPlayerIds]);

  const getRankLabel = (i: number): string => {
    if (i === 0) return "1st Place";
    if (i === 1) return "2nd Place";
    if (i === 2) return "3rd Place";
    return `${i + 1}th Place`;
  };

  if (results.length === 0) {
    return (
      <div className="results-board results-empty-state w-full max-w-[860px] mx-auto py-8 text-center font-mono text-[var(--color-text-bright)] border-t border-b border-[var(--color-border-muted)]">
        <h3 className="text-xl font-normal font-serif-display mb-2">Awaiting Race Finishers</h3>
        <p className="text-sm italic text-[var(--color-text-muted)] m-0">
          Complete the passage to view final standings, WPM, and accuracy metrics.
        </p>
      </div>
    );
  }

  /**
   * Rank #1 is the top-SCORE player (wpm*accuracy + finish bonus), not
   * necessarily the fastest finisher — a slower, higher-wpm*accuracy player
   * can outrank a faster one. "Fastest time" and "top rank" are therefore
   * different players; deltas must anchor to the fastest finisher's time,
   * never to ranked[0]'s time, or an actually-faster finisher would show a
   * negative delta ("+-Ns") against a slower #1.
   */
  const finisherTimes = results
    .filter((r) => finishedPlayerIds === undefined || finishedPlayerIds.includes(r.playerId))
    .map((r) => r.finishTimeMs);
  const fastestFinishMs = finisherTimes.length > 0 ? Math.min(...finisherTimes) : 0;
  const countdownStartsAtServerMs = useRaceStore((s) => s.countdownStartsAtServerMs);

  const getElapsedMs = (rawMs: number): number => {
    if (rawMs > 1_000_000_000) {
      if (countdownStartsAtServerMs && countdownStartsAtServerMs > 0) {
        return Math.max(0, rawMs - countdownStartsAtServerMs);
      }
      return Math.max(0, rawMs - fastestFinishMs);
    }
    return rawMs;
  };

  const formatTime = (rawMs: number): string => {
    const ms = getElapsedMs(rawMs);
    const totalSeconds = ms / 1000;
    if (totalSeconds < 60) {
      return `${totalSeconds.toFixed(1)}s`;
    }
    const mins = Math.floor(totalSeconds / 60);
    const secs = (totalSeconds % 60).toFixed(1).padStart(4, "0");
    return `${mins}:${secs}`;
  };

  const corpusType = useRaceStore((s) => s.corpusType ?? "passage");
  const corpusCategory = useRaceStore((s) => s.corpusCategory ?? "mid");
  const typeLabel = corpusType === "random_words" ? "Random Words" : "Passage";
  const catLabel = corpusCategory.charAt(0).toUpperCase() + corpusCategory.slice(1);

  const handleRematch = () => {
    ws.send({
      type: "start_race",
      graceSeconds: useRaceStore.getState().graceSeconds,
      corpusType,
      corpusCategory,
    });
    onRematch?.();
  };

  const handleReturnToLobby = () => {
    ws.send({ type: "return_to_lobby" });
    onReturnToLobby?.();
  };

  const handleLeaveConfirmed = useCallback(() => {
    onLeaveRoom?.();
  }, [onLeaveRoom]);
  const { armed: leaveArmed, onClick: onLeaveClick } = useConfirmClick(handleLeaveConfirmed);

  return (
    <div
      className="results-board w-full max-w-[860px] mx-auto text-[var(--color-text-bright)] font-mono text-left"
      data-testid="results-board"
    >
      <div className="flex justify-between label pb-2.5 border-b border-[var(--color-border-muted)]">
        <span>{typeLabel} · {catLabel}</span>
      </div>

      <h2 className="mt-9 m-0 font-serif-display font-normal text-[88px] leading-none text-[var(--color-text-bright)]">
        Results
      </h2>
      <p className="mt-3 mb-7 italic text-[15px] text-[var(--color-text-muted)]">
        Final standings, speed and precision.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-mono text-base tabular-nums">
          <thead>
            <tr className="border-t border-[var(--color-text-bright)] border-b border-[var(--color-border-muted)]">
              <th className="text-left py-2.5 px-3 label font-normal">Rank</th>
              <th className="text-left py-2.5 px-3 label font-normal">Player</th>
              <th className="text-right py-2.5 px-3 label font-normal">Time</th>
              <th className="text-right py-2.5 px-3 label font-normal">Delta</th>
              <th className="text-right py-2.5 px-3 label font-normal">WPM</th>
              <th className="text-right py-2.5 px-3 label font-normal">Accuracy</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((r, i) => {
              const isMe = r.playerId === myId;
              const displayName =
                nicknameMap.get(r.playerId) ?? `${r.playerId.slice(0, 8)}…`;
              const isFastest = r.finishTimeMs === fastestFinishMs;
              const deltaMs = r.finishTimeMs - fastestFinishMs;
              const deltaText = isFastest ? "Fastest" : `+${(deltaMs / 1000).toFixed(1)}s`;
              const rankLabel = getRankLabel(i);

              return (
                <tr
                  key={r.playerId}
                  className={`border-b border-[var(--color-border-subtle)] ${
                    isMe
                      ? "bg-[color-mix(in_srgb,var(--color-accent-green)_8%,transparent)] font-bold shadow-[inset_2px_0_0_var(--color-accent-green)]"
                      : ""
                  }`}
                  data-testid="result-row"
                  data-player-id={r.playerId}
                >
                  <td
                    className="py-3.5 px-3 font-serif-display text-[22px] font-normal"
                    aria-label={rankLabel}
                  >
                    No. {i + 1}
                  </td>
                  <td className="py-3.5 px-3">
                    <span className="truncate max-w-[150px] inline-block align-middle">{displayName}</span>
                    {isMe && (
                      <span className="italic font-normal text-[var(--color-text-muted)] text-sm ml-1.5 align-middle">
                        (You)
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    {formatTime(r.finishTimeMs)}
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    {i === 0 ? (
                      <span className="text-[var(--color-accent-green)] font-bold">Winner</span>
                    ) : (
                      <span>{deltaText}</span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    {r.wpm.toFixed(1)}
                  </td>
                  <td className="py-3.5 px-3 text-right text-[var(--color-text-bright)]">
                    {(r.accuracy * 100).toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isHost ? (
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 mt-9 pt-5 border-t border-[var(--color-border-muted)]">
          <button
            type="button"
            className="flex-grow font-mono text-base font-bold tracking-[0.04em] bg-[var(--color-accent-green)] hover:bg-[var(--color-accent-green-hover)] text-[var(--color-bg-base)] border border-[var(--color-accent-green)] rounded-none py-3.5 px-4 cursor-pointer transition-colors"
            data-testid="rematch-button"
            onClick={handleRematch}
          >
            Play Again ({typeLabel} - {catLabel})
          </button>
          <button
            type="button"
            className="font-mono text-base font-bold tracking-[0.04em] bg-transparent text-[var(--color-text-bright)] border border-[var(--color-text-bright)] hover:bg-[var(--color-bg-surface-hover)] rounded-none py-3.5 px-5 cursor-pointer transition-colors whitespace-nowrap"
            onClick={handleReturnToLobby}
          >
            Return to Lobby
          </button>
          {onLeaveRoom && (
            <button
              type="button"
              className={`font-mono text-sm bg-transparent border-0 py-0 px-2 text-[var(--color-status-danger)] underline underline-offset-4 cursor-pointer hover:opacity-80 transition-opacity whitespace-nowrap ${
                leaveArmed ? "font-bold" : ""
              }`}
              onClick={onLeaveClick}
            >
              <span aria-live="polite">{leaveArmed ? "Sure? Leave room" : "Leave room"}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-4 mt-9 pt-5 border-t border-[var(--color-border-muted)]">
          <span className="italic text-sm text-[var(--color-text-muted)]">
            Waiting for host to start rematch or return to lobby…
          </span>
          {onLeaveRoom && (
            <button
              type="button"
              className={`font-mono text-sm bg-transparent border-0 py-0 px-2 text-[var(--color-status-danger)] underline underline-offset-4 cursor-pointer hover:opacity-80 transition-opacity whitespace-nowrap ${
                leaveArmed ? "font-bold" : ""
              }`}
              onClick={onLeaveClick}
            >
              <span aria-live="polite">{leaveArmed ? "Sure? Leave room" : "Leave room"}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}