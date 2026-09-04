import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { EngineWorker } from "../engine.ts";
import { InMemoryRoomStore } from "../rooms/store.ts";
import { InMemoryEventBridge, type EngineToGatewayEvent } from "@typing-race/shared/bridge";
import { PASSAGES } from "@typing-race/shared";

let store: InMemoryRoomStore;
let bridge: InMemoryEventBridge;
let worker: EngineWorker;
let gatewayEvents: EngineToGatewayEvent[];

beforeEach(() => {
  store = new InMemoryRoomStore();
  bridge = new InMemoryEventBridge();
  gatewayEvents = [];
  bridge.onGatewayEvent((event) => {
    gatewayEvents.push(event);
  });
  worker = new EngineWorker(bridge, store);
  worker.start();
});

afterEach(() => {
  worker.stop();
  bridge.close();
});

describe("EngineWorker end-to-end flow", () => {
  test("create -> join -> ready -> start -> keystrokes -> finish -> disconnect -> 60s eviction", async () => {
    // 1. Host creates room
    bridge.publishToEngine({
      type: "client_message",
      playerId: "host-1",
      roomCode: null,
      ip: "127.0.0.1",
      clientOffsetMs: 0,
      serverTs: 1000,
      message: {
        type: "create_room",
        nickname: "Alice",
      },
    });

    // Wait microtick
    await new Promise((r) => setTimeout(r, 10));

    const assigned = gatewayEvents.find(
      (e) => e.type === "player_room_assigned" && e.playerId === "host-1",
    );
    expect(assigned).toBeDefined();
    const roomCode = (assigned as Extract<EngineToGatewayEvent, { type: "player_room_assigned" }>).roomCode;
    expect(roomCode).toHaveLength(6);

    // 2. Guest joins room
    bridge.publishToEngine({
      type: "client_message",
      playerId: "guest-1",
      roomCode: null,
      ip: "127.0.0.1",
      clientOffsetMs: 0,
      serverTs: 1050,
      message: {
        type: "join_room",
        code: roomCode,
        nickname: "Bob",
      },
    });

    await new Promise((r) => setTimeout(r, 10));

    const room = await store.get(roomCode);
    expect(room).toBeDefined();
    expect(room?.players.size).toBe(2);

    // 3. Guest sets ready
    bridge.publishToEngine({
      type: "client_message",
      playerId: "guest-1",
      roomCode,
      ip: "127.0.0.1",
      clientOffsetMs: 0,
      serverTs: 1100,
      message: {
        type: "set_ready",
        ready: true,
      },
    });

    await new Promise((r) => setTimeout(r, 10));
    expect(room?.players.get("guest-1")?.isReady).toBe(true);

    // 4. Host starts race
    const passage = PASSAGES[0]!;
    bridge.publishToEngine({
      type: "client_message",
      playerId: "host-1",
      roomCode,
      ip: "127.0.0.1",
      clientOffsetMs: 0,
      serverTs: 1200,
      message: {
        type: "start_race",
        passageId: passage.id,
        graceSeconds: 5,
      },
    });

    await new Promise((r) => setTimeout(r, 10));
    expect(room?.state).toBe("countdown");

    // 5. Countdown expires -> race starts
    await worker.controller.tick(room!.startsAtServerMs! + 100);
    expect(room?.state).toBe("racing");

    // 6. Host types all characters correctly
    let now = room!.startsAtServerMs! + 200;
    for (let i = 0; i < passage.text.length; i++) {
      now += 50;
      bridge.publishToEngine({
        type: "client_message",
        playerId: "host-1",
        roomCode,
        ip: "127.0.0.1",
        clientOffsetMs: 0,
        serverTs: now,
        message: {
          type: "keystroke",
          index: i,
          char: passage.text[i]!,
          clientTs: now,
        },
      });
      await new Promise((r) => setTimeout(r, 2));
    }

    const host = room?.players.get("host-1")!;
    expect(host.finishedAtServerMs).not.toBeNull();
    // Host finish triggers grace
    expect(room?.state).toBe("grace");

    // 7. Advance time past grace -> race ends
    await worker.controller.tick(room!.graceEndsAtServerMs! + 100);
    expect(room?.state).toBe("finished");

    const sawRaceEnd = gatewayEvents.some(
      (e) => e.type === "broadcast_to_room" && e.payload.type === "race_end",
    );
    expect(sawRaceEnd).toBe(true);

    // 8. Guest disconnects
    const disconnectTs = 200_000;
    bridge.publishToEngine({
      type: "client_disconnected",
      playerId: "guest-1",
      roomCode,
      serverTs: disconnectTs,
    });

    await new Promise((r) => setTimeout(r, 10));
    expect(room?.players.get("guest-1")?.disconnectedAt).toBe(disconnectTs);

    // 9. Tick after 60s -> Guest evicted
    await worker.controller.tick(disconnectTs + 60_000);
    expect(room?.players.has("guest-1")).toBe(false);
    expect(room?.players.size).toBe(1);

    // 10. Host disconnects and 60s expires -> Room deleted
    bridge.publishToEngine({
      type: "client_disconnected",
      playerId: "host-1",
      roomCode,
      serverTs: disconnectTs + 70_000,
    });
    await new Promise((r) => setTimeout(r, 10));

    await worker.controller.tick(disconnectTs + 130_000);
    expect(await store.has(roomCode)).toBe(false);
  });
});
