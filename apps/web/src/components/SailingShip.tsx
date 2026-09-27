import React, { useEffect, useState } from "react";

const WAVE = "﹏";
const BOAT = "𓊝";
const DRIFT = "𓂁";
/** Track slots: the boat stays in slot 1; 𓂁 drifts left through the wave
 * slots (4 → 3 → 2 → 0), skipping the boat, then loops back to the right. */
const TRACK_LEN = 5;
const BOAT_SLOT = 1;
const DRIFT_SLOTS = [4, 3, 2, 0];
const FRAME_MS = 450;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  } catch {
    return false;
  }
}

/**
 * Decorative ⊹ ࣪﹏𓊝﹏𓂁﹏⊹ ࣪˖ line as a text animation: 𓂁 shifts left one
 * slot per frame and loops, and the sparkles at each end twinkle between
 * ⊹ ࣪ and ˖. Reduced motion shows the static line.
 */
export function SailingShip({ className = "" }: { className?: string }): React.ReactElement {
  const [frame, setFrame] = useState(0);
  const [still] = useState(prefersReducedMotion);

  useEffect(() => {
    if (still) return;
    const id = setInterval(() => setFrame((f) => f + 1), FRAME_MS);
    return () => clearInterval(id);
  }, [still]);

  if (still) {
    return <span aria-hidden="true" className={className}>⊹ ࣪﹏𓊝﹏𓂁﹏⊹ ࣪˖</span>;
  }

  const drift = DRIFT_SLOTS[frame % DRIFT_SLOTS.length];
  const track = Array.from({ length: TRACK_LEN }, (_, i) =>
    i === BOAT_SLOT ? BOAT : i === drift ? DRIFT : WAVE,
  ).join("");
  const twinkle = frame % 2 === 0;
  // Fixed width so the line doesn't jump when a sparkle changes glyph.
  const spark = "inline-block w-[2ch] text-center";

  return (
    <span aria-hidden="true" className={`inline-flex items-baseline whitespace-nowrap ${className}`}>
      <span className={spark}>{twinkle ? "⊹ ࣪" : "˖"}</span>
      <span>{track}</span>
      <span className={spark}>{twinkle ? "˖" : "⊹ ࣪"}</span>
    </span>
  );
}
