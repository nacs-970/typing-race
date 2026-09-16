import type { Server } from "bun";
import {
  PORT,
  HOST,
  MODE,
  REDIS_URL,
  ENGINE_HOST,
  ENGINE_PORT,
} from "./env.ts";
import { logger } from "./logger.ts";
import routes from "./routes.ts";
import { ClientManager, clientManager } from "./ws/client-manager.ts";
import {
  createWebSocketHandlers,
  bindBridgeToGateway,
  startHeartbeat,
  type WsData,
} from "./ws/handlers.ts";
import { LoopbackIpcClient } from "./bridge/loopback-client.ts";
import {
  type EventBridge,
  InMemoryEventBridge,
  RedisEventBridge,
} from "@typing-race/shared/bridge";

export interface GatewayOptions {
  port?: number;
  host?: string;
  mode?: "unified" | "split";
  redisUrl?: string;
  engineHost?: string;
  enginePort?: number;
  manager?: ClientManager;
}

export interface GatewayInstance {
  server: Server<WsData>;
  port: number;
  bridge: EventBridge;
  clientManager: ClientManager;
  engineWorker?: { stop: () => void; drain?: (timeoutMs?: number) => Promise<void> };
  drain: (timeoutMs?: number) => Promise<void>;
  stop: () => Promise<void>;
}

export async function startGateway(
  options: GatewayOptions = {},
): Promise<GatewayInstance> {
  const port = options.port ?? PORT;
  const host = options.host ?? HOST;
  const mode = options.mode ?? MODE;
  const redisUrl = options.redisUrl ?? REDIS_URL;
  const engineHost = options.engineHost ?? ENGINE_HOST;
  const enginePort = options.enginePort ?? ENGINE_PORT;
  const manager = options.manager ?? clientManager;

  let bridge: EventBridge;
  let engineWorker: { stop: () => void; drain?: (timeoutMs?: number) => Promise<void> } | undefined;

  if (redisUrl) {
    bridge = new RedisEventBridge(redisUrl);
    logger.info(`[gateway] Running with RedisEventBridge on ${redisUrl}`);
  } else if (mode === "unified") {
    bridge = new InMemoryEventBridge();
    const { EngineWorker, InMemoryRoomStore } = await import("@typing-race/engine");
    const store = new InMemoryRoomStore();
    const worker = new EngineWorker(bridge, store);
    worker.start();
    engineWorker = worker;
    logger.info("[gateway] Running in UNIFIED mode (Gateway + Engine in single process)");
  } else {
    const ipcClient = new LoopbackIpcClient({ host: engineHost, port: enginePort });
    ipcClient.connect();
    bridge = ipcClient;
    logger.info(`[gateway] Running in SPLIT mode (connecting to Engine on ${engineHost}:${enginePort})`);
  }

  const unbindBridge = bindBridgeToGateway(bridge, manager);
  const wsHandlers = createWebSocketHandlers(bridge, manager);

  const server = Bun.serve<WsData>({
    port,
    hostname: host,
    fetch(req, srv) {
      const url = new URL(req.url);

      if (url.pathname === "/ws") {
        const playerId = crypto.randomUUID();
        const clientIp =
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          srv.requestIP(req)?.address ??
          "127.0.0.1";

        const success = srv.upgrade(req, {
          data: {
            playerId,
            roomCode: null,
            ip: clientIp,
            lastPingAt: Date.now(),
            lastPongAt: Date.now(),
            clientOffsetMs: 0,
          } satisfies WsData,
        });
        if (success) return undefined;
        return new Response("WebSocket upgrade failed", { status: 400 });
      }

      return routes.fetch(req);
    },

    websocket: wsHandlers,

    error(err) {
      logger.error({ err }, "[gateway] server error");
      return new Response("Internal Server Error", { status: 500 });
    },
  });

  const heartbeatTimer = startHeartbeat(manager);
  const actualPort = server.port ?? port;

  logger.info({ port: actualPort, host, mode }, "[gateway] listening");

  let drainPromise: Promise<void> | undefined;
  const drain = async (timeoutMs = 90_000) => {
    if (drainPromise) return drainPromise;
    drainPromise = (async () => {
      manager.setDraining(true);
      // marks that THIS gateway's own drain cycle has started, synchronously
      // and before any await, so a concurrent unrelated 'drained' event cannot
      // be mistaken for this cycle's own (06.1).
      manager.markOwnDrainStarted();

      if (engineWorker && engineWorker.drain) {
        // The "draining" event published by engineWorker.drain() is delivered
        // back to this same process via the bridge and handled by
        // bindBridgeToGateway's "draining" case, which broadcasts
        // SERVER_SHUTTING_DOWN. Don't double-send here.
        await engineWorker.drain(timeoutMs);
      } else {
        // Split/Redis mode: the engine's own independent SIGTERM handler can
        // also publish "draining" for its own shutdown, which bindBridgeToGateway
        // broadcasts. Gate through announceShuttingDownOnce() so whichever path
        // fires first wins and the client never gets two SERVER_SHUTTING_DOWN
        // frames for one shutdown (WR-01, split-mode case).
        if (manager.announceShuttingDownOnce()) {
          manager.broadcastAll({ type: "error", code: "SERVER_SHUTTING_DOWN", message: "Server is shutting down" });
        }
        if (manager.isDrained()) {
          // The engine's "drained" event already arrived (and was latched by
          // bindBridgeToGateway's "drained" case) before we started
          // listening here — nothing left to wait for (CR-01).
        } else {
          let unsubscribe: (() => void) | undefined;
          let timer: ReturnType<typeof setTimeout> | undefined;
          const eventPromise = new Promise<void>((resolve) => {
            unsubscribe = bridge.onGatewayEvent((event) => {
              if (event.type === "drained") {
                resolve();
              }
            });
          });
          const timeoutPromise = new Promise<void>((resolve) => {
            timer = setTimeout(resolve, timeoutMs);
          });
          await Promise.race([eventPromise, timeoutPromise]);
          if (unsubscribe) unsubscribe();
          if (timer) clearTimeout(timer);
        }
      }
    })();
    return drainPromise;
  };

  const stop = async () => {
    clearInterval(heartbeatTimer);
    unbindBridge();
    server.stop(true);
    if (engineWorker) {
      engineWorker.stop();
    }
    await bridge.close();
    manager.clear();
  };

  return {
    server,
    port: actualPort,
    bridge,
    clientManager: manager,
    engineWorker,
    drain,
    stop,
  };
}

if (import.meta.main) {
  startGateway().then((instance) => {
    let shuttingDown = false;
    const onShutdown = async (sig: string) => {
      if (shuttingDown) return;
      shuttingDown = true;
      logger.info({ sig }, "[gateway] shutting down...");
      // Clear any stale "drained" latch left by an unrelated PRIOR engine
      // restart (split mode: the engine's own SIGTERM/drain cycle publishes
      // "drained" independently of this gateway's lifecycle, e.g. a crash
      // restart under docker-compose's `restart: unless-stopped`). Without
      // this, a stray latch from hours earlier would make THIS drain() skip
      // waiting for the CURRENT shutdown's in-flight races (CR-B1).
      instance.clientManager.setDrained(false);
      await instance.drain(90_000);
      await instance.stop();
      process.exit(0);
    };

    process.on("SIGINT", () => void onShutdown("SIGINT"));
    process.on("SIGTERM", () => void onShutdown("SIGTERM"));
  });
}
