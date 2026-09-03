import React, { useEffect, useState, useRef } from "react";
import { useClockStore } from "../store/clock.ts";

export interface CountdownViewProps {
  startsAtServerMs: number;
  onCountdownComplete?: () => void;
}

export function CountdownView({
  startsAtServerMs,
  onCountdownComplete,
}: CountdownViewProps): React.ReactElement | null {
  const offsetMs = useClockStore((s) => s.offsetMs);
  const [remainingMs, setRemainingMs] = useState<number>(() =>
    Math.max(0, startsAtServerMs - offsetMs - Date.now()),
  );
  const [fading, setFading] = useState<boolean>(false);
  const completedRef = useRef<boolean>(false);

  useEffect(() => {
    const update = () => {
      const serverNow = Date.now() + offsetMs;
      const left = startsAtServerMs - serverNow;
      setRemainingMs(left);

      if (left <= 0) {
        if (!completedRef.current) {
          completedRef.current = true;
          setFading(true);
          onCountdownComplete?.();
        }
      }
    };

    update();
    const intervalId = setInterval(update, 16);
    return () => clearInterval(intervalId);
  }, [startsAtServerMs, offsetMs, onCountdownComplete]);

  let display: string;
  if (remainingMs > 2000 && remainingMs <= 3000) {
    display = "3";
  } else if (remainingMs > 1000 && remainingMs <= 2000) {
    display = "2";
  } else if (remainingMs > 0 && remainingMs <= 1000) {
    display = "1";
  } else if (remainingMs <= 0) {
    display = "GO!";
  } else {
    display = Math.ceil(remainingMs / 1000).toString();
  }

  return (
    <div
      className={`countdown-overlay fixed inset-0 flex items-center justify-center bg-[#070b04]/70 backdrop-blur-xs z-30 transition-opacity duration-300 ${
        fading ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      data-testid="countdown-overlay"
    >
      <div className="countdown-view text-center flex flex-col items-center">
        <span
          key={display}
          className="countdown-num text-7xl sm:text-8xl font-black font-mono text-[#cc6722] drop-shadow-[0_0_24px_rgba(204,103,34,0.65)] animate-in zoom-in-75 duration-200"
          data-testid="countdown-num"
        >
          {display}
        </span>
        <span className="countdown-label text-sm uppercase tracking-widest text-[#b5c48b] mt-4 font-bold">
          {display === "GO!" ? "Race Started!" : "Starting in…"}
        </span>
      </div>
    </div>
  );
}