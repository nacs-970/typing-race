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
import { useEffect, useState } from "react";
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
  // Local own cursor (single source of truth for THIS player)
  const [ownIndex, setOwnIndex] = useState(0);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;

      // Backspace: ask server to decrement progress
      if (ev.key === "Backspace") {
        ev.preventDefault();
        if (ownIndex <= 0) return;
        onCorrection(1);
        // Optimistically decrement (server echo will confirm)
        setOwnIndex((i) => i - 1);
        setRaceState((s) => {
          const next = [...s.ownCharStates];
          if (next.length > 0) {
            next[ownIndex - 1] = "pending";
          }
          return { ownCharStates: next };
        });
        return;
      }

      // Ignore non-character keys
      const ch = ev.key === "Spacebar" ? " " : ev.key;
      if (ch.length !== 1) return;

      ev.preventDefault();
      if (ownIndex >= passageText.length) return;

      // Optimistic local char-state
      const expected = passageText[ownIndex] ?? "";
      const charState: CharStateType = ch === expected ? "correct" : "error";
      setRaceState((s) => {
        const next = [...s.ownCharStates];
        while (next.length <= ownIndex) next.push("pending");
        next[ownIndex] = charState;
        return { ownCharStates: next };
      });

      onKeystroke(ownIndex, ch);
      // Advance locally; App.tsx will also call setCursorState(ownIndex+1)
      // but we use our local state for display.
      setOwnIndex((i) => i + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ownIndex, passageText, onKeystroke, onCorrection]);

  // On rematch (race_start) reset local ownIndex to 0
  useEffect(() => {
    // Listen for race_start in our own store. We do it via passageText
    // change since passageText is reset on race_start.
    setOwnIndex(0);
  }, [passageText]);

  // Also sync from server cursor_update echoes (backspace, etc.) by
  // watching the cursor store's ownIndex field. We mirror it into local
  // state when it goes DOWN (backspace echo) or when it goes to 0
  // (race_end reset).
  useEffect(() => {
    const unsub = useCursorStore.subscribe((s, prev) => {
      if (s.ownIndex < prev.ownIndex) {
        // Server says go back (correction echo)
        setOwnIndex(s.ownIndex);
      } else if (s.ownIndex === 0 && prev.ownIndex > 0) {
        // Race ended / rematch
        setOwnIndex(0);
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
