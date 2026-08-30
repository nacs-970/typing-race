/**
 * CountdownView — server-time-anchored countdown UI.
 *
 * Uses `startsAtServerMs - offsetMs - Date.now()` so the displayed
 * seconds-remaining is in the SERVER's reference frame. A 5s clock
 * skew between client and server doesn't change the countdown —
 * the client just translates.
 *
 * No `performance.now()` here — we want wall-clock alignment to
 * match the server's `Date.now()`.
 */
import { useEffect, useState } from "react";
import { useClockStore } from "../store/clock.ts";

function compute(offsetMs: number, startsAtServerMs: number): number {
  return Math.max(0, Math.round((startsAtServerMs - offsetMs - Date.now()) / 1000));
}

export function CountdownView({
  startsAtServerMs,
}: {
  startsAtServerMs: number;
}): React.ReactElement {
  const offsetMs = useClockStore((s) => s.offsetMs);
  const [seconds, setSeconds] = useState<number>(() =>
    compute(offsetMs, startsAtServerMs),
  );

  useEffect(() => {
    const id = setInterval(() => {
      const next = compute(offsetMs, startsAtServerMs);
      setSeconds(next);
      if (next === 0) clearInterval(id);
    }, 100);
    return () => clearInterval(id);
  }, [offsetMs, startsAtServerMs]);

  return (
    <div className="countdown-view">
      <span className="countdown-num">{seconds}</span>
      <span className="countdown-label">starting in…</span>
    </div>
  );
}