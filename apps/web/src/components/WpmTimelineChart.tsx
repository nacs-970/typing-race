import React from "react";
import type { PlayerFinalStats } from "@typing-race/shared";

export interface WpmTimelineChartProps {
  /** Already ranked winner-first (index 0 = winner). */
  ranked: PlayerFinalStats[];
  nicknameMap: Map<string, string>;
  wpmHistory: Record<string, Array<{ t: number; wpm: number }>>;
}

const WIDTH = 600;
const HEIGHT = 160;
const PAD_RIGHT = 90; // room for the end-of-line nickname label

export function WpmTimelineChart({
  ranked,
  nicknameMap,
  wpmHistory,
}: WpmTimelineChartProps): React.ReactElement | null {
  const winnerId = ranked[0]?.playerId;
  const series = ranked
    .map((r) => ({ playerId: r.playerId, points: wpmHistory[r.playerId] ?? [] }))
    .filter((s) => s.points.length > 0);

  if (series.length === 0) return null;

  const maxT = Math.max(1, ...series.flatMap((s) => s.points.map((p) => p.t)));
  const maxWpm = Math.max(1, ...series.flatMap((s) => s.points.map((p) => p.wpm)));
  const plotWidth = WIDTH - PAD_RIGHT;

  const toXY = (t: number, wpm: number): [number, number] => [
    (t / maxT) * plotWidth,
    HEIGHT - (wpm / maxWpm) * HEIGHT,
  ];

  return (
    <div className="mt-6 pt-4 border-t border-[var(--color-border-subtle)]" data-testid="wpm-timeline-chart">
      <h3 className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2">WPM Over Time</h3>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto" role="img" aria-label="WPM over time per player">
        {series.map(({ playerId, points }) => {
          const isWinner = playerId === winnerId;
          const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${toXY(p.t, p.wpm).join(",")}`).join(" ");
          const last = points[points.length - 1]!;
          const [lx, ly] = toXY(last.t, last.wpm);
          const label = nicknameMap.get(playerId) ?? `${playerId.slice(0, 8)}…`;
          const stroke = isWinner ? "var(--color-status-success)" : "var(--color-olive-leaf-300)";

          return (
            <g key={playerId}>
              <path d={d} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={lx} cy={ly} r={4} fill={stroke} />
              <text
                x={lx + 8}
                y={ly}
                dominantBaseline="middle"
                className="text-[10px] fill-[var(--color-text-muted)]"
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
