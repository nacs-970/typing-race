import { useEffect, useState } from "react";
import { useConnectionStore } from "./store/connection.ts";
import { useClockStore } from "./store/clock.ts";
import { ws } from "./net/ws.ts";
import { useRaceStore, resetRaceUi } from "./store/race.ts";
import { setCursorState } from "./store/cursor.ts";
import { syncClock } from "./net/clock.ts";
import { CountdownView } from "./components/CountdownView.tsx";
import { RaceView } from "./components/RaceView.tsx";
import { LobbyView } from "./components/LobbyView.tsx";
import { GraceBanner } from "./components/GraceBanner.tsx";
import { ResultsBoard } from "./components/ResultsBoard.tsx";
import type { ServerToClient } from "@typing-race/shared";

/**
 * Phase 2 + Phase 3 SPA — wire + clock-sync + lobby + countdown + race
 * + grace banner + results board + rematch.
 */
export function App(): React.ReactElement {
  const status = useConnectionStore((s) => s.status);
  const playerId = useConnectionStore((s) => s.playerId);
  const serverTs = useConnectionStore((s) => s.serverTs);
  const offsetMs = useClockStore((s) => s.offsetMs);
  const roundtripMs = useClockStore((s) => s.roundtripMs);

  const ownWpm = useRaceStore((s) => s.ownWpm);
  const passageText = useRaceStore((s) => s.passageText);
  const raceEndResults = useRaceStore((s) => s.raceEndResults);
  const hostPickedPassagePreview = useRaceStore((s) => s.hostPickedPassagePreview);
  const raceStart = passageText !== null;
  const inResults = raceEndResults !== null;

  const [clockErr, setClockErr] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [isHost, setIsHost] = useState<boolean>(false);

  // 1. syncClock on mount
  useEffect(() => {
    let cancelled = false;
    syncClock()
      .then(({ offsetMs, roundtripMs }) => {
        if (cancelled) return;
        useClockStore.setState({ offsetMs, roundtripMs, lastSyncedAt: Date.now() });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setClockErr(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 2. WS frame routing for app-level lifecycle (lobby → countdown → race → grace → results)
  useEffect(() => {
    const unsub = ws.subscribe((msg: ServerToClient) => {
      if (msg.type === "joined_room") {
        setRoomCode(msg.roomCode);
        setIsHost(msg.you.isHost);
      }
    });
    return unsub;
  }, []);

  const onKeystroke = (index: number, char: string): void => {
    setCursorState({ ownIndex: index + 1 });
    ws.send({ type: "keystroke", index, char, clientTs: Date.now() });
    const now = Date.now();
    const win = window as unknown as { __lastCursor?: number };
    if (now - (win.__lastCursor ?? 0) >= 100) {
      ws.send({ type: "cursor_position", index, clientTs: now });
      win.__lastCursor = now;
    }
  };

  return (
    <main>
      <h1>Hello Typing Race</h1>
      <p className="subtitle">Realtime multiplayer typing — Phase 3 complete.</p>

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
          <dt>Own WPM (live)</dt>
          <dd>{ownWpm > 0 ? ownWpm.toFixed(1) : "—"}</dd>
        </dl>
      </div>

      <GraceBanner />

      {roomCode && !raceStart && !inResults && (
        <LobbyView
          roomCode={roomCode}
          isHost={isHost}
          onStartRace={(passageId, graceSeconds) => {
            ws.send({ type: "start_race", passageId, graceSeconds });
          }}
        />
      )}

      {raceStart && playerId && passageText && (
        <RaceView
          passageText={passageText}
          playerId={playerId}
          onKeystroke={onKeystroke}
        />
      )}

      {inResults && raceEndResults && (
        <ResultsBoard
          results={raceEndResults}
          isHost={isHost}
          onRematch={() => {
            resetRaceUi();
          }}
        />
      )}

      {!roomCode && !raceStart && <DevTools />}

      {hostPickedPassagePreview && !raceStart && (
        <p className="host-preview-debug">host preview: {hostPickedPassagePreview}</p>
      )}

      {roomCode && !raceStart && !inResults && (
        <p className="room-code-display">Room code: <code>{roomCode}</code></p>
      )}
    </main>
  );
}

function DevTools(): React.ReactElement {
  const [joinCode, setJoinCode] = useState<string>("");
  return (
    <div className="dev-tools">
      <div className="dev-row">
        <span>Nickname:</span>
        <input
          type="text"
          className="nickname-input"
          placeholder="Your name"
          maxLength={20}
          onChange={(e) => {
            const v = e.target.value;
            // stash for next action
            (window as unknown as { __nickname?: string }).__nickname = v;
          }}
        />
      </div>
      <div className="dev-row">
        <button
          type="button"
          onClick={() => {
            const nick =
              (window as unknown as { __nickname?: string }).__nickname ??
              "DevHost";
            ws.send({ type: "create_room", nickname: nick });
          }}
        >
          Create room
        </button>
        <input
          type="text"
          className="room-code-input"
          placeholder="ABCDEF"
          maxLength={6}
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
        />
        <button
          type="button"
          onClick={() => {
            const nick =
              (window as unknown as { __nickname?: string }).__nickname ??
              "DevGuest";
            ws.send({
              type: "join_room",
              code: joinCode,
              nickname: nick,
            });
          }}
        >
          Join room
        </button>
      </div>
    </div>
  );
}