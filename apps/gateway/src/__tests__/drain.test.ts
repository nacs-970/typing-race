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
    // WR-01 regression: unified mode must broadcast SERVER_SHUTTING_DOWN
    // exactly once (via the engineWorker's "draining" event), not once
    // directly plus once again through the bridge.
    expect(ws.send).toHaveBeenCalledTimes(1);

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

  test("CR-01: drain() resolves promptly if \"drained\" arrives before drain() is called", async () => {
    const manager = new ClientManager();
    const inst = await startGateway({ mode: "split", port: 0, manager });

    // Simulate the engine's SIGTERM handler winning the race and publishing
    // "drained" before the gateway's own drain() has started listening.
    await inst.bridge.publishToGateway({ type: "drained" });

    const ws = {
      data: { playerId: crypto.randomUUID() },
      send: mock(() => {}),
    } as any;
    inst.clientManager.addSocket(ws.data.playerId, ws);

    const start = Date.now();
    await inst.drain(5000);
    const elapsed = Date.now() - start;

    // Without the CR-01 latch, this would block for the full 5000ms timeout.
    expect(elapsed).toBeLessThan(200);
    expect(inst.clientManager.isDraining()).toBe(true);

    await inst.stop();
  });

  test("announceShuttingDownOnce() gates a single broadcast per shutdown cycle", () => {
    const m = new ClientManager();
    expect(m.announceShuttingDownOnce()).toBe(true);
    expect(m.announceShuttingDownOnce()).toBe(false);
    expect(m.announceShuttingDownOnce()).toBe(false);
    m.clear();
    expect(m.announceShuttingDownOnce()).toBe(true);
  });

  test("WR-01 (split mode): engine-initiated \"draining\" + gateway's own drain() send exactly one SERVER_SHUTTING_DOWN", async () => {
    const manager = new ClientManager();
    const inst = await startGateway({ mode: "split", port: 0, manager });

    const ws = {
      data: { playerId: crypto.randomUUID() },
      send: mock(() => {}),
    } as any;
    inst.clientManager.addSocket(ws.data.playerId, ws);

    // Simulate the engine's OWN independent SIGTERM/drain cycle publishing
    // "draining" first (e.g. both containers received SIGTERM together).
    await inst.bridge.publishToGateway({ type: "draining" });
    // Then the gateway's own shutdown sequence calls drain(), which used to
    // unconditionally broadcast again in split mode (WR-01 split-mode gap).
    void inst.drain(5000);
    await new Promise((r) => setTimeout(r, 20));

    const shuttingDownSends = ws.send.mock.calls.filter((c: any[]) =>
      String(c[0]).includes("SERVER_SHUTTING_DOWN"),
    );
    expect(shuttingDownSends.length).toBe(1);

    await inst.bridge.publishToGateway({ type: "drained" });
    await inst.stop();
  });

  test("CR-B1: a stale \"drained\" latch from a PRIOR unrelated engine restart does not poison the next real drain()", async () => {
    const manager = new ClientManager();
    const inst = await startGateway({ mode: "split", port: 0, manager });

    // An earlier, unrelated engine-only restart already published "drained"
    // long before this shutdown began (e.g. docker-compose `restart:
    // unless-stopped` cycling the engine container independently).
    await inst.bridge.publishToGateway({ type: "drained" });
    expect(inst.clientManager.isDrained()).toBe(true);

    // A real shutdown begins now — the stale latch must be cleared first
    // (mirrors apps/gateway/src/index.ts's onShutdown), or drain() would
    // wrongly short-circuit instead of waiting for the CURRENT in-flight work.
    inst.clientManager.setDrained(false);

    const ws = {
      data: { playerId: crypto.randomUUID() },
      send: mock(() => {}),
    } as any;
    inst.clientManager.addSocket(ws.data.playerId, ws);

    const start = Date.now();
    const drainPromise = inst.drain(300);
    await new Promise((r) => setTimeout(r, 50));
    // Mid-drain, with the stale latch cleared: must still be waiting, not
    // already resolved on the poisoned flag.
    expect(Date.now() - start).toBeLessThan(300);

    // Now the CURRENT shutdown's own "drained" event arrives for real.
    await inst.bridge.publishToGateway({ type: "drained" });
    await drainPromise;
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(300);

    await inst.stop();
  });
});
