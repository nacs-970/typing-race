import { useEffect, useState } from "react";
import { useConnectionStore } from "./store/connection.ts";
import { useClockStore } from "./store/clock.ts";
import "./net/ws.ts";
import { syncClock } from "./net/clock.ts";
import { CountdownView } from "./components/CountdownView.tsx";
import type { Countdown } from "@typing-race/shared";

/**
 * Phase 2 SPA — wire + clock-sync + countdown.
 * Phase 4 (Plan 04) extends this with RaceView + cursor rendering.
 */
export function App(): React.ReactElement {
  const status = useConnectionStore((s) => s.status);
  const playerId = useConnectionStore((s) => s.playerId);
  const serverTs = useConnectionStore((s) => s.serverTs);
  const setClockState = useClockStore((s) => s); // unused, but keeps the store subscribed

  const [clockErr, setClockErr] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<Countdown | null>(null);

  // On mount: call /api/clock-sync to compute clientOffsetMs
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

  return (
    <main>
      <h1>Hello Typing Race</h1>
      <p className="subtitle">Realtime multiplayer typing — Phase 2 tracer.</p>

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
              : `${useClockStore.getState().offsetMs.toFixed(1)}ms (roundtrip ${useClockStore.getState().roundtripMs}ms)`}
          </dd>
        </dl>
      </div>

      {countdown ? (
        <CountdownView startsAtServerMs={countdown.startsAtServerMs} />
      ) : (
        <p className="hint">Waiting for countdown… (host must trigger start_race)</p>
      )}

      {/* countdown state lives in App for now; Phase 4 connects it to the WS */}
      <button
        type="button"
        onClick={() =>
          setCountdown({
            type: "countdown",
            startsAtServerMs: Date.now() + 3000,
            secondsRemaining: 3,
          })
        }
      >
        Simulate countdown (dev only)
      </button>
    </main>
  );
}