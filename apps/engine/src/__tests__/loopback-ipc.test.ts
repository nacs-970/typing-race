import { describe, test, expect, afterEach } from "bun:test";
import { LoopbackIpcServer } from "../bridge/loopback-server.ts";
import type { GatewayToEngineEvent, EngineToGatewayEvent } from "@typing-race/shared/bridge";

describe("LoopbackIpcServer", () => {
  let server: LoopbackIpcServer;
  let ws: WebSocket;

  afterEach(async () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
    if (server) {
      await server.close();
    }
  });

  test("bi-directional event delivery over loopback WebSocket", async () => {
    server = new LoopbackIpcServer({ host: "127.0.0.1", port: 0 });
    server.start();

    const receivedByEngine: GatewayToEngineEvent[] = [];
    server.onEngineEvent((event) => {
      receivedByEngine.push(event);
    });

    const receivedByGatewayClient: EngineToGatewayEvent[] = [];

    // Connect test client WebSocket
    ws = new WebSocket(`ws://127.0.0.1:${server.port}`);

    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = (e) => reject(e);
    });

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data as string) as EngineToGatewayEvent;
      receivedByGatewayClient.push(data);
    };

    // 1. Gateway -> Engine transmission
    const inboundEvent: GatewayToEngineEvent = {
      type: "client_connected",
      playerId: "player-abc",
      ip: "127.0.0.1",
      serverTs: 12345,
    };
    ws.send(JSON.stringify(inboundEvent));

    await new Promise((r) => setTimeout(r, 50));
    expect(receivedByEngine).toHaveLength(1);
    expect(receivedByEngine[0]).toEqual(inboundEvent);

    // 2. Engine -> Gateway transmission
    const outboundEvent: EngineToGatewayEvent = {
      type: "player_room_assigned",
      playerId: "player-abc",
      roomCode: "XYZ123",
    };
    server.publishToGateway(outboundEvent);

    await new Promise((r) => setTimeout(r, 50));
    expect(receivedByGatewayClient).toHaveLength(1);
    expect(receivedByGatewayClient[0]).toEqual(outboundEvent);
  });
});
