import type { Server, ServerWebSocket } from "bun";
import type {
  EventBridge,
  GatewayToEngineEvent,
  EngineToGatewayEvent,
} from "@typing-race/shared/bridge";
import { logger } from "../logger.ts";

export interface LoopbackIpcServerOptions {
  host?: string;
  port?: number;
}

type IpcWsData = Record<string, never>;

export class LoopbackIpcServer implements EventBridge {
  private server?: Server<IpcWsData>;
  private clientSockets = new Set<ServerWebSocket<IpcWsData>>();
  private engineHandlers = new Set<(event: GatewayToEngineEvent) => Promise<void> | void>();
  private gatewayHandlers = new Set<(event: EngineToGatewayEvent) => Promise<void> | void>();
  public port: number;
  public host: string;

  constructor(options: LoopbackIpcServerOptions = {}) {
    this.host = options.host ?? "127.0.0.1";
    this.port = options.port ?? 8081;
  }

  start(): void {
    if (this.server) return;

    this.server = Bun.serve<IpcWsData>({
      hostname: this.host,
      port: this.port,
      fetch(req, server) {
        const success = server.upgrade(req, { data: {} });
        if (success) return undefined;
        return new Response("Loopback IPC endpoint", { status: 200 });
      },
      websocket: {
        open: (ws) => {
          this.clientSockets.add(ws);
          logger.info("[engine-ipc] gateway connected");
        },
        message: (_ws, message) => {
          try {
            const text = typeof message === "string" ? message : new TextDecoder().decode(message);
            const event = JSON.parse(text) as GatewayToEngineEvent;
            for (const handler of this.engineHandlers) {
              void handler(event);
            }
          } catch (err) {
            logger.warn({ err }, "[engine-ipc] failed to parse incoming frame");
          }
        },
        close: (ws) => {
          this.clientSockets.delete(ws);
          logger.info("[engine-ipc] gateway disconnected");
        },
      },
    });

    this.port = this.server.port ?? this.port;
    logger.info({ host: this.host, port: this.port }, "[engine-ipc] listening");
  }

  publishToEngine(event: GatewayToEngineEvent): void {
    for (const handler of this.engineHandlers) {
      void handler(event);
    }
  }

  publishToGateway(event: EngineToGatewayEvent): void {
    const json = JSON.stringify(event);
    for (const ws of this.clientSockets) {
      try {
        ws.send(json);
      } catch (err) {
        logger.warn({ err }, "[engine-ipc] failed to send to gateway client");
      }
    }
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
    for (const ws of this.clientSockets) {
      try {
        ws.close(1000, "Server shutting down");
      } catch {
        // ignore
      }
    }
    this.clientSockets.clear();
    this.engineHandlers.clear();
    this.gatewayHandlers.clear();
    if (this.server) {
      this.server.stop(true);
      this.server = undefined;
    }
  }
}
