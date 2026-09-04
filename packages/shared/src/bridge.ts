import { EventEmitter } from "node:events";
import Redis from "ioredis";
import type { ClientToServer, ServerToClient } from "./messages.ts";

/** Inbound events: Gateway -> Engine */
export type GatewayToEngineEvent =
  | {
      type: "client_connected";
      playerId: string;
      ip: string;
      serverTs: number;
    }
  | {
      type: "client_disconnected";
      playerId: string;
      roomCode: string | null;
      serverTs: number;
    }
  | {
      type: "client_message";
      playerId: string;
      roomCode: string | null;
      ip: string;
      clientOffsetMs: number;
      message: ClientToServer;
      serverTs: number;
    };

/** Outbound events: Engine -> Gateway */
export type EngineToGatewayEvent =
  | {
      type: "broadcast_to_room";
      roomCode: string;
      payload: ServerToClient;
      excludePlayerId?: string;
    }
  | {
      type: "send_to_client";
      playerId: string;
      payload: ServerToClient;
    }
  | {
      type: "disconnect_client";
      playerId: string;
      code?: number;
      reason?: string;
    }
  | {
      type: "player_room_assigned";
      playerId: string;
      roomCode: string;
    }
  | {
      type: "player_room_cleared";
      playerId: string;
      roomCode: string;
    };

export interface EventBridge {
  publishToEngine(event: GatewayToEngineEvent): Promise<void> | void;
  publishToGateway(event: EngineToGatewayEvent): Promise<void> | void;
  onEngineEvent(handler: (event: GatewayToEngineEvent) => Promise<void> | void): () => void;
  onGatewayEvent(handler: (event: EngineToGatewayEvent) => Promise<void> | void): () => void;
  close(): Promise<void> | void;
}

export class InMemoryEventBridge implements EventBridge {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  publishToEngine(event: GatewayToEngineEvent): void {
    this.emitter.emit("engine", event);
  }

  publishToGateway(event: EngineToGatewayEvent): void {
    this.emitter.emit("gateway", event);
  }

  onEngineEvent(handler: (event: GatewayToEngineEvent) => Promise<void> | void): () => void {
    const listener = (event: GatewayToEngineEvent) => {
      void handler(event);
    };
    this.emitter.on("engine", listener);
    return () => {
      this.emitter.off("engine", listener);
    };
  }

  onGatewayEvent(handler: (event: EngineToGatewayEvent) => Promise<void> | void): () => void {
    const listener = (event: EngineToGatewayEvent) => {
      void handler(event);
    };
    this.emitter.on("gateway", listener);
    return () => {
      this.emitter.off("gateway", listener);
    };
  }

  close(): void {
    this.emitter.removeAllListeners();
  }
}

export class RedisEventBridge implements EventBridge {
  private pub: Redis;
  private sub: Redis;
  private engineHandlers = new Set<(event: GatewayToEngineEvent) => Promise<void> | void>();
  private gatewayHandlers = new Set<(event: EngineToGatewayEvent) => Promise<void> | void>();

  static readonly TO_ENGINE_CHANNEL = "typing_race:to_engine";
  static readonly TO_GATEWAY_CHANNEL = "typing_race:to_gateway";

  constructor(redisUrlOrClient: string | Redis, subClient?: Redis) {
    if (typeof redisUrlOrClient === "string") {
      this.pub = new Redis(redisUrlOrClient, { lazyConnect: true });
      this.sub = new Redis(redisUrlOrClient, { lazyConnect: true });
    } else {
      this.pub = redisUrlOrClient;
      this.sub = subClient ?? redisUrlOrClient.duplicate();
    }

    this.sub.subscribe(RedisEventBridge.TO_ENGINE_CHANNEL, RedisEventBridge.TO_GATEWAY_CHANNEL).catch(() => {
      // Lazy or unhandled sub error handled via error events
    });

    this.sub.on("message", (channel: string, message: string) => {
      try {
        const parsed = JSON.parse(message);
        if (channel === RedisEventBridge.TO_ENGINE_CHANNEL) {
          for (const handler of this.engineHandlers) {
            void handler(parsed as GatewayToEngineEvent);
          }
        } else if (channel === RedisEventBridge.TO_GATEWAY_CHANNEL) {
          for (const handler of this.gatewayHandlers) {
            void handler(parsed as EngineToGatewayEvent);
          }
        }
      } catch {
        // Ignore malformed frames
      }
    });
  }

  async publishToEngine(event: GatewayToEngineEvent): Promise<void> {
    await this.pub.publish(RedisEventBridge.TO_ENGINE_CHANNEL, JSON.stringify(event));
  }

  async publishToGateway(event: EngineToGatewayEvent): Promise<void> {
    await this.pub.publish(RedisEventBridge.TO_GATEWAY_CHANNEL, JSON.stringify(event));
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
    this.engineHandlers.clear();
    this.gatewayHandlers.clear();
    await Promise.all([this.pub.quit(), this.sub.quit()]);
  }
}
