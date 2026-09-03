import React, { useMemo } from "react";
import type { PlayerFinalStats } from "@typing-race/shared";
import { ws } from "../net/ws.ts";
import { useConnectionStore } from "../store/connection.ts";
import { useRaceStore } from "../store/race.ts";

export interface ResultsBoardProps {
  results: PlayerFinalStats[];
  isHost: boolean;
  onRematch?: () => void;
  onReturnToLobby?: () => void;
  players?: Array<{ playerId: string; nickname: string }>;
}

export function ResultsBoard({
  results,
  isHost,
  onRematch,
  onReturnToLobby,
  players: propPlayers,
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
    return [...results].sort((a, b) => {
      if (a.finishTimeMs !== b.finishTimeMs) {
        return a.finishTimeMs - b.finishTimeMs;
      }
      return b.wpm - a.wpm; // WPM tiebreaker
    });
  }, [results]);

  if (results.length === 0) {
    return (
      <div className="results-board results-empty-state max-w-[800px] mx-auto p-6 rounded-xl border border-[#3c4626] bg-[#15180c] text-center font-mono text-[#fefbe6]">
        <h3 className="text-xl font-bold mb-2">Awaiting Race Finishers</h3>
        <p className="text-sm text-[#b5c48b] m-0">
          Complete the passage to view final standings, WPM, and accuracy metrics.
        </p>
      </div>
    );
  }

  const winnerTimeMs = ranked[0]?.finishTimeMs ?? 0;
  const countdownStartsAtServerMs = useRaceStore((s) => s.countdownStartsAtServerMs);

  const getElapsedMs = (rawMs: number): number => {
    if (rawMs > 1_000_000_000) {
      if (countdownStartsAtServerMs && countdownStartsAtServerMs > 0) {
        return Math.max(0, rawMs - countdownStartsAtServerMs);
      }
      return Math.max(0, rawMs - winnerTimeMs);
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

  const handleRematch = () => {
    ws.send({ type: "start_race", graceSeconds: 5 });
    onRematch?.();
  };

  const handleReturnToLobby = () => {
    ws.send({ type: "return_to_lobby" });
    onReturnToLobby?.();
  };

  return (
    <div
      className="results-board max-w-[800px] mx-auto p-6 rounded-xl border border-[#3c4626] bg-[#15180c] text-[#fefbe6] font-mono shadow-2xl"
      data-testid="results-board"
    >
      <div className="border-b border-[#3c4626] pb-4 mb-6">
        <h2 className="text-2xl font-bold m-0 tracking-tight">Race Results</h2>
        <p className="text-sm text-[#b5c48b] mt-1 mb-0">
          Final standings, speed, and precision metrics
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#3c4626] text-xs uppercase tracking-wider text-[#b5c48b]">
              <th className="py-2.5 px-3">Rank</th>
              <th className="py-2.5 px-3">Player</th>
              <th className="py-2.5 px-3">Time</th>
              <th className="py-2.5 px-3">Delta</th>
              <th className="py-2.5 px-3">WPM</th>
              <th className="py-2.5 px-3">Accuracy</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((r, i) => {
              const isMe = r.playerId === myId;
              const displayName =
                nicknameMap.get(r.playerId) ?? `${r.playerId.slice(0, 8)}…`;
              const deltaMs = r.finishTimeMs - winnerTimeMs;
              const deltaText =
                i === 0
                  ? "Winner"
                  : `+${(deltaMs / 1000).toFixed(1)}s`;

              let rankBadge: React.ReactNode;
              if (i === 0) {
                rankBadge = (
                  <span role="img" aria-label="1st Place" className="text-lg">
                    🥇
                  </span>
                );
              } else if (i === 1) {
                rankBadge = (
                  <span role="img" aria-label="2nd Place" className="text-lg">
                    🥈
                  </span>
                );
              } else if (i === 2) {
                rankBadge = (
                  <span role="img" aria-label="3rd Place" className="text-lg">
                    🥉
                  </span>
                );
              } else {
                rankBadge = <span className="font-bold text-[#b5c48b]">#{i + 1}</span>;
              }

              return (
                <tr
                  key={r.playerId}
                  className={`border-b border-[#3c4626]/40 transition-colors ${
                    isMe
                      ? "bg-[#cc6722]/15 border-[#cc6722]/50 font-bold"
                      : "hover:bg-[#12190b]/40"
                  }`}
                  data-testid="result-row"
                  data-player-id={r.playerId}
                >
                  <td className="py-3 px-3">{rankBadge}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate max-w-[150px]">{displayName}</span>
                      {isMe && (
                        <span className="text-[10px] text-[#cc6722] uppercase font-bold bg-[#cc6722]/10 px-1.5 py-0.5 rounded">
                          (You)
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-sm text-[#fefbe6]">
                    {formatTime(r.finishTimeMs)}
                  </td>
                  <td className="py-3 px-3 text-sm font-semibold">
                    {i === 0 ? (
                      <span className="text-[#87c38f] font-bold">Winner</span>
                    ) : (
                      <span className="text-[#cc6722]">{deltaText}</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-sm font-bold text-[#fefbe6]">
                    {r.wpm.toFixed(1)}
                  </td>
                  <td className="py-3 px-3 text-sm text-[#87c38f]">
                    {(r.accuracy * 100).toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isHost ? (
        <div className="flex flex-col sm:flex-row gap-3 mt-6 pt-4 border-t border-[#3c4626]">
          <button
            type="button"
            className="flex-1 py-3 px-4 rounded-lg text-sm font-bold bg-[#cc6722] text-[#12190b] hover:bg-[#d3813e] transition-colors shadow-md text-center"
            data-testid="rematch-button"
            onClick={handleRematch}
          >
            Play Again (Auto-deal Passage)
          </button>
          <button
            type="button"
            className="py-3 px-4 rounded-lg text-sm font-semibold bg-[#12190b] border border-[#3c4626] text-[#fefbe6] hover:bg-[#3c4626] transition-colors text-center"
            onClick={handleReturnToLobby}
          >
            Return to Lobby
          </button>
        </div>
      ) : (
        <div className="mt-6 pt-4 border-t border-[#3c4626] text-center text-xs text-[#b5c48b] italic">
          Waiting for host to start rematch or return to lobby…
        </div>
      )}
    </div>
  );
}