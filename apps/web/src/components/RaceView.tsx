/**
 * RaceView — passage render + own cursor + opponent cursors + per-char
 * accents (D-11/D-12).
 *
 * LOCAL own cursor (not in cursor store):
 *   - RaceView owns ownIndex as local state. On every keystroke, advance
 *     ownIndex by 1. The server validates; on accept, it broadcasts
 *     cursor_update to OTHERS (not us). Our ownIndex is purely client-side
 *     and matches what the server thinks (since the server validates the
 *     same index). On REJECT (wrong char), we DECREMENT ownIndex so the
 *     user can retry the same position. (In practice the wrong char shows
 *     as "error" optimistic and server sends error to sender only — but
 *     progress doesn't advance, so client should mirror that.)
 *
 * SERVER-confirmed ownIndex (on backspace):
 *   - When the user backspaces, we send a 'correction' frame. The server
 *     decrements player.progress and echoes cursor_update to all (including
 *     sender) with the authoritative index. We listen for that and sync.
 *
 * Optimistic charStates: local — each char-state is set on keystroke.
 * Race-end resets the cursor store; rematch resets local state.
 */
import { useEffect, useRef, useState } from "react";
import { useRaceStore, setRaceState, type CharState as CharStateType } from "../store/race.ts";
import { useCursorStore } from "../store/cursor.ts";

export function RaceView({
  passageText,
  playerId,
  onKeystroke,
  onCorrection,
}: {
  passageText: string;
  playerId: string;
  onKeystroke: (index: number, char: string) => void;
  onCorrection: (backspaces: number) => void;
}): React.ReactElement {
  const opponentCursorsMap = useCursorStore((s) => s.cursors);
  const ownCharStates = useRaceStore((s) => s.ownCharStates);
  // Local own cursor (single source of truth for THIS player, initialized from store on reconnect)
  const initialIndex = useCursorStore.getState().ownIndex;
  const [ownIndex, setOwnIndex] = useState(initialIndex);
  const ownIndexRef = useRef(initialIndex);
  const storeOwnIndex = useCursorStore((s) => s.ownIndex);

  const updateOwnIndex = (newIndex: number | ((i: number) => number)) => {
    const next = typeof newIndex === "function" ? newIndex(ownIndexRef.current) : newIndex;
    ownIndexRef.current = next;
    setOwnIndex(next);
  };

  useEffect(() => {
    updateOwnIndex(storeOwnIndex);
  }, [storeOwnIndex]);

  // Stable refs for callbacks — prevents useEffect from tearing down the
  // keydown listener every time App.tsx re-renders with new function refs
  const onKeystrokeRef = useRef(onKeystroke);
  onKeystrokeRef.current = onKeystroke;
  const onCorrectionRef = useRef(onCorrection);
  onCorrectionRef.current = onCorrection;

  useEffect(() => {
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;

      const currentIdx = ownIndexRef.current;

      // Backspace: ask server to decrement progress
      if (ev.key === "Backspace") {
        ev.preventDefault();
        if (currentIdx <= 0) return;
        onCorrectionRef.current(1);
        // Optimistically decrement (server echo will confirm)
        updateOwnIndex((i) => i - 1);
        setRaceState((s) => {
          const next = [...s.ownCharStates];
          if (next.length > 0) {
            next[currentIdx - 1] = "pending";
          }
          return { ownCharStates: next };
        });
        return;
      }

      // Ignore non-character keys
      const ch = ev.key === "Spacebar" ? " " : ev.key;
      if (ch.length !== 1) return;

      ev.preventDefault();
      if (currentIdx >= passageText.length) return;

      // Optimistic local char-state
      const expected = passageText[currentIdx] ?? "";
      const charState: CharStateType = ch === expected ? "correct" : "error";
      setRaceState((s) => {
        const next = [...s.ownCharStates];
        while (next.length <= currentIdx) next.push("pending");
        next[currentIdx] = charState;
        return { ownCharStates: next };
      });

      onKeystrokeRef.current(currentIdx, ch);
      // Advance locally; App.tsx will also call setCursorState(ownIndex+1)
      // but we use our local state for display.
      updateOwnIndex((i) => i + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [passageText]);

  // On rematch (race_start) reset local ownIndex to 0
  useEffect(() => {
    // Listen for race_start in our own store. We do it via passageText
    // change since passageText is reset on race_start.
    updateOwnIndex(0);
  }, [passageText]);

  // Also sync from server cursor_update echoes (backspace, etc.) by
  // watching the cursor store's ownIndex field. We mirror it into local
  // state when it goes DOWN (backspace echo) or when it goes to 0
  // (race_end reset).
  useEffect(() => {
    const unsub = useCursorStore.subscribe((s, prev) => {
      if (s.ownIndex < prev.ownIndex) {
        // Server says go back (correction echo)
        updateOwnIndex(s.ownIndex);
      } else if (s.ownIndex === 0 && prev.ownIndex > 0) {
        // Race ended / rematch
        updateOwnIndex(0);
      }
    });
    return unsub;
  }, []);

  return (
    <div className="race-view">
      <div className="passage">
        {passageText.split("").map((ch, i) => {
          const isOwnCursor = i === ownIndex;
          const state: CharStateType = ownCharStates[i] ?? "pending";
          const opponentCursors = [...opponentCursorsMap.entries()]
            .filter(([pid, c]) => c.index === i && pid !== playerId)
            .map(([pid]) => pid);
          return (
            <span
              key={i}
              className={`char char-${state}${isOwnCursor ? " own-cursor" : ""}`}
            >
              {ch}
              {opponentCursors.map((pid) => (
                <span key={pid} className="opponent-cursor" data-pid={pid} />
              ))}
            </span>
          );
        })}
      </div>
    </div>
  );
}
