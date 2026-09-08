import { test, expect, describe, afterEach } from "bun:test";
import { InMemoryEventBridge } from "@typing-race/shared/bridge";
import { EngineWorker } from "../engine.ts";
import { InMemoryRoomStore } from "../rooms/store.ts";

describe("EngineWorker.drain()", () => {
  let bridge: InMemoryEventBridge;
  let store: InMemoryRoomStore;
  let worker: EngineWorker;

  afterEach(() => {
    worker.stop();
    bridge.close();
  });

  test("resolves immediately with 0 active rooms", async () => {
    bridge = new InMemoryEventBridge();
    store = new InMemoryRoomStore();
    worker = new EngineWorker(bridge, store);
    worker.start();
    
    let drainedEvents = 0;
    bridge.onGatewayEvent(e => { if (e.type === "drained") drainedEvents++; });

    const start = Date.now();
    await worker.drain();
    const end = Date.now();
    
    expect(end - start).toBeLessThan(100);
    expect(drainedEvents).toBe(1);
  });

  test("resolves at timeout if active rooms don't finish", async () => {
    bridge = new InMemoryEventBridge();
    store = new InMemoryRoomStore();
    worker = new EngineWorker(bridge, store);
    worker.start();

    await store.set("ABCDE", {
      code: "ABCDE",
      hostId: crypto.randomUUID(),
      players: new Map(),
      state: "racing",
      passageId: null,
      passageText: null,
      usedPassageIds: new Set(),
      startsAtServerMs: Date.now(),
      graceSeconds: 0,
      createdAtMs: Date.now()
    } as any);

    const start = Date.now();
    await worker.drain(60, 10);
    const end = Date.now();

    expect(end - start).toBeGreaterThanOrEqual(60);
  });

  test("idempotency - double drain returns same promise", async () => {
    bridge = new InMemoryEventBridge();
    store = new InMemoryRoomStore();
    worker = new EngineWorker(bridge, store);
    worker.start();

    const p1 = worker.drain(100);
    const p2 = worker.drain(100);
    expect(p1).toBe(p2);
    await p1;
  });

  test("resolves even if store.list() throws", async () => {
    bridge = new InMemoryEventBridge();
    store = new InMemoryRoomStore();
    store.list = () => { throw new Error("broken"); };
    worker = new EngineWorker(bridge, store);
    worker.start();

    const start = Date.now();
    await worker.drain(50, 10);
    const end = Date.now();
    expect(end - start).toBeGreaterThanOrEqual(50);
  });

  test("rejects new rooms/joins/starts with SERVER_SHUTTING_DOWN", async () => {
    bridge = new InMemoryEventBridge();
    store = new InMemoryRoomStore();
    worker = new EngineWorker(bridge, store);
    worker.start();

    const events: any[] = [];
    bridge.onGatewayEvent(e => { events.push(e); });

    const p = worker.drain();

    const playerId = crypto.randomUUID();
    bridge.publishToEngine({
      type: "client_message",
      playerId,
      roomCode: null,
      ip: "127.0.0.1",
      clientOffsetMs: 0,
      serverTs: Date.now(),
      message: { type: "create_room", nickname: "bob" }
    });
    bridge.publishToEngine({
      type: "client_message",
      playerId,
      roomCode: null,
      ip: "127.0.0.1",
      clientOffsetMs: 0,
      serverTs: Date.now(),
      message: { type: "join_room", nickname: "bob", code: "XXXXX" }
    });
    bridge.publishToEngine({
      type: "client_message",
      playerId,
      roomCode: "XXXXX",
      ip: "127.0.0.1",
      clientOffsetMs: 0,
      serverTs: Date.now(),
      message: { type: "start_race", graceSeconds: 60 }
    });

    await new Promise(r => setTimeout(r, 20));

    const errors = events.filter(e => e.type === "send_to_client" && e.payload.type === "error" && e.payload.code === "SERVER_SHUTTING_DOWN");
    expect(errors.length).toBe(3);

    await p;
  });
});
