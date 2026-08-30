/**
 * ResultsBoard — D-10. Ranked by finishTimeMs asc, then WPM desc as tiebreaker.
 * Rematch button visible only to host; sends start_race WITHOUT passageId
 * so the server auto-deals (D-04 no-repeat guarantee).
 */
import { useMemo } from "react";
import type { PlayerFinalStats } from "@typing-race/shared";
import { ws } from "../net/ws.ts";
import { useConnectionStore } from "../store/connection.ts";

export function ResultsBoard({
  results,
  isHost,
  onRematch,
}: {
  results: PlayerFinalStats[];
  isHost: boolean;
  onRematch: () => void;
}): React.ReactElement | null {
  const myId = useConnectionStore((s) => s.playerId);

  const ranked = useMemo(() => {
    return [...results].sort((a, b) => {
      if (a.finishTimeMs !== b.finishTimeMs) return a.finishTimeMs - b.finishTimeMs;
      return b.wpm - a.wpm; // WPM tiebreaker: higher WPM wins
    });
  }, [results]);

  if (results.length === 0) return null;

  return (
    <div className="results-board">
      <h2>Results</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th>Time (s)</th>
            <th>WPM</th>
            <th>Accuracy</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((r, i) => {
            const isMe = r.playerId === myId;
            return (
              <tr key={r.playerId} className={isMe ? "row-me" : ""}>
                <td>{i + 1}</td>
                <td>{isMe ? `${r.playerId.slice(0, 8)}… (you)` : r.playerId.slice(0, 8) + "…"}</td>
                <td>{(r.finishTimeMs / 1000).toFixed(1)}</td>
                <td>{r.wpm.toFixed(1)}</td>
                <td>{(r.accuracy * 100).toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {isHost && (
        <button
          type="button"
          className="rematch-button"
          onClick={() => {
            ws.send({ type: "start_race", graceSeconds: 5 });
            onRematch();
          }}
        >
          Rematch (auto-deal new passage)
        </button>
      )}
    </div>
  );
}