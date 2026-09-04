import { ENGINE_HOST, ENGINE_PORT, MODE, REDIS_URL } from "./env.ts";
import { logger } from "./logger.ts";
import { InMemoryRoomStore } from "./rooms/store.ts";
import { EngineWorker } from "./engine.ts";
import { LoopbackIpcServer } from "./bridge/loopback-server.ts";
import {
  type EventBridge,
  RedisEventBridge,
  InMemoryEventBridge,
} from "@typing-race/shared/bridge";

const store = new InMemoryRoomStore();
let bridge: EventBridge;

if (REDIS_URL) {
  bridge = new RedisEventBridge(REDIS_URL);
  logger.info(`[engine] Headless worker running with RedisEventBridge on ${REDIS_URL}`);
} else if (MODE === "split") {
  const ipcServer = new LoopbackIpcServer({ host: ENGINE_HOST, port: ENGINE_PORT });
  ipcServer.start();
  bridge = ipcServer;
  logger.info(`[engine] Headless worker running on ${ENGINE_HOST}:${ipcServer.port}`);
} else {
  bridge = new InMemoryEventBridge();
  logger.info("[engine] Headless worker running with InMemoryEventBridge (unified mode)");
}

const worker = new EngineWorker(bridge, store);
worker.start();

const shutdown = async () => {
  logger.info("[engine] Shutting down gracefully...");
  worker.stop();
  await bridge.close();
  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});
