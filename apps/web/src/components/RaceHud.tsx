import React, { useEffect, useState, useMemo } from "react";
import type { TypingEngine, TypingStats } from "../core/typing-engine.ts";
import { useCursorStore } from "../store/cursor.ts";

export interface RaceHudProps {
  typingEngine?: TypingEngine;
  passageLength: number;
  players?: Array<{ playerId: string; progress: number }>;
  onLeaveRoom?: () => void;
}

export function RaceHud({
  typingEngine,
  passageLength,
  players: propPlayers,
  onLeaveRoom,
}: RaceHudProps): React.ReactElement {
  const [stats, setStats] = useState<TypingStats>({
    rawWpm: 0,
    netWpm: 0,
    accuracy: 1,
    uncorrectedErrors: 0,
  });
  const [engineIndex, setEngineIndex] = useState<number>(0);
  const [showTooltip, setShowTooltip] = useState<boolean>(false);
  const ownIndex = useCursorStore((s) => s.ownIndex);
  const cursors = useCursorStore((s) => s.cursors);

  useEffect(() => {
    if (!typingEngine) return;
    const unsubStats = typingEngine.subscribe("stats_updated", (newStats) => {
      setStats(newStats);
    });
    const unsubKey = typingEngine.subscribe("keystroke", (idx) => {
      setEngineIndex(idx + 1);
    });
    const unsubCorr = typingEngine.subscribe("correction", (count) => {
      setEngineIndex((prev) => Math.max(0, prev - count));
    });
    return () => {
      unsubStats();
      unsubKey();
      unsubCorr();
    };
  }, [typingEngine]);

  const currentProgress = Math.max(engineIndex, ownIndex);

  // Rank calculation against opponents
  const rank = useMemo(() => {
    let opponentProgresses: number[] = [];
    if (propPlayers) {
      opponentProgresses = propPlayers.map((p) => p.progress);
    } else {
      opponentProgresses = Array.from(cursors.values()).map((c) => c.index);
    }

    let higherCount = 0;
    for (const oppProg of opponentProgresses) {
      if (oppProg > currentProgress) {
        higherCount++;
      }
    }
    return higherCount + 1;
  }, [propPlayers, cursors, currentProgress]);

  const progressPercent = Math.min(
    100,
    Math.max(0, (currentProgress / Math.max(1, passageLength)) * 100),
  );

  const roundedNetWpm = Math.round(stats.netWpm);
  const roundedRawWpm = Math.round(stats.rawWpm);
  const accuracyPercent = (stats.accuracy * 100).toFixed(1);

  return (
    <div
      className="race-hud flex items-center justify-between mb-4 px-4 py-2.5 rounded-lg bg-[#15180c]/90 border border-[#3c4626] text-[#fefbe6] font-mono select-none"
      data-testid="race-hud"
    >
      {/* Net WPM with Hover/Focus Tooltip */}
      <div
        className="relative flex items-baseline gap-2 cursor-pointer group"
        data-testid="wpm-display"
        tabIndex={0}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
      >
        <span
          className="text-3xl font-bold text-[#fefbe6] tracking-tight leading-none"
          data-testid="net-wpm-value"
        >
          {roundedNetWpm}
        </span>
        <span className="text-xs uppercase font-bold text-[#b5c48b]">WPM</span>

        {/* Hover Popover Tooltip (D-18) */}
        {showTooltip && (
          <div
            className="absolute top-full left-0 mt-2 p-3 rounded-lg bg-[#070b04] border border-[#7e2a19]/60 shadow-2xl z-30 pointer-events-none min-w-[170px]"
            data-testid="wpm-tooltip"
          >
            <div className="text-[11px] uppercase tracking-wider text-[#b5c48b] font-bold border-b border-[#3c4626] pb-1.5 mb-2">
              Typing Breakdown
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-[#b5c48b]">Net WPM:</span>
                <span className="font-bold text-[#fefbe6]">{roundedNetWpm}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#b5c48b]">Raw WPM:</span>
                <span className="font-bold text-[#fefbe6]">{roundedRawWpm}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#b5c48b]">Accuracy:</span>
                <span className="font-bold text-[#87c38f]">{accuracyPercent}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#b5c48b]">Errors:</span>
                <span className="font-bold text-[#df6873]">
                  {stats.uncorrectedErrors}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Progress Bar Indicator */}
      <div className="flex-1 max-w-[240px] mx-6">
        <div className="flex justify-between text-[10px] text-[#b5c48b] uppercase font-bold mb-1">
          <span>Track</span>
          <span>{Math.round(progressPercent)}%</span>
        </div>
        <div
          className="w-full h-2 bg-[#12190b] rounded-full overflow-hidden border border-[#3c4626]"
          data-testid="progress-container"
        >
          <div
            className="h-full bg-[#cc6722] rounded-full transition-all duration-150"
            data-testid="progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Rank Badge Indicator & Leave Room */}
      <div className="flex items-center gap-2">
        <span
          className={`px-2.5 py-1 rounded text-xs font-bold transition-all shadow-sm ${
            rank === 1
              ? "bg-[#cc6722] text-[#12190b]"
              : "bg-[#3c4626] text-[#b5c48b]"
          }`}
          data-testid="rank-badge"
        >
          #{rank}
        </span>
        {onLeaveRoom && (
          <button
            type="button"
            className="px-2.5 py-1 rounded text-xs font-semibold bg-[#2a1315] border border-[#7f1d1d] hover:bg-[#7f1d1d] transition-colors text-[#fca5a5] cursor-pointer"
            onClick={onLeaveRoom}
            title="Leave Race Room"
          >
            Leave
          </button>
        )}
      </div>
    </div>
  );
}
