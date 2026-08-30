/**
 * Cursor store — isolated from connection store to avoid render storms
 * when opponent cursor frames arrive at 10Hz.
 *
 * Own cursor is optimistic (incremented on every local keystroke);
 * opponent cursors are server-confirmed (set from cursor_update frames).
 */
import { create } from "zustand";

export type Cursor = { playerId: string; index: number; serverTs: number };

export type CursorState = {
  ownIndex: number;
  cursors: Map<string, Cursor>;
};

export const useCursorStore = create<CursorState>(() => ({
  ownIndex: 0,
  cursors: new Map(),
}));

/** Allow non-React code (App.tsx, ws.ts) to push updates in. */
export const setCursorState = (
  patch: Partial<CursorState> | ((s: CursorState) => Partial<CursorState>),
): void => {
  if (typeof patch === "function") {
    useCursorStore.setState(patch);
  } else {
    useCursorStore.setState(patch);
  }
};

let lastCursorSendAt = 0;

/** Returns true if the caller should send a cursor_position frame (10Hz throttle). */
export function shouldSendCursor(now: number): boolean {
  if (now - lastCursorSendAt < 100) return false;
  lastCursorSendAt = now;
  return true;
}