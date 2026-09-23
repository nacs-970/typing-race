import React, { useEffect, useState } from "react";
import { useRaceStore } from "../store/race.ts";

export function GraceBanner(): React.ReactElement | null {
  const banner = useRaceStore((s) => s.graceBanner);
  const [localRemaining, setLocalRemaining] = useState<number>(0);
  const [initialMs, setInitialMs] = useState<number>(5000);

  useEffect(() => {
    if (!banner) return;
    setLocalRemaining(banner.remainingMs);
    setInitialMs(Math.max(1000, banner.remainingMs));
    const interval = setInterval(() => {
      setLocalRemaining((prev) => Math.max(0, prev - 50));
    }, 50);
    return () => clearInterval(interval);
  }, [banner]);

  if (!banner) return null;
  const seconds = Math.max(0, Math.ceil(localRemaining / 1000));
  if (seconds <= 0) return null;

  const percent = Math.min(100, Math.max(0, (localRemaining / initialMs) * 100));

  return (
    <div
      className="grace-banner flex flex-col gap-2 py-2.5 px-4 bg-[var(--color-bg-surface)] border-t border-[var(--color-text-bright)] border-b border-[var(--color-border-muted)] rounded-none text-[var(--color-text-bright)] font-mono shadow-none"
      role="status"
      aria-live="polite"
      data-testid="grace-banner"
    >
      <div className="flex items-center justify-between text-sm">
        <span>
          — {banner.leaderNickname ? `${banner.leaderNickname} finished first.` : "First racer finished."}
        </span>
        <span className="text-[var(--color-text-muted)]">{seconds}s remaining</span>
      </div>

      <div className="relative h-[1px] w-full bg-[var(--color-border-muted)]">
        <div
          className="absolute left-0 -top-[1px] h-[2px] bg-[var(--color-text-bright)] transition-all duration-75 ease-linear"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}