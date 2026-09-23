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
      className="reconnect-banner flex flex-col gap-2 py-2.5 px-4 bg-[var(--color-bg-surface)] border-t border-[var(--color-text-bright)] border-b border-[var(--color-border-muted)] rounded-none text-[var(--color-text-bright)] font-mono shadow-none"
      role="status"
      aria-live="polite"
      data-testid="reconnect-banner"
    >
      <div className="flex items-center justify-between text-sm">
        <span>
          Reconnecting... ({seconds}s)
        </span>
        <span className="text-[var(--color-text-muted)]">
          Waiting up to 60s
        </span>
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
