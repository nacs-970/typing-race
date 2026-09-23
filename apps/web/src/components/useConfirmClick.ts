import { useCallback, useEffect, useRef, useState } from "react";

export interface UseConfirmClickResult {
  armed: boolean;
  onClick: () => void;
}

/**
 * Two-step confirm for a risky one-click action.
 * - The first click arms it (does not run `action`).
 * - A second click within `timeoutMs` runs `action` and disarms.
 * - If no second click comes within `timeoutMs`, it disarms on its own.
 * - The pending timer is cleared on unmount.
 */
export function useConfirmClick(
  action: () => void,
  timeoutMs = 3000,
): UseConfirmClickResult {
  const [armed, setArmed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionRef = useRef(action);
  actionRef.current = action;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  const onClick = useCallback(() => {
    if (armed) {
      clearTimer();
      setArmed(false);
      actionRef.current();
      return;
    }
    setArmed(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setArmed(false);
    }, timeoutMs);
  }, [armed, timeoutMs, clearTimer]);

  return { armed, onClick };
}
