import {
  serverToClientSchema,
  type ServerToClient,
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

/**
 * Thin wrapper over the browser WebSocket. Opens a connection to the dev
 * proxy (which forwards to Bun on :8080), validates every inbound frame
 * against the shared Zod schema, and pushes updates into the Zustand stores.
 */
export class WsConnection {
  private url: string;
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private explicitlyClosed = false;
  private sessionTakenOver = false;
  private rejoining = false;
  /** Subscriber callbacks for app-level frame handlers (App.tsx, etc.) */
  private subscribers: ((frame: ServerToClient) => void)[] = [];

  constructor(url: string) {
    this.url = url;
  }

  connect(force = false): void {
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
        return; // Phase 1: drop silently
      }
      const msg = result.data;
      if (msg.type === "hello") {
        setConnectionStore({
          playerId: msg.playerId,
          serverTs: msg.serverTs,
        });
      }
      if (msg.type === "cursor_update") {
        const myId = useConnectionStore.getState().playerId;
        const charStates = (msg.charStates ?? []) as CharStateType[];
        const wpm = msg.wpm ?? 0;
        if (msg.playerId === myId) {
          // Authoritative ownIndex from server (esp. on backspace echo)
          setCursorState((s) => {
            if (s.cursors.has(msg.playerId)) {
              const next = new Map(s.cursors);
              next.delete(msg.playerId);
              return { cursors: next, ownIndex: msg.index };
            }
            return { ownIndex: msg.index };
          });
          // Merge states: preserve already-typed past characters (< msg.index) so errors don't turn grey
          const currentOwn = useRaceStore.getState().ownCharStates;
          const mergedStates = charStates.slice();
          for (let i = 0; i < msg.index; i++) {
            const own = currentOwn[i];
            if (mergedStates[i] === "pending" && own && own !== "pending") {
              mergedStates[i] = own;
            }
          }
          for (let i = msg.index; i < mergedStates.length; i++) {
            mergedStates[i] = "pending";
          }
          setRaceState({ ownCharStates: mergedStates, ownWpm: wpm });
        } else {
          // Opponent cursor
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
      }
      if (msg.type === "grace_countdown") {
        setRaceState({
          graceBanner: {
            leaderPlayerId: msg.leaderPlayerId,
            leaderNickname: msg.leaderNickname,
            remainingMs: msg.remainingMs,
          },
        });
      }
      if (msg.type === "race_end") {
        setCursorState({ cursors: new Map(), ownIndex: 0 });
        setRaceState({
          raceEndResults: msg.results ?? null,
          ownCharStates: [],
          ownWpm: 0,
          graceBanner: null,
          opponentWpm: {},
        });
      }
      if (msg.type === "countdown") {
        resetRaceUi();
        setRaceState({ countdownStartsAtServerMs: msg.startsAtServerMs });
      }
      if (msg.type === "race_start") {
        // New race (or rematch): reset race UI; passage text comes with race_start
        resetRaceUi();
        setRaceState({ passageText: msg.passageText });
      }
      if (msg.type === "return_to_lobby") {
        resetRaceUi();
      }
      if (msg.type === "joined_room") {
        setConnectionStore({ playerId: msg.playerId });
        if (msg.sessionToken) {
          setSessionCookie(msg.roomCode, msg.sessionToken);
        }
        // Sync server-stamped clockOffsetMs into the clock store on join
        setClockState({ offsetMs: msg.clockOffsetMs });
        setRaceState({
          hostPickedPassagePreview: msg.hostPickedPassagePreview ?? null,
        });
      }
      if (msg.type === "rejoined_room") {
        setConnectionStore({ playerId: msg.you.playerId });
        setClockState({ offsetMs: msg.clockOffsetMs });
        setRaceState({
          passageText: msg.passageText,
          ownCharStates: msg.you.charStates as CharStateType[],
          ownWpm: msg.you.wpm,
          countdownStartsAtServerMs: msg.startsAtServerMs,
          graceBanner: msg.graceEndsAtServerMs
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
      if (msg.type === "session_taken_over") {
        this.rejoining = false;
        this.sessionTakenOver = true;
        setConnectionStore({ status: "closed" });
      }
      if (msg.type === "rejoined_room") {
        this.rejoining = false;
        this.sessionTakenOver = false;
      }
      if (msg.type === "lobby_state") {
        setRaceState({
          hostPickedPassagePreview: msg.hostPickedPassagePreview ?? null,
        });
      }
      // Notify subscribers (App.tsx uses this for race_start / countdown / race_end transitions)
      for (const sub of this.subscribers) {
        try {
          sub(msg);
        } catch {
          // ignore
        }
      }
    });

    socket.addEventListener("close", () => {
      setConnectionStore({ status: "closed" });
      if (this.explicitlyClosed || this.sessionTakenOver) return;
      this.reconnectTimer = setTimeout(() => this.connect(), 1000);
    });

    socket.addEventListener("error", () => {
      // `close` will fire next; reconnect logic lives there.
    });
  }

  close(): void {
    this.explicitlyClosed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.close();
  }

  subscribe(handler: (frame: ServerToClient) => void): () => void {
    this.subscribers.push(handler);
    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== handler);
    };
  }

  /** Send a frame (if connection is open). */
  send(frame: object): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify(frame));
    return true;
  }

  /** Reclaim or join session across tabs */
  rejoin(roomCode: string, sessionToken: string): void {
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
}

const wsUrl =
  typeof window !== "undefined" &&
  (import.meta.env.DEV || import.meta.env.MODE === "development")
    ? "ws://localhost:5173/ws"
    : typeof window !== "undefined"
      ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`
      : "ws://localhost:5173/ws";

export const ws = new WsConnection(wsUrl);
ws.connect();