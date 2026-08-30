/**
 * RaceView — passage render + own cursor (optimistic) + opponent cursors
 * (server-confirmed) + per-char accents (D-11/D-12).
 *
 * charStates from useRaceStore drive the per-char CSS class:
 *   - .char-pending: gray dim (default)
 *   - .char-correct: normal text + green underline
 *   - .char-error: normal text + red underline
 */
import { useEffect, useState } from "react";
import { useCursorStore } from "../store/cursor.ts";
import { useRaceStore, type CharState as CharStateType } from "../store/race.ts";

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
      if (ev.key.length !== 1) return;
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      ev.preventDefault();
      const nextIndex = ownIndex + buffer.length;
      if (nextIndex >= passageText.length) return;
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