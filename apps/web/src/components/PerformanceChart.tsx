import React from "react";
import type { PlayerFinalStats } from "@typing-race/shared";

export interface PerformanceChartProps {
  /** Already ranked winner-first (index 0 = winner). */
  ranked: PlayerFinalStats[];
  nicknameMap: Map<string, string>;
  myId: string | null;
}

interface BarRowProps {
  playerId: string;
  label: string;
  isMe: boolean;
  isWinner: boolean;
  value: number;
  maxValue: number;
  valueText: string;
}

function BarRow({ label, isMe, isWinner, value, maxValue, valueText }: BarRowProps): React.ReactElement {
  const pct = maxValue > 0 ? Math.max(2, (value / maxValue) * 100) : 2;
  return (
    <div className="flex items-center gap-2">
      <span
        className={`w-[88px] shrink-0 truncate text-xs ${
          isMe ? "font-bold text-[var(--color-accent-clay)]" : "text-[var(--color-text-muted)]"
        }`}
      >
        {label}
        {isMe && " (You)"}
      </span>
      <div className="flex-1 h-5 bg-[var(--color-bg-base)] rounded-[4px] overflow-hidden">
        <div
          className={`h-full rounded-r-[4px] transition-[width] duration-300 ${
            isWinner ? "bg-[var(--color-status-success)]" : "bg-[var(--color-olive-leaf-300)]"
          }`}
          style={{ width: `${pct}%` }}
          title={valueText}
        />
      </div>
      <span className="w-14 shrink-0 text-right text-xs font-semibold tabular-nums text-[var(--color-text-bright)]">
        {valueText}
      </span>
    </div>
  );
}

export function PerformanceChart({ ranked, nicknameMap, myId }: PerformanceChartProps): React.ReactElement | null {
  if (ranked.length === 0) return null;

  const maxWpm = Math.max(...ranked.map((r) => r.wpm));
  const maxAccuracy = Math.max(...ranked.map((r) => r.accuracy * 100));
  const winnerId = ranked[0]?.playerId;

  const labelFor = (playerId: string): string => nicknameMap.get(playerId) ?? `${playerId.slice(0, 8)}…`;

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6 pt-4 border-t border-[var(--color-border-subtle)]"
      data-testid="performance-chart"
    >
      <div>
        <h3 className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2">WPM</h3>
        <div className="flex flex-col gap-1.5">
          {ranked.map((r) => (
            <BarRow
              key={r.playerId}
              playerId={r.playerId}
              label={labelFor(r.playerId)}
              isMe={r.playerId === myId}
              isWinner={r.playerId === winnerId}
              value={r.wpm}
              maxValue={maxWpm}
              valueText={r.wpm.toFixed(1)}
            />
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Accuracy</h3>
        <div className="flex flex-col gap-1.5">
          {ranked.map((r) => (
            <BarRow
              key={r.playerId}
              playerId={r.playerId}
              label={labelFor(r.playerId)}
              isMe={r.playerId === myId}
              isWinner={r.playerId === winnerId}
              value={r.accuracy * 100}
              maxValue={maxAccuracy}
              valueText={`${(r.accuracy * 100).toFixed(1)}%`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
