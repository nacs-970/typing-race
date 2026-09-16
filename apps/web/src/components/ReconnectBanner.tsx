import React, { useEffect, useState, useRef } from "react";
import { useConnectionStore } from "../store/connection.ts";

export interface ReconnectBannerProps {
  sessionTakenOver?: boolean;
}

export function ReconnectBanner({
  sessionTakenOver = false,
}: ReconnectBannerProps = {}): React.ReactElement | null {
  const status = useConnectionStore((s) => s.status);
  const hasEverBeenOpenRef = useRef(false);
  const droppedAtRef = useRef<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  if (status === "open") {
    hasEverBeenOpenRef.current = true;
  }

  const isReconnecting =
    hasEverBeenOpenRef.current && status !== "open" && !sessionTakenOver;

  useEffect(() => {
    if (!isReconnecting) {
      droppedAtRef.current = null;
      setElapsedMs(0);
      return;
    }

    if (droppedAtRef.current === null) {
      droppedAtRef.current = Date.now();
    }

    const interval = setInterval(() => {
      if (droppedAtRef.current !== null) {
        setElapsedMs(Date.now() - droppedAtRef.current);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [isReconnecting]);

  if (!isReconnecting) {
    return null;
  }

  const seconds = Math.floor(elapsedMs / 1000);
  const percent = Math.min(100, Math.max(0, (elapsedMs / 60000) * 100));

  return (
    <div
      className="reconnect-banner overflow-hidden p-3 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-accent-clay)]/60 shadow-[0_8px_24px_rgba(0,0,0,0.6),0_0_16px_var(--color-accent-subtle)] text-[var(--color-text-bright)] font-mono"
      role="status"
      aria-live="polite"
      data-testid="reconnect-banner"
    >
      <div className="flex items-center justify-between text-xs font-bold mb-1.5">
        <span className="text-[var(--color-accent-clay)]">
          Reconnecting... ({seconds}s)
        </span>
        <span className="text-[var(--color-text-muted)] text-[10px]">
          Waiting up to 60s
        </span>
      </div>

      {/* Elapsed progress bar scaled to 60s reference */}
      <div className="w-full h-1.5 bg-[var(--color-bg-base)] rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[var(--color-accent-clay)] to-[var(--color-cursor-slot-4)] rounded-full transition-all duration-75 ease-linear shadow-[0_0_8px_var(--color-accent-clay)]"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
