/**
 * GraceBanner — D-15. Appears at top when grace_countdown is active.
 * Shows leader nickname + remaining seconds. Auto-hides when graceBanner
 * is null (race ended or no grace).
 */
import { useEffect, useState } from "react";
import { useRaceStore } from "../store/race.ts";

export function GraceBanner(): React.ReactElement | null {
  const banner = useRaceStore((s) => s.graceBanner);
  const [localRemaining, setLocalRemaining] = useState<number>(0);

  useEffect(() => {
    if (!banner) return;
    setLocalRemaining(banner.remainingMs);
    const interval = setInterval(() => {
      setLocalRemaining((prev) => Math.max(0, prev - 100));
    }, 100);
    return () => clearInterval(interval);
  }, [banner]);

  if (!banner) return null;
  const seconds = Math.max(0, Math.ceil(localRemaining / 1000));
  if (seconds <= 0) return null;
  
  return (
    <div className="grace-banner" role="status" aria-live="polite">
      <span className="grace-text">
        <strong>{banner.leaderNickname}</strong> finished — {seconds}s remaining
      </span>
    </div>
  );
}