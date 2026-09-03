import { useCallback, useEffect, useState } from "react";
import { useConnectionStore } from "./store/connection.ts";
import { useClockStore } from "./store/clock.ts";
import { ws, getSessionCookie } from "./net/ws.ts";
import { useRaceStore, resetRaceUi } from "./store/race.ts";
import { setCursorState } from "./store/cursor.ts";
import { syncClock } from "./net/clock.ts";
import { CountdownView } from "./components/CountdownView.tsx";
import { RaceView } from "./components/RaceView.tsx";
import { LobbyView } from "./components/LobbyView.tsx";
import { GraceBanner } from "./components/GraceBanner.tsx";
import { ResultsBoard } from "./components/ResultsBoard.tsx";
import { ToastQueue } from "./components/ToastQueue.tsx";
import { addToast } from "./store/toast.ts";
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
  const countdownStartsAtServerMs = useRaceStore((s) => s.countdownStartsAtServerMs);
  const raceStart = passageText !== null;
  const inCountdown = countdownStartsAtServerMs !== null;
  const inResults = raceEndResults !== null;

  const [clockErr, setClockErr] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [isHost, setIsHost] = useState<boolean>(false);
  const [sessionTakenOver, setSessionTakenOver] = useState<boolean>(false);
  const [disconnectToasts, setDisconnectToasts] = useState<
    Array<{ playerId: string; nickname: string }>
  >([]);
  const [reconnectedNotice, setReconnectedNotice] = useState<string | null>(null);

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

  // Auto-rejoin on mount if room hash and cookie exist
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace("#", "").trim().toUpperCase();
    if (hash.length === 6) {
      const token = getSessionCookie(hash);
      if (token) {
        const tryRejoin = () => {
          ws.send({
            type: "rejoin_room",
            roomCode: hash,
            sessionToken: token,
          });
        };
        if (useConnectionStore.getState().status === "open") {
          tryRejoin();
        } else {
          const unsub = useConnectionStore.subscribe((s) => {
            if (s.status === "open") {
              tryRejoin();
              unsub();
            }
          });
        }
      }
    }
  }, []);

  // 2. WS frame routing for app-level lifecycle (lobby → countdown → race → grace → results)
  useEffect(() => {
    const unsub = ws.subscribe((msg: ServerToClient) => {
      if (msg.type === "joined_room") {
        setRoomCode(msg.roomCode);
        setIsHost(msg.you.isHost);
        setSessionTakenOver(false);
        if (typeof window !== "undefined") {
          window.location.hash = msg.roomCode;
        }
      }
      if (msg.type === "rejoined_room") {
        setRoomCode(msg.roomCode);
        setIsHost(msg.you.isHost);
        setSessionTakenOver(false);
        if (typeof window !== "undefined") {
          window.location.hash = msg.roomCode;
        }
      }
      if (msg.type === "session_taken_over") {
        setSessionTakenOver(true);
      }
      if (msg.type === "lobby_state") {
        setRoomCode(msg.roomCode);
        const myId = useConnectionStore.getState().playerId;
        if (myId) {
          const me = msg.players.find((p) => p.playerId === myId);
          if (me) {
            setIsHost(me.isHost);
          }
        }
      }
      if (msg.type === "player_disconnected") {
        setDisconnectToasts((prev) => [
          ...prev.filter((t) => t.playerId !== msg.playerId),
          { playerId: msg.playerId, nickname: msg.nickname },
        ]);
        addToast({
          type: "warning",
          title: "Player Disconnected",
          body: `${msg.nickname} disconnected — waiting up to 60s for reconnect...`,
          durationMs: msg.timeoutMs || 60000,
        });
      }
      if (msg.type === "player_reconnected") {
        setDisconnectToasts((prev) =>
          prev.filter((t) => t.playerId !== msg.playerId),
        );
        setReconnectedNotice(`${msg.nickname} reconnected!`);
        setTimeout(() => setReconnectedNotice(null), 3000);
        addToast({
          type: "success",
          title: "Player Reconnected",
          body: `${msg.nickname} reconnected!`,
          durationMs: 3000,
        });
      }
      if (msg.type === "player_left") {
        setDisconnectToasts((prev) =>
          prev.filter((t) => t.playerId !== msg.playerId),
        );
      }
      if (msg.type === "error") {
        let title = "Error";
        let body = msg.message;
        if (msg.code === "ROOM_NOT_FOUND") {
          title = "Room Lost";
          body = "Room lost — connection expired. Return to lobby or create a new room.";
        } else if (msg.code === "RATE_LIMITED") {
          title = "Rate Limit";
          body = "Rate limit reached (max 10 rooms/hr). Wait 15 minutes or join an existing room.";
        }
        addToast({
          type: "error",
          title,
          body,
          durationMs: 5000,
        });
      }
    });
    return unsub;
  }, []);

  const reclaimSession = useCallback(() => {
    const code =
      roomCode ??
      (typeof window !== "undefined"
        ? window.location.hash.replace("#", "").trim().toUpperCase()
        : null);
    if (!code || code.length !== 6) return;
    const token = getSessionCookie(code);
    if (!token) return;
    ws.rejoin(code, token);
  }, [roomCode]);

  // Reclaim session automatically on focus, tab switch, click, or key press when taken over
  useEffect(() => {
    if (!sessionTakenOver) return;

    const onActivate = () => {
      const code =
        roomCode ??
        (typeof window !== "undefined"
          ? window.location.hash.replace("#", "").trim().toUpperCase()
          : null);
      if (!code || code.length !== 6) return;
      const token = getSessionCookie(code);
      if (!token) return;

      reclaimSession();
    };

    window.addEventListener("focus", onActivate);
    document.addEventListener("visibilitychange", onActivate);
    window.addEventListener("pointerdown", onActivate);
    window.addEventListener("keydown", onActivate, { capture: true });
    return () => {
      window.removeEventListener("focus", onActivate);
      document.removeEventListener("visibilitychange", onActivate);
      window.removeEventListener("pointerdown", onActivate);
      window.removeEventListener("keydown", onActivate, { capture: true });
    };
  }, [sessionTakenOver, roomCode, reclaimSession]);

  const onKeystroke = (index: number, char: string): void => {
    if (sessionTakenOver) {
      reclaimSession();
      return;
    }
    setCursorState({ ownIndex: index + 1 });
    ws.send({ type: "keystroke", index, char, clientTs: Date.now() });
    const now = Date.now();
    const win = window as unknown as { __lastCursor?: number };
    if (now - (win.__lastCursor ?? 0) >= 100) {
      ws.send({ type: "cursor_position", index, clientTs: now });
      win.__lastCursor = now;
    }
  };

  const onCorrection = (backspaces: number): void => {
    if (sessionTakenOver) {
      reclaimSession();
      return;
    }
    ws.send({ type: "correction", backspaces, clientTs: Date.now() });
  };

  return (
    <main className="container">
      <ToastQueue />
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

      {sessionTakenOver && (
        <div
          className="session-taken-over-banner"
          style={{
            background: "#fee2e2",
            border: "1px solid #ef4444",
            padding: "1rem",
            borderRadius: "8px",
            margin: "1rem 0",
            color: "#991b1b",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <strong>Session active in another tab</strong>
            <p style={{ margin: "0.25rem 0 0" }}>
              This room is open in another tab. Click anywhere or press the button to resume here.
            </p>
          </div>
          <button
            type="button"
            onClick={reclaimSession}
            style={{
              background: "#ef4444",
              color: "#ffffff",
              border: "none",
              padding: "0.5rem 1rem",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 600,
              marginLeft: "1rem",
              whiteSpace: "nowrap",
            }}
          >
            Resume in this tab
          </button>
        </div>
      )}

      <GraceBanner />

      {disconnectToasts.length > 0 && (
        <div className="disconnect-toasts" style={{ margin: "0.5rem 0" }}>
          {disconnectToasts.map((t) => (
            <div
              key={t.playerId}
              className="toast-disconnect"
              style={{
                background: "#fef3c7",
                border: "1px solid #f59e0b",
                color: "#92400e",
                padding: "0.5rem 1rem",
                borderRadius: "6px",
                marginBottom: "0.5rem",
              }}
            >
              ⚠️ <strong>{t.nickname}</strong> disconnected — waiting up to 60s for reconnect...
            </div>
          ))}
        </div>
      )}

      {reconnectedNotice && (
        <div
          className="toast-reconnected"
          style={{
            background: "#d1fae5",
            border: "1px solid #10b981",
            color: "#065f46",
            padding: "0.5rem 1rem",
            borderRadius: "6px",
            margin: "0.5rem 0",
          }}
        >
          ✓ {reconnectedNotice}
        </div>
      )}

      {inCountdown && !raceStart && countdownStartsAtServerMs !== null && (
        <CountdownView
          startsAtServerMs={countdownStartsAtServerMs}
        />
      )}

      {roomCode && !raceStart && !inResults && !inCountdown && (
        <LobbyView
          roomCode={roomCode}
          isHost={isHost}
          onStartRace={(passageId, graceSeconds) => {
            ws.send({ type: "start_race", passageId, graceSeconds });
          }}
        />
      )}

      {raceStart && playerId && passageText && !inResults && (
        <RaceView
          passageText={passageText}
          playerId={playerId}
          onKeystroke={onKeystroke}
          onCorrection={onCorrection}
        />
      )}

      {inResults && raceEndResults && (
        <ResultsBoard
          results={raceEndResults}
          isHost={isHost}
          onRematch={() => {
            resetRaceUi();
          }}
          onReturnToLobby={() => {
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