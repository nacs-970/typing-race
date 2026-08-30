/**
 * Clock store — Zustand state for `clientOffsetMs`.
 *
 * Updated by `syncClock()` on mount (App.tsx); read by `CountdownView`
 * to translate server-time anchors to local-time display.
 */
import { create } from "zustand";

export type ClockState = {
  offsetMs: number;
  roundtripMs: number;
  lastSyncedAt: number | null;
};

export const useClockStore = create<ClockState>(() => ({
  offsetMs: 0,
  roundtripMs: 0,
  lastSyncedAt: null,
}));

/** Allow non-React code (net/clock.ts, ws.ts) to push updates in. */
export const setClockState = (patch: Partial<ClockState>): void => {
  useClockStore.setState(patch);
};