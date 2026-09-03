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
      className="grace-banner overflow-hidden p-3 rounded-xl bg-[#15180c] border border-[#cc6722]/60 shadow-[0_8px_24px_rgba(0,0,0,0.6),0_0_16px_rgba(204,103,34,0.3)] text-[#fefbe6] font-mono"
      role="status"
      aria-live="polite"
      data-testid="grace-banner"
    >
      <div className="flex items-center justify-between text-xs font-bold mb-1.5">
        <span className="text-[#fbd24b]">
          ⚡ {banner.leaderNickname ? `${banner.leaderNickname} finished 1st!` : "First racer finished!"}
        </span>
        <span className="text-[#cc6722]">{seconds}s remaining</span>
      </div>

      {/* Glowing timer shrink bar */}
      <div className="w-full h-1.5 bg-[#12190b] rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#cc6722] to-[#fbd24b] rounded-full transition-all duration-75 ease-linear shadow-[0_0_8px_#cc6722]"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}