import type {
  EventBridge,
  GatewayToEngineEvent,
  EngineToGatewayEvent,
} from "@typing-race/shared/bridge";
import { logger } from "../logger.ts";

export interface LoopbackIpcClientOptions {
  host?: string;
  port?: number;
  maxReconnectDelayMs?: number;
}

export class LoopbackIpcClient implements EventBridge {
  private url: string;
  private ws?: WebSocket;
  private isClosed = false;
  private reconnectTimer?: NodeJS.Timeout;
  private reconnectDelay = 500;
  private maxReconnectDelay: number;
  private pendingQueue: GatewayToEngineEvent[] = [];
  private engineHandlers = new Set<(event: GatewayToEngineEvent) => Promise<void> | void>();
  private gatewayHandlers = new Set<(event: EngineToGatewayEvent) => Promise<void> | void>();

  constructor(options: LoopbackIpcClientOptions = {}) {
    const host = options.host ?? "127.0.0.1";
    const port = options.port ?? 8081;
    this.url = `ws://${host}:${port}`;
    this.maxReconnectDelay = options.maxReconnectDelayMs ?? 5000;
  }

  connect(): void {
    if (this.isClosed) return;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        logger.info({ url: this.url }, "[gateway-ipc] connected to engine");
        this.reconnectDelay = 500;
        this.flushPending();
      };

      this.ws.onmessage = (event) => {
        try {
          const text = typeof event.data === "string" ? event.data : new TextDecoder().decode(event.data as ArrayBuffer);
          const parsed = JSON.parse(text) as EngineToGatewayEvent;
          for (const handler of this.gatewayHandlers) {
            void handler(parsed);
          }
        } catch (err) {
          logger.warn({ err }, "[gateway-ipc] failed to parse incoming frame");
        }
      };

      this.ws.onclose = () => {
        if (!this.isClosed) {
          logger.warn({ url: this.url }, "[gateway-ipc] connection closed, scheduling reconnect");
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        logger.warn({ err }, "[gateway-ipc] connection error");
      };
    } catch (err) {
      logger.error({ err }, "[gateway-ipc] failed to create WebSocket");
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.isClosed || this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect();
    }, this.reconnectDelay);

    this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay);
  }

  private flushPending(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    while (this.pendingQueue.length > 0) {
      const event = this.pendingQueue.shift();
      if (event) {
        try {
          this.ws.send(JSON.stringify(event));
        } catch (err) {
          logger.warn({ err }, "[gateway-ipc] failed to flush pending event");
          this.pendingQueue.unshift(event);
          break;
        }
      }
    }
  }

  publishToEngine(event: GatewayToEngineEvent): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(event));
      } catch (err) {
        logger.warn({ err }, "[gateway-ipc] failed to send event, queuing");
        this.pendingQueue.push(event);
      }
    } else {
      if (this.pendingQueue.length < 500) {
        this.pendingQueue.push(event);
      } else {
        logger.warn("[gateway-ipc] pending queue full, dropping event");
      }
    }

    for (const handler of this.engineHandlers) {
      void handler(event);
    }
  }

  publishToGateway(event: EngineToGatewayEvent): void {
    for (const handler of this.gatewayHandlers) {
      void handler(event);
    }
  }

  onEngineEvent(handler: (event: GatewayToEngineEvent) => Promise<void> | void): () => void {
    this.engineHandlers.add(handler);
    return () => {
      this.engineHandlers.delete(handler);
    };
  }

  onGatewayEvent(handler: (event: EngineToGatewayEvent) => Promise<void> | void): () => void {
    this.gatewayHandlers.add(handler);
    return () => {
      this.gatewayHandlers.delete(handler);
    };
  }

  async close(): Promise<void> {
    this.isClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    if (this.ws) {
      try {
        this.ws.close(1000, "Client closed");
      } catch {
        // ignore
      }
      this.ws = undefined;
    }
    this.pendingQueue = [];
    this.engineHandlers.clear();
    this.gatewayHandlers.clear();
  }
}
