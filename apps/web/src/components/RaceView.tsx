/**
 * RaceView — passage render + own cursor (optimistic) + opponent cursors
 * (server-confirmed) + per-char accents (D-11/D-12).
 *
 * charStates from useRaceStore drive the per-char CSS class:
 *   - .char-pending: gray dim (default)
 *   - .char-correct: normal text + green underline
 *   - .char-error: normal text + red underline
 *
 * Typing UX:
 *   - Single char (a-z, 0-9, punct, space): optimistic-correct + send keystroke
 *   - Backspace: optimistically revert last typed char to pending
 *     (do NOT send to server; server's last-write-wins handles corrections
 *     on the next forward keystroke — D-11 / Pitfall 1)
 *   - Cursor position = next-to-type (typing-race convention)
 */
import { useEffect, useState } from "react";
import { useCursorStore } from "../store/cursor.ts";
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
  const [buffer, setBuffer] = useState<string>("");

  useEffect(() => {
    const onKey = (ev: KeyboardEvent): void => {
      // Ignore modifier-only presses (Ctrl+R, Cmd+T, etc.)
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;

      // Backspace: revert last locally-typed char
      if (ev.key === "Backspace") {
        ev.preventDefault();
        if (buffer.length === 0) return;
        const nextBuffer = buffer.slice(0, -1);
        const revertedIndex = ownIndex + nextBuffer.length;
        // Optimistically revert that char to pending
        setRaceState((s) => {
          const next = [...s.ownCharStates];
          while (next.length <= revertedIndex) next.push("pending");
          next[revertedIndex] = "pending";
          return { ownCharStates: next };
        });
        setBuffer(nextBuffer);
        return;
      }

      // Anything else: ignore if not a single character
      if (ev.key.length !== 1) return;

      ev.preventDefault();
      const nextIndex = ownIndex + buffer.length;
      if (nextIndex >= passageText.length) return;

      // Optimistic: mark as correct locally (server cursor_update will overwrite if wrong)
      const expected = passageText[nextIndex] ?? "";
      const charState: CharStateType = ev.key === expected ? "correct" : "error";
      setRaceState((s) => {
        const next = [...s.ownCharStates];
        while (next.length <= nextIndex) next.push("pending");
        next[nextIndex] = charState;
        return { ownCharStates: next };
      });

      onKeystroke(nextIndex, ev.key);
      setBuffer((b) => b + ev.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ownIndex, buffer, passageText, onKeystroke]);

  return (
    <div className="race-view">
      <div className="passage">
        {passageText.split("").map((ch, i) => {
          const isOwnCursor = i === ownIndex + buffer.length;
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
      <div className="buffer">{buffer}</div>
    </div>
  );
}
