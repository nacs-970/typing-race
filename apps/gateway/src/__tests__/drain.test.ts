import { test, expect, describe, afterEach, mock } from "bun:test";
import { InMemoryEventBridge } from "@typing-race/shared/bridge";
import { EngineWorker } from "@typing-race/engine";
import { InMemoryRoomStore } from "@typing-race/engine";
import { ClientManager } from "../ws/client-manager.ts";
import { bindBridgeToGateway } from "../ws/handlers.ts";
import { dispatch } from "../ws/dispatch.ts";
import { startGateway } from "../index.ts";

describe("Gateway drain", () => {
  let bridge: InMemoryEventBridge;
  let manager: ClientManager;
  let worker: EngineWorker;
  let unbind: () => void;

  afterEach(() => {
    unbind?.();
    manager?.clear();
    worker?.stop();
    bridge?.close();
  });

  test("E2E contract: Engine.drain() -> Gateway broadcasts SERVER_SHUTTING_DOWN + rejects new", async () => {
    bridge = new InMemoryEventBridge();
    const store = new InMemoryRoomStore();
    worker = new EngineWorker(bridge, store);
    worker.start();

    manager = new ClientManager();
    unbind = bindBridgeToGateway(bridge, manager);

    const ws = {
      data: { playerId: crypto.randomUUID() },
      send: mock(() => {}),
    } as any;
    manager.addSocket(ws.data.playerId, ws);

    await worker.drain(100, 10);

    expect(ws.send).toHaveBeenCalled();
    const sent = JSON.parse(ws.send.mock.calls[0][0]);
    expect(sent).toEqual({ type: "error", code: "SERVER_SHUTTING_DOWN", message: "Server is shutting down" });
    expect(manager.isDraining()).toBe(true);

    const ws2 = {
      data: { playerId: crypto.randomUUID() },
      send: mock(() => {}),
    } as any;
    
    let engineEvents = 0;
    bridge.onEngineEvent(() => { engineEvents++; });

    dispatch(ws2, JSON.stringify({ type: "create_room", nickname: "bob" }), bridge, manager);
    
    expect(ws2.send).toHaveBeenCalled();
    expect(JSON.parse(ws2.send.mock.calls[0][0])).toEqual({ type: "error", code: "SERVER_SHUTTING_DOWN", message: "Server is shutting down" });
    expect(engineEvents).toBe(0);
  });
  
  test("GatewayInstance.drain() in unified mode", async () => {
    const inst = await startGateway({ mode: "unified", port: 0 });
    
    const ws = {
      data: { playerId: crypto.randomUUID() },
      send: mock(() => {}),
    } as any;
    inst.clientManager.addSocket(ws.data.playerId, ws);
    
    await inst.drain(50);
    
    expect(inst.clientManager.isDraining()).toBe(true);
    expect(ws.send).toHaveBeenCalled();
    
    await inst.stop();
  });

  test("GatewayInstance.drain() in split mode", async () => {
    const inst = await startGateway({ mode: "split", port: 0 });
    
    const ws = {
      data: { playerId: crypto.randomUUID() },
      send: mock(() => {}),
    } as any;
    inst.clientManager.addSocket(ws.data.playerId, ws);
    
    const p = inst.drain(500);
    
    // Simulate engine draining
    await inst.bridge.publishToGateway({ type: "drained" });
    
    await p;
    
    expect(inst.clientManager.isDraining()).toBe(true);
    expect(ws.send).toHaveBeenCalled();
    
    await inst.stop();
  });
});
