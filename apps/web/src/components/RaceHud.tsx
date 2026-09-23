import React, { useEffect, useState, useMemo, useCallback } from "react";
import type { TypingEngine, TypingStats } from "../core/typing-engine.ts";
import { useCursorStore } from "../store/cursor.ts";
import { useConfirmClick } from "./useConfirmClick.ts";

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

  const handleLeaveConfirmed = useCallback(() => {
    onLeaveRoom?.();
  }, [onLeaveRoom]);
  const { armed: leaveArmed, onClick: onLeaveClick } = useConfirmClick(handleLeaveConfirmed);

  return (
    <div
      className="race-hud flex items-center justify-between py-3.5 border-t border-b border-[var(--color-border-muted)] text-[var(--color-text-bright)] font-mono select-none"
      data-testid="race-hud"
    >
      {/* Net WPM with Hover/Focus Tooltip */}
      <div
        className="relative flex flex-col gap-1 cursor-pointer group"
        data-testid="wpm-display"
        tabIndex={0}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
      >
        <div className="flex items-baseline gap-2.5">
          <span
            className="font-serif-display text-[52px] leading-none text-[var(--color-text-bright)]"
            data-testid="net-wpm-value"
          >
            {roundedNetWpm}
          </span>
          <span className="label">wpm</span>
        </div>

        <div className="label" data-testid="accuracy-line">
          {`${accuracyPercent}%`}
        </div>

        {/* Hover Popover Tooltip (D-18) */}
        {showTooltip && (
          <div
            className="absolute top-full left-0 mt-2 p-3 bg-[var(--color-bg-surface)] border border-[var(--color-border-muted)] z-30 pointer-events-none min-w-[170px]"
            data-testid="wpm-tooltip"
          >
            <div className="label border-b border-[var(--color-border-muted)] pb-1.5 mb-2">
              Typing Breakdown
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Net WPM:</span>
                <span className="font-bold text-[var(--color-text-bright)]">{roundedNetWpm}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Raw WPM:</span>
                <span className="font-bold text-[var(--color-text-bright)]">{roundedRawWpm}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Accuracy:</span>
                <span className="font-bold text-[var(--color-text-bright)]">{accuracyPercent}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Errors:</span>
                <span className="font-bold text-[var(--color-status-danger)]">
                  {stats.uncorrectedErrors}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Progress Bar Indicator */}
      <div className="flex-1 max-w-[280px] mx-6 flex flex-col gap-2">
        <div className="flex justify-between label">
          <span>Track</span>
          <span>{Math.round(progressPercent)}%</span>
        </div>
        <div
          className="h-px bg-[var(--color-border-muted)] relative"
          data-testid="progress-container"
        >
          <div
            className="absolute left-0 -top-px h-[3px] bg-[var(--color-accent-green)] transition-all duration-150"
            data-testid="progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Rank Badge Indicator & Leave Room */}
      <div className="flex items-baseline gap-6">
        <span
          className={`font-serif-display text-[30px] leading-none ${
            rank === 1 ? "text-[var(--color-accent-green)]" : "text-[var(--color-text-bright)]"
          }`}
          data-testid="rank-badge"
        >
          #{rank}
        </span>
        {onLeaveRoom && (
          <button
            type="button"
            className={`bg-transparent border-0 p-0 text-sm text-[var(--color-status-danger)] underline underline-offset-4 cursor-pointer font-mono ${
              leaveArmed ? "font-bold" : ""
            }`}
            onClick={onLeaveClick}
            title="Leave Race Room"
          >
            <span aria-live="polite">{leaveArmed ? "Leave?" : "Leave."}</span>
          </button>
        )}
      </div>
    </div>
  );
}
