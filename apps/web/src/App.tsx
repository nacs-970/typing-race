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
import { ReconnectBanner } from "./components/ReconnectBanner.tsx";
import { ResultsBoard } from "./components/ResultsBoard.tsx";
import { ToastQueue } from "./components/ToastQueue.tsx";
import { SettingsPanel } from "./components/SettingsPanel.tsx";
import { hydrateSettings } from "./store/settings.ts";
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
  const raceEndFinishedIds = useRaceStore((s) => s.raceEndFinishedIds);
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

  // Apply saved (or default) color/font settings on mount
  useEffect(() => {
    hydrateSettings();
  }, []);

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
        if (msg.code === "ROOM_DOES_NOT_EXIST") {
          title = "Room Not Found";
          body = "Room does not exist. Check the code and try again.";
        } else if (msg.code === "ROOM_NOT_FOUND") {
          if (!roomCode) {
            title = "Room Not Found";
            body = "Room does not exist. Check the code and try again.";
          } else {
            title = "Room Lost";
            body = "Room lost — connection expired. Return to lobby or create a new room.";
          }
        } else if (msg.code === "ROOM_CLOSED") {
          title = "Alone in Room";
          body = "All other players have left this room.";
        } else if (msg.code === "ROOM_FULL") {
          title = "Room Full";
          body = "This room is already at maximum capacity (8 players).";
        } else if (msg.code === "SESSION_INVALID") {
          title = "Room Lost";
          body = "Room lost — connection expired. Return to lobby or create a new room.";
        } else if (msg.code === "SERVER_SHUTTING_DOWN") {
          title = "Server Restarting";
          body =
            "The server is restarting for maintenance. Please wait a moment and try rejoining.";
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
        if (
          typeof window !== "undefined" &&
          (msg.code === "ROOM_DOES_NOT_EXIST" ||
            msg.code === "ROOM_NOT_FOUND" ||
            msg.code === "SESSION_INVALID")
        ) {
          // Dead room/session — clear the URL hash so a stale room code
          // doesn't linger and re-trigger the same failed rejoin on reload.
          window.location.hash = "";
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
      <SettingsPanel />

      {sessionTakenOver && (
        <div className="session-taken-over-banner">
          <div>
            <strong>Session active in another tab</strong>
            <p className="m-0 mt-1 text-sm">
              This room is open in another tab. Click anywhere or press the button to resume here.
            </p>
          </div>
          <button
            type="button"
            onClick={reclaimSession}
            className="session-taken-over-button"
          >
            Resume in this tab
          </button>
        </div>
      )}

      <ReconnectBanner sessionTakenOver={sessionTakenOver} />

      <GraceBanner />

      {disconnectToasts.length > 0 && (
        <div className="disconnect-toasts my-2">
          {disconnectToasts.map((t) => (
            <div
              key={t.playerId}
              className="toast-disconnect"
            >
              <span>
                — <strong>{t.nickname}</strong> disconnected — waiting up to 60s for reconnect...
              </span>
              <button
                type="button"
                aria-label={`Dismiss disconnect notice for ${t.nickname}`}
                className="font-mono text-[13px] bg-transparent border-0 p-0 text-[var(--color-text-muted)] hover:text-[var(--color-text-bright)] cursor-pointer leading-none"
                onClick={() =>
                  setDisconnectToasts((prev) =>
                    prev.filter((d) => d.playerId !== t.playerId),
                  )
                }
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {reconnectedNotice && (
        <div className="toast-reconnected">
          — {reconnectedNotice}
        </div>
      )}

      {!roomCode && !raceStart && !inCountdown && !inResults && (
        <div className="landing-view w-full flex flex-col items-center">
          <span aria-hidden="true" className="fixed top-6 left-6 text-sm text-[var(--color-text-faint)] pointer-events-none select-none">+</span>
          <span aria-hidden="true" className="fixed top-6 right-6 text-sm text-[var(--color-text-faint)] pointer-events-none select-none">+</span>
          <span aria-hidden="true" className="fixed bottom-6 left-6 text-sm text-[var(--color-text-faint)] pointer-events-none select-none">+</span>
          <span aria-hidden="true" className="fixed bottom-6 right-6 text-sm text-[var(--color-text-faint)] pointer-events-none select-none">+</span>

          <div className="flex flex-col items-center pt-14 w-full">
            <h1 className="m-0 font-serif-display font-normal text-[clamp(2.75rem,13vw,96px)] leading-none tracking-[-0.01em] text-[var(--color-text-bright)]">
              Typing <em className="italic text-[var(--color-accent-green)]">Race.</em>
            </h1>

            <div className="w-full max-w-[420px] flex flex-col gap-[22px] mt-14">
              <div className="flex flex-col text-left gap-1.5">
                <label
                  htmlFor="nickname-input"
                  className="label"
                >
                  Nickname
                </label>
                <input
                  id="nickname-input"
                  type="text"
                  placeholder="your name"
                  className="font-mono text-[18px] text-[var(--color-text-bright)] placeholder:text-[var(--color-text-muted)] bg-transparent border-0 border-b border-[var(--color-text-bright)] py-2 px-0 outline-none"
                  maxLength={20}
                  value={nickname}
                  onChange={(e) => handleNicknameChange(e.target.value)}
                />
              </div>

              <button
                type="button"
                className="w-full font-mono text-base font-bold tracking-[0.04em] bg-[var(--color-accent-green)] hover:bg-[var(--color-accent-green-hover)] text-[var(--color-bg-base)] border border-[var(--color-accent-green)] rounded-none py-3.5 px-4 cursor-pointer transition-colors"
                onClick={() => {
                  const nick = nickname.trim() || "Racer";
                  ws.send({ type: "create_room", nickname: nick });
                }}
              >
                Create Room
              </button>

              <div className="flex items-center gap-3.5">
                <span className="flex-grow h-px bg-[var(--color-border-muted)]" />
                <span className="label text-[11px]">
                  or join a room
                </span>
                <span className="flex-grow h-px bg-[var(--color-border-muted)]" />
              </div>

              <div className="flex flex-col text-left gap-1.5">
                <label
                  htmlFor="room-code-input"
                  className="label"
                >
                  Room code
                </label>
                <input
                  id="room-code-input"
                  type="text"
                  placeholder="..."
                  className="font-mono text-[22px] tracking-[0.4em] text-center uppercase text-[var(--color-text-bright)] placeholder:text-[var(--color-text-muted)] bg-transparent border-0 border-b border-[var(--color-text-bright)] py-2 px-0 outline-none"
                  maxLength={6}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                />
              </div>

              <button
                type="button"
                className="w-full font-mono text-base font-bold tracking-[0.04em] bg-transparent text-[var(--color-text-bright)] border border-[var(--color-text-bright)] hover:bg-[var(--color-bg-surface-hover)] rounded-none py-3.5 px-4 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
        </div>
      )}

      {inCountdown && !raceStart && countdownStartsAtServerMs !== null && (
        <CountdownView startsAtServerMs={countdownStartsAtServerMs} />
      )}

      {roomCode && !raceStart && !inResults && !inCountdown && (
        <LobbyView
          roomCode={roomCode}
          isHost={isHost}
          onStartRace={(passageId, graceSeconds, corpusType, corpusCategory) => {
            ws.send({
              type: "start_race",
              ...(passageId ? { passageId } : {}),
              graceSeconds,
              corpusType,
              corpusCategory,
            });
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
          finishedPlayerIds={raceEndFinishedIds ?? undefined}
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
