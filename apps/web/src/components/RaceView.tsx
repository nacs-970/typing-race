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
 * Backspace: client sends {type: 'correction', backspaces} to server.
 * Server decrements progress + broadcasts cursor_update to all (including
 * sender) so ownIndex and ownCharStates update authoritatively.
 */
import { useEffect, useRef } from "react";
import { useCursorStore } from "../store/cursor.ts";
import { useRaceStore, setRaceState, type CharState as CharStateType } from "../store/race.ts";

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
  const ownIndex = useCursorStore((s) => s.ownIndex);
  const cursors = useCursorStore((s) => s.cursors);
  const ownCharStates = useRaceStore((s) => s.ownCharStates);

  // Refs to read fresh state inside the stable keydown listener.
  // This avoids stale-closure issues when ownIndex/onKeystroke change
  // (re-render the parent → new onKeystroke function → re-attach).
  const ownIndexRef = useRef(ownIndex);
  const passageTextRef = useRef(passageText);
  const onKeystrokeRef = useRef(onKeystroke);
  const onCorrectionRef = useRef(onCorrection);
  useEffect(() => { ownIndexRef.current = ownIndex; }, [ownIndex]);
  useEffect(() => { passageTextRef.current = passageText; }, [passageText]);
  useEffect(() => { onKeystrokeRef.current = onKeystroke; }, [onKeystroke]);
  useEffect(() => { onCorrectionRef.current = onCorrection; }, [onCorrection]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;

      const idx = ownIndexRef.current;
      const text = passageTextRef.current;

      // Backspace
      if (ev.key === "Backspace") {
        ev.preventDefault();
        if (idx <= 0) return;
        onCorrectionRef.current(1);
        return;
      }

      // Ignore non-character keys
      const ch = ev.key === "Spacebar" ? " " : ev.key;
      if (ch.length !== 1) return;

      ev.preventDefault();
      if (idx >= text.length) return;

      // Optimistic local char-state
      const expected = text[idx] ?? "";
      const charState: CharStateType = ch === expected ? "correct" : "error";
      setRaceState((s) => {
        const next = [...s.ownCharStates];
        while (next.length <= idx) next.push("pending");
        next[idx] = charState;
        return { ownCharStates: next };
      });

      onKeystrokeRef.current(idx, ch);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []); // attach once; refs give fresh state

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
