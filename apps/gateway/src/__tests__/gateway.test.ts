import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { startGateway, type GatewayInstance } from "../index.ts";
import { ClientManager } from "../ws/client-manager.ts";
import { PASSAGES } from "@typing-race/shared";

describe("Gateway Unified Mode Integration", () => {
  let gateway: GatewayInstance;
  let wsUrl: string;

  beforeAll(async () => {
    const manager = new ClientManager();
    gateway = await startGateway({
      port: 0,
      mode: "unified",
      manager,
    });
    wsUrl = `ws://127.0.0.1:${gateway.port}/ws`;
  });

  afterAll(async () => {
    await gateway.stop();
  });

  function createTestClient(): {
    ws: WebSocket;
    messages: any[];
    waitFor: (predicate: (msg: any) => boolean, timeoutMs?: number) => Promise<any>;
  } {
    const ws = new WebSocket(wsUrl);
    const messages: any[] = [];
    const waiters: Array<{
      predicate: (msg: any) => boolean;
      resolve: (msg: any) => void;
      timer: NodeJS.Timeout;
    }> = [];

    ws.onmessage = (event) => {
      const msg = JSON.parse(String(event.data));
      messages.push(msg);

      for (let i = waiters.length - 1; i >= 0; i--) {
        const waiter = waiters[i];
        if (!waiter) continue;
        if (waiter.predicate(msg)) {
          clearTimeout(waiter.timer);
          waiters.splice(i, 1);
          waiter.resolve(msg);
        }
      }
    };

    const waitFor = (predicate: (msg: any) => boolean, timeoutMs = 8000): Promise<any> => {
      const already = messages.find(predicate);
      if (already) return Promise.resolve(already);

      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Timeout waiting for message matching predicate. Received: ${JSON.stringify(messages)}`));
        }, timeoutMs);
        waiters.push({ predicate, resolve, timer });
      });
    };

    return { ws, messages, waitFor };
  }

  test(
    "full multi-client race flow: create -> join -> ready -> start -> keystroke -> leave",
    async () => {
      // 1. Client 1 connects (Host Alice)
      const client1 = createTestClient();
      const hello1 = await client1.waitFor((m) => m.type === "hello");
      expect(hello1.playerId).toBeDefined();

      // 2. Client 1 creates room
      client1.ws.send(JSON.stringify({ type: "create_room", nickname: "Alice" }));
      const joined1 = await client1.waitFor((m) => m.type === "joined_room");
      expect(joined1.roomCode).toBeDefined();
      expect(joined1.you.isHost).toBe(true);
      const roomCode = joined1.roomCode;

      // 3. Client 2 connects (Guest Bob) and joins room
      const client2 = createTestClient();
      await client2.waitFor((m) => m.type === "hello");

      client2.ws.send(JSON.stringify({ type: "join_room", code: roomCode, nickname: "Bob" }));
      const joined2 = await client2.waitFor((m) => m.type === "joined_room");
      expect(joined2.roomCode).toBe(roomCode);
      expect(joined2.you.isHost).toBe(false);

      // Host receives lobby_state showing Bob
      const lobbyForAlice = await client1.waitFor((m) => m.type === "lobby_state" && m.players.length === 2);
      expect(lobbyForAlice.players.map((p: any) => p.nickname)).toContain("Bob");

      // 4. Bob sets ready
      client2.ws.send(JSON.stringify({ type: "set_ready", ready: true }));
      const lobbyReady = await client1.waitFor(
        (m) => m.type === "lobby_state" && m.players.some((p: any) => p.nickname === "Bob" && p.isReady),
      );
      expect(lobbyReady).toBeDefined();

      // 5. Alice starts race with a specific passage
      const passage = PASSAGES[0]!;
      client1.ws.send(
        JSON.stringify({
          type: "start_race",
          passageId: passage.id,
          graceSeconds: 5,
        }),
      );

      const countdown1 = await client1.waitFor((m) => m.type === "countdown");
      const countdown2 = await client2.waitFor((m) => m.type === "countdown");
      expect(countdown1.secondsRemaining).toBe(3);
      expect(countdown2.secondsRemaining).toBe(3);

      // Wait for countdown to expire and race_start frame to arrive
      await client1.waitFor((m) => m.type === "race_start", 6000);
      await client2.waitFor((m) => m.type === "race_start", 6000);

      // 6. Alice sends keystroke -> Bob receives cursor_update
      const firstChar = passage.text[0]!;
      client1.ws.send(
        JSON.stringify({
          type: "keystroke",
          char: firstChar,
          index: 0,
          clientTs: Date.now(),
        }),
      );

      const cursorUpdate = await client2.waitFor((m) => m.type === "cursor_update" && m.playerId === hello1.playerId);
      expect(cursorUpdate.index).toBe(1);

      // 7. Bob leaves room -> Alice receives player_left
      client2.ws.send(JSON.stringify({ type: "leave_room" }));
      const playerLeft = await client1.waitFor((m) => m.type === "player_left");
      expect(playerLeft.playerId).toBe(joined2.playerId);

      client1.ws.close();
      client2.ws.close();
    },
    15_000,
  );
});
