import React from "react";

export interface ResultStat {
  label: string;
  value: React.ReactNode;
}

export interface ResultSummaryProps {
  /** `.label` metadata line above the number, e.g. "time 60 · punctuation". */
  label: string;
  wpm: number;
  stats: ResultStat[];
  wpmTestId?: string;
}

/** One result: big serif wpm plus a mono stat strip. Used by the solo test
 * and, for your own row, above the multiplayer ranking. */
export function ResultSummary({ label, wpm, stats, wpmTestId }: ResultSummaryProps): React.ReactElement {
  return (
    <>
      <p className="label m-0">{label}</p>
      <p
        className="m-0 mt-6 font-serif-display text-[clamp(4.5rem,18vw,128px)] leading-none tabular-nums text-[var(--color-text-bright)]"
        data-testid={wpmTestId}
      >
        {Math.round(wpm)}
      </p>
      <p className="label m-0 mt-2">wpm</p>
      <dl className="m-0 mt-8 flex flex-wrap gap-x-8 gap-y-3 font-mono tabular-nums">
        {stats.map((s) => (
          <div key={s.label} className="flex items-baseline gap-2">
            <dt className="label">{s.label}</dt>
            <dd className="m-0 text-lg">{s.value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
