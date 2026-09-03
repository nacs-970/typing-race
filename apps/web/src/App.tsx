import { useCallback, useEffect, useState } from "react";
import { useConnectionStore } from "./store/connection.ts";
import { useClockStore } from "./store/clock.ts";
import { ws, getSessionCookie, clearSessionCookie } from "./net/ws.ts";
import { useRaceStore, resetRaceUi } from "./store/race.ts";
import { setCursorState, useCursorStore } from "./store/cursor.ts";
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
  const playerId = useConnectionStore((s) => s.playerId);
  const passageText = useRaceStore((s) => s.passageText);
  const raceEndResults = useRaceStore((s) => s.raceEndResults);
  const countdownStartsAtServerMs = useRaceStore((s) => s.countdownStartsAtServerMs);
  const raceStart = passageText !== null;
  const inCountdown = countdownStartsAtServerMs !== null;
  const inResults = raceEndResults !== null;

  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [isHost, setIsHost] = useState<boolean>(false);
  const [sessionTakenOver, setSessionTakenOver] = useState<boolean>(false);
  const [disconnectToasts, setDisconnectToasts] = useState<
    Array<{ playerId: string; nickname: string }>
  >([]);
  const [reconnectedNotice, setReconnectedNotice] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("typing_race_nickname") || "";
    }
    return "";
  });
  const [joinCode, setJoinCode] = useState<string>("");

  const handleNicknameChange = (val: string) => {
    setNickname(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("typing_race_nickname", val);
      (window as unknown as { __nickname?: string }).__nickname = val;
    }
  };

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
        console.warn("Clock sync failed:", err);
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
            setIsHost((prevHost) => {
              if (!prevHost && me.isHost) {
                addToast({
                  type: "success",
                  title: "Host Promoted",
                  body: "You are now the room host!",
                  durationMs: 4000,
                });
              }
              return me.isHost;
            });
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
        useRaceStore.setState((s) => ({
          lobbyPlayers: s.lobbyPlayers.filter((p) => p.playerId !== msg.playerId),
        }));
        useCursorStore.setState((s) => {
          const next = new Map(s.cursors);
          next.delete(msg.playerId);
          return { cursors: next };
        });
      }
      if (msg.type === "error") {
        let title = "Error";
        let body = msg.message;
        if (msg.code === "ROOM_NOT_FOUND") {
          title = "Room Lost";
          body = "Room lost — connection expired. Return to lobby or create a new room.";
        } else if (msg.code === "RATE_LIMITED") {
          if (
            msg.message &&
            (msg.message.includes("rooms") ||
              msg.message.includes("IP") ||
              msg.message.includes("hour"))
          ) {
            title = "Rate Limit";
            body =
              "Rate limit reached (max 10 rooms/hr). Wait 15 minutes or join an existing room.";
          } else {
            title = "Typing Throttled";
            body =
              "Keystroke rate limit exceeded (<20ms interval or race start grace).";
          }
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

  const handleLeaveRoom = useCallback(() => {
    if (roomCode) {
      clearSessionCookie(roomCode);
    }
    ws.send({ type: "leave_room" });
    if (typeof window !== "undefined") {
      window.location.hash = "";
    }
    setRoomCode(null);
    setIsHost(false);
    resetRaceUi();
    useRaceStore.setState({
      lobbyPlayers: [],
      passageText: null,
      raceEndResults: null,
      countdownStartsAtServerMs: null,
      hostPickedPassagePreview: null,
      ownCharStates: [],
      ownWpm: 0,
    });
    useCursorStore.setState({ ownIndex: 0, cursors: new Map() });
    addToast({
      type: "info",
      title: "Left Room",
      body: "You have left the race room.",
      durationMs: 3000,
    });
  }, [roomCode]);

  return (
    <main className="container">
      <ToastQueue />

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

      {!roomCode && !raceStart && !inCountdown && !inResults && (
        <div className="landing-view max-w-sm mx-auto w-full py-12 flex flex-col items-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-[#fefbe6] mb-8 font-mono">
            Typing Race
          </h1>

          <div className="w-full flex flex-col gap-4">
            <div className="flex flex-col text-left gap-1.5">
              <label
                htmlFor="nickname-input"
                className="text-xs font-semibold text-[#b5c48b] uppercase tracking-wider font-mono"
              >
                Nickname
              </label>
              <input
                id="nickname-input"
                type="text"
                className="w-full px-4 py-3 bg-[#15180c] border border-[#3c4626] rounded-xl text-[#fefbe6] placeholder-[#b5c48b]/50 focus:outline-none focus:border-[#cc6722] font-mono text-base transition-colors"
                placeholder="Enter your nickname"
                maxLength={20}
                value={nickname}
                onChange={(e) => handleNicknameChange(e.target.value)}
              />
            </div>

            <button
              type="button"
              className="w-full py-3.5 px-4 bg-[#cc6722] hover:bg-[#bd5119] text-[#fefbe6] font-bold rounded-xl transition-all shadow-lg hover:shadow-[#cc6722]/20 cursor-pointer text-base font-mono mt-1"
              onClick={() => {
                const nick = nickname.trim() || "Racer";
                ws.send({ type: "create_room", nickname: nick });
              }}
            >
              Create Room
            </button>

            <div className="flex items-center gap-3 my-2">
              <div className="flex-1 h-px bg-[#3c4626]/60" />
              <span className="text-xs text-[#b5c48b]/80 uppercase tracking-widest font-mono">
                or join room
              </span>
              <div className="flex-1 h-px bg-[#3c4626]/60" />
            </div>

            <div className="flex flex-col text-left gap-1.5">
              <label
                htmlFor="room-code-input"
                className="text-xs font-semibold text-[#b5c48b] uppercase tracking-wider font-mono"
              >
                Room Code
              </label>
              <input
                id="room-code-input"
                type="text"
                className="w-full px-4 py-3 bg-[#15180c] border border-[#3c4626] rounded-xl text-[#fefbe6] placeholder-[#b5c48b]/50 uppercase tracking-widest text-center font-mono text-base focus:outline-none focus:border-[#cc6722] transition-colors"
                placeholder="ABCDEF"
                maxLength={6}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              />
            </div>

            <button
              type="button"
              className="w-full py-3.5 px-4 bg-[#15180c] hover:bg-[#3c4626] border border-[#3c4626] text-[#fefbe6] font-bold rounded-xl transition-colors cursor-pointer text-base font-mono disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={joinCode.trim().length !== 6}
              onClick={() => {
                const nick = nickname.trim() || "Racer";
                ws.send({
                  type: "join_room",
                  code: joinCode.trim(),
                  nickname: nick,
                });
              }}
            >
              Join Room
            </button>
          </div>
        </div>
      )}

      {inCountdown && !raceStart && countdownStartsAtServerMs !== null && (
        <CountdownView startsAtServerMs={countdownStartsAtServerMs} />
      )}

      {roomCode && !raceStart && !inResults && !inCountdown && (
        <LobbyView
          roomCode={roomCode}
          isHost={isHost}
          onStartRace={(passageId, graceSeconds) => {
            ws.send({ type: "start_race", passageId, graceSeconds });
          }}
          onLeaveRoom={handleLeaveRoom}
        />
      )}

      {raceStart && playerId && passageText && !inResults && (
        <RaceView
          passageText={passageText}
          playerId={playerId}
          onKeystroke={onKeystroke}
          onCorrection={onCorrection}
          onLeaveRoom={handleLeaveRoom}
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
          onLeaveRoom={handleLeaveRoom}
        />
      )}
    </main>
  );
}