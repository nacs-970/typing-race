import { describe, expect, it, vi } from "bun:test";
import {
  InMemoryEventBridge,
  RedisEventBridge,
  type GatewayToEngineEvent,
  type EngineToGatewayEvent,
} from "../bridge.ts";

describe("InMemoryEventBridge", () => {
  it("routes publishToEngine to onEngineEvent subscribers", () => {
    const bridge = new InMemoryEventBridge();
    const received: GatewayToEngineEvent[] = [];

    bridge.onEngineEvent((event) => {
      received.push(event);
    });

    const event: GatewayToEngineEvent = {
      type: "client_connected",
      playerId: "player-1",
      ip: "127.0.0.1",
      serverTs: 1000,
    };

    bridge.publishToEngine(event);

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(event);
    bridge.close();
  });

  it("routes publishToGateway to onGatewayEvent subscribers", () => {
    const bridge = new InMemoryEventBridge();
    const received: EngineToGatewayEvent[] = [];

    bridge.onGatewayEvent((event) => {
      received.push(event);
    });

    const event: EngineToGatewayEvent = {
      type: "send_to_client",
      playerId: "player-1",
      payload: {
        type: "hello",
        playerId: "00000000-0000-0000-0000-000000000001",
        serverTs: 1000,
      },
    };

    bridge.publishToGateway(event);

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(event);
    bridge.close();
  });

  it("unsubscribe functions prevent further invocations", () => {
    const bridge = new InMemoryEventBridge();
    let engineCount = 0;
    let gatewayCount = 0;

    const unsubEngine = bridge.onEngineEvent(() => {
      engineCount++;
    });
    const unsubGateway = bridge.onGatewayEvent(() => {
      gatewayCount++;
    });

    bridge.publishToEngine({
      type: "client_disconnected",
      playerId: "p1",
      roomCode: "ABC123",
      serverTs: 2000,
    });
    bridge.publishToGateway({
      type: "player_room_assigned",
      playerId: "p1",
      roomCode: "ABC123",
    });

    expect(engineCount).toBe(1);
    expect(gatewayCount).toBe(1);

    unsubEngine();
    unsubGateway();

    bridge.publishToEngine({
      type: "client_disconnected",
      playerId: "p1",
      roomCode: "ABC123",
      serverTs: 3000,
    });
    bridge.publishToGateway({
      type: "player_room_assigned",
      playerId: "p1",
      roomCode: "ABC123",
    });

    expect(engineCount).toBe(1);
    expect(gatewayCount).toBe(1);

    bridge.close();
  });
});

describe("RedisEventBridge", () => {
  it("exports cleanly and provides interface methods with mock clients", async () => {
    expect(RedisEventBridge).toBeDefined();

    const mockPub = {
      publish: vi.fn(async () => 1),
      quit: vi.fn(async () => "OK"),
    } as any;

    const mockSub = {
      subscribe: vi.fn(async () => 1),
      on: vi.fn(),
      quit: vi.fn(async () => "OK"),
    } as any;

    const bridge = new RedisEventBridge(mockPub, mockSub);

    expect(typeof bridge.publishToEngine).toBe("function");
    expect(typeof bridge.publishToGateway).toBe("function");
    expect(typeof bridge.onEngineEvent).toBe("function");
    expect(typeof bridge.onGatewayEvent).toBe("function");
    expect(typeof bridge.close).toBe("function");

    const event: GatewayToEngineEvent = {
      type: "client_connected",
      playerId: "p1",
      ip: "127.0.0.1",
      serverTs: 100,
    };

    await bridge.publishToEngine(event);
    expect(mockPub.publish).toHaveBeenCalledWith(
      RedisEventBridge.TO_ENGINE_CHANNEL,
      JSON.stringify(event)
    );

    const gatewayEvent: EngineToGatewayEvent = {
      type: "player_room_cleared",
      playerId: "p1",
      roomCode: "XYZ999",
    };

    await bridge.publishToGateway(gatewayEvent);
    expect(mockPub.publish).toHaveBeenCalledWith(
      RedisEventBridge.TO_GATEWAY_CHANNEL,
      JSON.stringify(gatewayEvent)
    );

    await bridge.close();
    expect(mockPub.quit).toHaveBeenCalled();
    expect(mockSub.quit).toHaveBeenCalled();
  });
});
