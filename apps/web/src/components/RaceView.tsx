/**
 * RaceView — passage render + own cursor (optimistic) + opponent cursors
 * (server-confirmed via cursor_update frames).
 *
 * NO interpolation polish yet (Phase 5 owns that). This view proves
 * the wire works: opponent cursor advances via the server round-trip.
 *
 * Own cursor advances on every local keystroke (optimistic). When the
 * server echoes back a cursor_update with our playerId, the index is
 * already at the right place (we rendered optimistically), so we just
 * record the server timestamp for measurement.
 */
import { useEffect, useState } from "react";
import { useCursorStore } from "../store/cursor.ts";

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
  const [buffer, setBuffer] = useState<string>("");

  useEffect(() => {
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key.length !== 1) return; // skip modifier / arrow keys
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
          const opponentCursors = [...cursors.entries()]
            .filter(([pid, c]) => c.index === i && pid !== playerId)
            .map(([pid]) => pid);
          return (
            <span key={i} className={isOwnCursor ? "char own-cursor" : "char"}>
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