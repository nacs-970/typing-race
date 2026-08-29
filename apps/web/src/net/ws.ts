import { serverToClientSchema } from "@typing-race/shared";
import { setConnectionStore } from "../store/store-bridge.ts";

/**
 * Thin wrapper over the browser WebSocket. Opens a connection to the dev
 * proxy (which forwards to Bun on :8080), validates every inbound frame
 * against the shared Zod schema, and pushes updates into the Zustand store.
 *
 * Phase 1: auto-reconnect on close with a 1s backoff.
 * Phase 3: replace with a smarter reconnect (exponential, jitter, leader-aware).
 */
export class WsConnection {
  private url: string;
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private explicitlyClosed = false;

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
        // ignore malformed frames
        return;
      }
      const result = serverToClientSchema.safeParse(parsed);
      if (!result.success) {
        // Phase 1: drop silently; future phase may surface to UI
        return;
      }
      const msg = result.data;
      if (msg.type === "hello") {
        setConnectionStore({
          playerId: msg.playerId,
          serverTs: msg.serverTs,
        });
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
}

/**
 * In dev, Vite proxies ws://localhost:5173/ws → ws://localhost:8080/ws.
 * In prod, the SPA is served from the same origin, so use the relative /ws.
 */
const wsUrl =
  import.meta.env.DEV || import.meta.env.MODE === "development"
    ? "ws://localhost:5173/ws"
    : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`;

export const ws = new WsConnection(wsUrl);
ws.connect();