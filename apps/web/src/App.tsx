import { useConnectionStore } from "./store/connection.ts";
import "./net/ws.ts";

/**
 * Phase 1 SPA — proves the wire: opens a WS, shows status + playerId.
 * Phase 3/4 expand this with room join, lobby, race view, etc.
 */
export function App(): React.ReactElement {
  const status = useConnectionStore((s) => s.status);
  const playerId = useConnectionStore((s) => s.playerId);
  const serverTs = useConnectionStore((s) => s.serverTs);

  return (
    <main>
      <h1>Hello Typing Race</h1>
      <p className="subtitle">Realtime multiplayer typing — wire tracer.</p>

      <span className={`status-pill ${status}`}>Status: {status}</span>

      <div className="card">
        <dl>
          <dt>Player ID</dt>
          <dd>{playerId ? `${playerId.slice(0, 8)}…` : "—"}</dd>
          <dt>Server timestamp</dt>
          <dd>{serverTs ? new Date(serverTs).toISOString() : "—"}</dd>
        </dl>
      </div>
    </main>
  );
}