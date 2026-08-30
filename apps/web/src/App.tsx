import { useEffect, useState } from "react";
import { useConnectionStore } from "./store/connection.ts";
import { useClockStore } from "./store/clock.ts";
import { ws } from "./net/ws.ts";
import { setCursorState, shouldSendCursor } from "./store/cursor.ts";
import { syncClock } from "./net/clock.ts";
import { CountdownView } from "./components/CountdownView.tsx";
import { RaceView } from "./components/RaceView.tsx";
import type { Countdown, RaceStart, ServerToClient } from "@typing-race/shared";

/**
 * Phase 2 SPA — wire + clock-sync + countdown + race view (anti-cheat ready).
 * Phase 3+ extends this with per-char correctness + WPM/accuracy.
 */
export function App(): React.ReactElement {
  const status = useConnectionStore((s) => s.status);
  const playerId = useConnectionStore((s) => s.playerId);
  const serverTs = useConnectionStore((s) => s.serverTs);
  const offsetMs = useClockStore((s) => s.offsetMs);
  const roundtripMs = useClockStore((s) => s.roundtripMs);

  const [clockErr, setClockErr] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<Countdown | null>(null);
  const [raceStart, setRaceStart] = useState<RaceStart | null>(null);
  const [raceEnded, setRaceEnded] = useState<boolean>(false);

  // 1. syncClock on mount
  useEffect(() => {
    let cancelled = false;
    syncClock()
      .then(({ offsetMs, roundtripMs }) => {
        if (cancelled) return;
        useClockStore.setState({
          offsetMs,
          roundtripMs,
          lastSyncedAt: Date.now(),
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setClockErr(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 2. WS frame routing (countdown, race_start, race_end)
  useEffect(() => {
    const unsub = ws.subscribe((msg: ServerToClient) => {
      if (msg.type === "countdown") {
        setCountdown(msg);
        setRaceStart(null);
        setRaceEnded(false);
      }
      if (msg.type === "race_start") {
        setCountdown(null);
        setRaceStart(msg);
        setRaceEnded(false);
        setCursorState({ ownIndex: 0, cursors: new Map() });
      }
      if (msg.type === "race_end") {
        setRaceEnded(true);
      }
    });
    return unsub;
  }, []);

  const onKeystroke = (index: number, char: string): void => {
    // Optimistic local cursor
    setCursorState({ ownIndex: index + 1 });
    // Send keystroke
    ws.send({ type: "keystroke", index, char, clientTs: Date.now() });
    // Throttled cursor_position at 10Hz
    const now = Date.now();
    if (shouldSendCursor(now)) {
      ws.send({ type: "cursor_position", index, clientTs: now });
    }
  };

  return (
    <main>
      <h1>Hello Typing Race</h1>
      <p className="subtitle">Realtime multiplayer typing — Phase 2 race engine.</p>

      <span className={`status-pill ${status}`}>Status: {status}</span>

      <div className="card">
        <dl>
          <dt>Player ID</dt>
          <dd>{playerId ? `${playerId.slice(0, 8)}…` : "—"}</dd>
          <dt>Server timestamp</dt>
          <dd>{serverTs ? new Date(serverTs).toISOString() : "—"}</dd>
          <dt>Clock offset</dt>
          <dd>
            {clockErr
              ? `error: ${clockErr}`
              : `${offsetMs.toFixed(1)}ms (roundtrip ${roundtripMs}ms)`}
          </dd>
        </dl>
      </div>

      {raceEnded && (
        <div className="race-end-banner">
          Race ended. <button onClick={() => { setRaceEnded(false); setRaceStart(null); }}>reset</button>
        </div>
      )}

      {countdown && !raceStart && (
        <CountdownView startsAtServerMs={countdown.startsAtServerMs} />
      )}

      {raceStart && playerId && (
        <RaceView
          passageText={raceStart.passageText}
          playerId={playerId}
          onKeystroke={onKeystroke}
        />
      )}

      {!countdown && !raceStart && !raceEnded && (
        <>
          <p className="hint">Waiting for race start. (Host: create a room and trigger start_race.)</p>
          <DevTools />
        </>
      )}
    </main>
  );
}

/**
 * Dev-only helpers — let a single developer exercise the lifecycle without
 * needing a second client. Hidden in prod (no flag here, but harmless).
 */
function DevTools(): React.ReactElement {
  return (
    <div className="dev-tools">
      <button
        type="button"
        onClick={() => {
          ws.send({ type: "create_room", nickname: "DevHost" });
        }}
      >
        Create room
      </button>
      <button
        type="button"
        onClick={() => {
          ws.send({ type: "start_race" });
        }}
      >
        Start race (dev)
      </button>
    </div>
  );
}