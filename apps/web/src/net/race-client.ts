import {
  serverToClientSchema,
  type ServerToClient,
  type ClientToServer,
} from "@typing-race/shared";
import { setConnectionStore } from "../store/store-bridge.ts";
import { setCursorState } from "../store/cursor.ts";
import { setClockState } from "../store/clock.ts";
import {
  setRaceState,
  resetRaceUi,
  useRaceStore,
  type CharState as CharStateType,
} from "../store/race.ts";
import { useConnectionStore } from "../store/connection.ts";

export function getSessionCookie(roomCode: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)typing_race_${roomCode}=([^;]+)`),
  );
  return match && match[1] ? decodeURIComponent(match[1]) : null;
}

export function setSessionCookie(roomCode: string, sessionToken: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `typing_race_${roomCode}=${encodeURIComponent(sessionToken)}; path=/; max-age=86400; SameSite=Lax`;
}

export function clearSessionCookie(roomCode: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `typing_race_${roomCode}=; path=/; max-age=0; SameSite=Lax`;
}

export class RaceClient {
  private url: string;
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private explicitlyClosed = false;
  private sessionTakenOver = false;
  private rejoining = false;
  private subscribers: Set<(frame: ServerToClient) => void> = new Set();

  constructor(url: string) {
    this.url = url;
  }

  public connect(force = false): void {
    if (
      !force &&
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    if (this.socket) {
      try {
        this.socket.onclose = null;
        this.socket.onerror = null;
        this.socket.onmessage = null;
        this.socket.onopen = null;
        this.socket.close();
      } catch {
        // ignore
      }
      this.socket = null;
    }

    this.explicitlyClosed = false;
    setConnectionStore({ status: "connecting" });

    const socket = new WebSocket(this.url);
    this.socket = socket;

    socket.addEventListener("open", () => {
      setConnectionStore({ status: "open" });
    });

    socket.addEventListener("message", (ev) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(typeof ev.data === "string" ? ev.data : "");
      } catch {
        return;
      }

      const result = serverToClientSchema.safeParse(parsed);
      if (!result.success) {
        return;
      }

      this.dispatch(result.data);
    });

    socket.addEventListener("close", () => {
      setConnectionStore({ status: "closed" });
      if (this.explicitlyClosed || this.sessionTakenOver) return;
      this.reconnectTimer = setTimeout(() => this.connect(), 1000);
    });

    socket.addEventListener("error", () => {
      // close will fire next; reconnect logic lives there
    });
  }

  public disconnect(): void {
    this.explicitlyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
  }

  public close(): void {
    this.disconnect();
  }

  public send(frame: ClientToServer | object): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      return false;
    }
    this.socket.send(JSON.stringify(frame));
    return true;
  }

  public subscribe(handler: (frame: ServerToClient) => void): () => void {
    this.subscribers.add(handler);
    return () => {
      this.subscribers.delete(handler);
    };
  }

  public rejoin(roomCode: string, sessionToken: string): void {
    if (this.rejoining) return;
    this.rejoining = true;
    this.sessionTakenOver = false;
    this.explicitlyClosed = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const resetRejoiningTimeout = setTimeout(() => {
      this.rejoining = false;
    }, 3000);

    const sendRejoin = () => {
      clearTimeout(resetRejoiningTimeout);
      return this.send({
        type: "rejoin_room",
        roomCode,
        sessionToken,
      });
    };

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      sendRejoin();
    } else {
      this.connect(true);
      if (this.socket) {
        this.socket.addEventListener(
          "open",
          () => {
            sendRejoin();
          },
          { once: true },
        );
      }
    }
  }

  public dispatch(msg: ServerToClient): void {
    if (msg.type === "hello") {
      setConnectionStore({
        playerId: msg.playerId,
        serverTs: msg.serverTs,
      });
    } else if (msg.type === "cursor_update") {
      const myId = useConnectionStore.getState().playerId;
      const charStates = (msg.charStates ?? []) as CharStateType[];
      const wpm = msg.wpm ?? 0;

      const raceStartMs = useRaceStore.getState().countdownStartsAtServerMs ?? msg.serverTs;
      setRaceState((s) => ({
        wpmHistory: {
          ...s.wpmHistory,
          [msg.playerId]: [
            ...(s.wpmHistory[msg.playerId] ?? []),
            { t: msg.serverTs - raceStartMs, wpm },
          ],
        },
      }));

      if (msg.playerId === myId) {
        setCursorState((s) => {
          if (s.cursors.has(msg.playerId)) {
            const next = new Map(s.cursors);
            next.delete(msg.playerId);
            return { cursors: next, ownIndex: msg.index };
          }
          return { ownIndex: msg.index };
        });

        const currentOwn = useRaceStore.getState().ownCharStates;
        const mergedStates = charStates.slice();
        for (let i = 0; i < msg.index; i++) {
          const own = currentOwn[i];
          if (mergedStates[i] === "pending" && own && own !== "pending") {
            mergedStates[i] = own;
          } else if (mergedStates[i] === "pending") {
            mergedStates[i] = "error";
          }
        }
        for (let i = msg.index; i < mergedStates.length; i++) {
          mergedStates[i] = "pending";
        }
        setRaceState({ ownCharStates: mergedStates, ownWpm: wpm });
      } else {
        setCursorState((s) => {
          const next = new Map(s.cursors);
          next.set(msg.playerId, {
            playerId: msg.playerId,
            index: msg.index,
            serverTs: msg.serverTs,
          });
          return { cursors: next };
        });
        setRaceState((s) => ({
          opponentWpm: { ...s.opponentWpm, [msg.playerId]: wpm },
        }));
      }
    } else if (msg.type === "grace_countdown") {
      setRaceState({
        graceBanner: {
          leaderPlayerId: msg.leaderPlayerId,
          leaderNickname: msg.leaderNickname,
          remainingMs: msg.remainingMs,
        },
      });
    } else if (msg.type === "race_end") {
      setCursorState({ cursors: new Map(), ownIndex: 0 });
      setRaceState({
        raceEndResults: msg.results ?? null,
        raceEndFinishedIds: msg.finishedPlayerIds ?? null,
        ownCharStates: [],
        ownWpm: 0,
        graceBanner: null,
        opponentWpm: {},
      });
    } else if (msg.type === "countdown") {
      resetRaceUi();
      setRaceState({ countdownStartsAtServerMs: msg.startsAtServerMs });
    } else if (msg.type === "race_start") {
      resetRaceUi();
      setRaceState({ passageText: msg.passageText });
    } else if (msg.type === "return_to_lobby") {
      resetRaceUi();
    } else if (msg.type === "joined_room") {
      setConnectionStore({ playerId: msg.playerId });
      if (msg.sessionToken) {
        setSessionCookie(msg.roomCode, msg.sessionToken);
      }
      setClockState({ offsetMs: msg.clockOffsetMs });
      setRaceState({
        hostPickedPassagePreview: msg.hostPickedPassagePreview ?? null,
        lobbyPlayers: msg.players,
        ...(msg.corpusType ? { corpusType: msg.corpusType } : {}),
        ...(msg.corpusCategory ? { corpusCategory: msg.corpusCategory } : {}),
      });
    } else if (msg.type === "rejoined_room") {
      setConnectionStore({ playerId: msg.you.playerId });
      setClockState({ offsetMs: msg.clockOffsetMs });
      this.rejoining = false;
      this.sessionTakenOver = false;

      if (msg.roomState === "lobby") {
        resetRaceUi();
        setRaceState({ lobbyPlayers: msg.players });
      } else {
        const rawCharStates = (msg.you.charStates ?? []) as CharStateType[];
        const ownCharStates = rawCharStates.map((st, i) =>
          i < msg.you.progress && st === "pending" ? "error" : st,
        );
        setRaceState({
          passageText: msg.passageText,
          ownCharStates,
          ownWpm: msg.you.wpm,
          countdownStartsAtServerMs: msg.startsAtServerMs,
          lobbyPlayers: msg.players,
          graceBanner:
            msg.roomState === "grace" &&
            msg.graceEndsAtServerMs !== null &&
            msg.graceEndsAtServerMs > Date.now()
              ? {
                  leaderPlayerId: "",
                  leaderNickname: "",
                  remainingMs: Math.max(0, msg.graceEndsAtServerMs - Date.now()),
                }
              : null,
        });
        const cursors = new Map<string, { playerId: string; index: number; serverTs: number }>();
        const opponentWpm: Record<string, number> = {};
        for (const p of msg.players) {
          if (p.playerId !== msg.you.playerId) {
            cursors.set(p.playerId, {
              playerId: p.playerId,
              index: p.progress,
              serverTs: Date.now(),
            });
            opponentWpm[p.playerId] = p.wpm;
          }
        }
        setCursorState({ cursors, ownIndex: msg.you.progress });
        setRaceState({ opponentWpm });
      }
    } else if (msg.type === "session_taken_over") {
      this.rejoining = false;
      this.sessionTakenOver = true;
      setConnectionStore({ status: "closed" });
    } else if (msg.type === "lobby_state") {
      setRaceState({
        hostPickedPassagePreview: msg.hostPickedPassagePreview ?? null,
        lobbyPlayers: msg.players,
        ...(msg.corpusType ? { corpusType: msg.corpusType } : {}),
        ...(msg.corpusCategory ? { corpusCategory: msg.corpusCategory } : {}),
      });
    }

    for (const sub of this.subscribers) {
      try {
        sub(msg);
      } catch (err) {
        console.error("Error in RaceClient subscriber:", err);
      }
    }
  }

  public getSocket(): WebSocket | null {
    return this.socket;
  }
}

let defaultRaceClient: RaceClient | null = null;

export function getRaceClient(url?: string): RaceClient {
  if (!defaultRaceClient) {
    const envWsUrl = typeof import.meta !== "undefined" ? import.meta.env?.VITE_WS_URL : undefined;
    const dynamicWsUrl =
      typeof window !== "undefined"
        ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`
        : "ws://localhost:5173/ws";
    const wsUrl = url ?? envWsUrl ?? dynamicWsUrl;
    defaultRaceClient = new RaceClient(wsUrl);
  }
  return defaultRaceClient;
}

export function initRaceClient(url: string): RaceClient {
  defaultRaceClient = new RaceClient(url);
  return defaultRaceClient;
}
