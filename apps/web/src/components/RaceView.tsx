/**
 * RaceView — passage render + own cursor (server-confirmed) + opponent
 * cursors (server-confirmed) + per-char accents (D-11/D-12).
 *
 * Cursor position: `ownIndex` from useCursorStore. App.tsx advances this
 * by 1 in setCursorState({ ownIndex: index + 1 }) on each accepted
 * keystroke. So cursor sits AT the next-to-type index (typing-race
 * convention).
 *
 * charStates optimistic update:
 *   - On local keystroke: mark ownCharStates[index] as 'correct' or
 *     'error' based on local char match. This gives instant feedback
 *     before server roundtrip.
 *   - On server cursor_update: App.tsx replaces ownCharStates wholesale
 *     with the authoritative array.
 *
 * Backspace:
 *   - Client-only optimistic revert. Revert ownCharStates[ownIndex-1]
 *     to 'pending' and decrement ownIndex. Server's last-write-wins
 *     (D-11 / Pitfall 1) means no server backspace frame is needed —
 *     the user can just retype the corrected char on the next keystroke.
 */
import { useEffect } from "react";
import { useCursorStore, setCursorState } from "../store/cursor.ts";
import { useRaceStore, setRaceState, type CharState as CharStateType } from "../store/race.ts";

export function RaceView({
  passageText,
  playerId,
  onKeystroke,
}: {
  passageText: string;
  playerId: string;
  onKeystroke: (index: number, char: string) => void;
}): React.ReactElement {
  const ownIndex = useCursorStore((s) => s.ownIndex);
  const cursors = useCursorStore((s) => s.cursors);
  const ownCharStates = useRaceStore((s) => s.ownCharStates);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;

      // Backspace: revert last accepted char (client-only optimistic)
      if (ev.key === "Backspace") {
        ev.preventDefault();
        if (ownIndex <= 0) return;
        const revertAt = ownIndex - 1;
        setRaceState((s) => {
          const next = [...s.ownCharStates];
          while (next.length <= revertAt) next.push("pending");
          next[revertAt] = "pending";
          return { ownCharStates: next };
        });
        setCursorState({ ownIndex: revertAt });
        return;
      }

      // Ignore non-character keys (Tab, Escape, Arrow keys, F1-F12, etc.)
      if (ev.key.length !== 1) return;

      ev.preventDefault();
      if (ownIndex >= passageText.length) return;

      // Optimistic local char-state
      const expected = passageText[ownIndex] ?? "";
      const charState: CharStateType = ev.key === expected ? "correct" : "error";
      setRaceState((s) => {
        const next = [...s.ownCharStates];
        while (next.length <= ownIndex) next.push("pending");
        next[ownIndex] = charState;
        return { ownCharStates: next };
      });

      onKeystroke(ownIndex, ev.key);
      // NOTE: do NOT advance ownIndex here — App.tsx's onKeystroke handler
      // bumps it on server ack. This keeps cursor in sync with server.
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ownIndex, passageText, onKeystroke]);

  return (
    <div className="race-view">
      <div className="passage">
        {passageText.split("").map((ch, i) => {
          const isOwnCursor = i === ownIndex;
          const state: CharStateType = ownCharStates[i] ?? "pending";
          const opponentCursors = [...cursors.entries()]
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
