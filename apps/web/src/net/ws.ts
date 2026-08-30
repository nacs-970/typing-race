import {
  serverToClientSchema,
  type ServerToClient,
} from "@typing-race/shared";
import { setConnectionStore } from "../store/store-bridge.ts";
import { setCursorState } from "../store/cursor.ts";
import { setClockState } from "../store/clock.ts";

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
  /** Subscriber callbacks for app-level frame handlers (App.tsx, etc.) */
  private subscribers: ((frame: ServerToClient) => void)[] = [];

  constructor(url: string) {
    this.url = url;
  }

  connect(): void {
    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) return;
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
        // Opponent cursor (filter our own — server already broadcasts to all)
        setCursorState((s) => {
          const next = new Map(s.cursors);
          next.set(msg.playerId, {
            playerId: msg.playerId,
            index: msg.index,
            serverTs: msg.serverTs,
          });
          return { cursors: next };
        });
      }
      if (msg.type === "race_end") {
        setCursorState({ cursors: new Map(), ownIndex: 0 });
      }
      if (msg.type === "joined_room") {
        // Sync server-stamped clockOffsetMs into the clock store on join
        // (HTTP /api/clock-sync already ran on mount; this is the backup)
        setClockState({ offsetMs: msg.clockOffsetMs });
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
      if (this.explicitlyClosed) return;
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
}

const wsUrl =
  import.meta.env.DEV || import.meta.env.MODE === "development"
    ? "ws://localhost:5173/ws"
    : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`;

export const ws = new WsConnection(wsUrl);
ws.connect();