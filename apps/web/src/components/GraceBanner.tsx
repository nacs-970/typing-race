/**
 * GraceBanner — D-15. Appears at top when grace_countdown is active.
 * Shows leader nickname + remaining seconds. Auto-hides when graceBanner
 * is null (race ended or no grace).
 */
import { useRaceStore } from "../store/race.ts";

export function GraceBanner(): React.ReactElement | null {
  const banner = useRaceStore((s) => s.graceBanner);
  if (!banner) return null;
  const seconds = Math.max(0, Math.ceil(banner.remainingMs / 1000));
  return (
    <div className="grace-banner" role="status" aria-live="polite">
      <span className="grace-text">
        <strong>{banner.leaderNickname}</strong> finished — {seconds}s
        remaining
      </span>
    </div>
  );
}