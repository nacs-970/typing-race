/**
 * LobbyView — host passage picker + grace picker, OR waiting view for non-host.
 *
 * For host (D-02): full passage list (PASSAGES const), Random button,
 * grace picker (3/5/10 segmented), Start button sends start_race with
 * the chosen passageId. For non-host: shows "Host chose: <preview>…"
 * + grace badge + waiting spinner.
 */
import { useState } from "react";
import { PASSAGES, type Passage } from "@typing-race/shared";
import { useRaceStore } from "../store/race.ts";
import { ws } from "../net/ws.ts";

export function LobbyView({
  roomCode,
  isHost,
  onStartRace,
}: {
  roomCode: string;
  isHost: boolean;
  onStartRace: (passageId: string, graceSeconds: number) => void;
}): React.ReactElement {
  const preview = useRaceStore((s) => s.hostPickedPassagePreview);
  const passageText = useRaceStore((s) => s.passageText);
  const [pickedId, setPickedId] = useState<string>(PASSAGES[0]?.id ?? "");
  const [grace, setGrace] = useState<number>(5);

  if (!isHost) {
    return (
      <div className="lobby-view lobby-view-waiting">
        <h2>Room {roomCode}</h2>
        <p className="subtitle">Waiting for host to start the race…</p>
        {preview && (
          <div className="host-choice">
            <span className="label">Host chose:</span>{" "}
            <span className="preview">{preview}</span>
          </div>
        )}
        {grace && (
          <div className="grace-badge">Grace period: {grace}s</div>
        )}
        {passageText && <p className="passage-preview">{passageText}</p>}
      </div>
    );
  }

  return (
    <div className="lobby-view lobby-picker">
      <h2>Room {roomCode} (host)</h2>
      <div className="lobby-controls">
        <div className="grace-picker">
          <label>Grace period:</label>
          {[3, 5, 10].map((g) => (
            <button
              key={g}
              type="button"
              className={grace === g ? "grace-pill active" : "grace-pill"}
              onClick={() => setGrace(g)}
            >
              {g}s
            </button>
          ))}
        </div>
        <button
          type="button"
          className="random-button"
          onClick={() => {
            const idx = Math.floor(Math.random() * PASSAGES.length);
            const p: Passage | undefined = PASSAGES[idx];
            if (p) setPickedId(p.id);
          }}
        >
          🎲 Random passage
        </button>
      </div>
      <select
        className="passage-select"
        value={pickedId}
        onChange={(e) => setPickedId(e.target.value)}
        size={8}
      >
        {PASSAGES.map((p) => (
          <option key={p.id} value={p.id}>
            {p.text.slice(0, 50)}…
          </option>
        ))}
      </select>
      <button
        type="button"
        className="start-button"
        onClick={() => {
          onStartRace(pickedId, grace);
        }}
      >
        Start race ({grace}s grace)
      </button>
      <p className="dev-note">
        (host picker: sends <code>start_race</code> with explicit passageId
        — D-02; rematch sends without passageId to auto-deal — D-04)
      </p>
    </div>
  );
}