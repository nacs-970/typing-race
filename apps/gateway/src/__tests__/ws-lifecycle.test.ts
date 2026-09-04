import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { startGateway, type GatewayInstance } from "../index.ts";
import { ClientManager } from "../ws/client-manager.ts";

describe("Gateway WebSocket Lifecycle", () => {
  let gateway: GatewayInstance;
  let baseUrl: string;
  let wsUrl: string;

  beforeAll(async () => {
    const manager = new ClientManager();
    gateway = await startGateway({
      port: 0,
      mode: "unified",
      manager,
    });
    baseUrl = `http://127.0.0.1:${gateway.port}`;
    wsUrl = `ws://127.0.0.1:${gateway.port}/ws`;
  });

  afterAll(async () => {
    await gateway.stop();
  });

  test("1. GET /health returns json with ok: true, timestamp, uptime", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.ok).toBe(true);
    expect(typeof json.timestamp).toBe("number");
    expect(typeof json.uptime).toBe("number");
  });

  test("2. GET /api/clock-sync returns t1 and t2 timestamps", async () => {
    const res = await fetch(`${baseUrl}/api/clock-sync`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(typeof json.t1).toBe("number");
    expect(typeof json.t2).toBe("number");
    expect(json.t1).toBeLessThanOrEqual(json.t2);
  });

  test("3. Connect to /ws receives initial hello frame with playerId", async () => {
    const ws = new WebSocket(wsUrl);

    const hello = await new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timeout waiting for hello")), 3000);
      ws.onmessage = (event) => {
        clearTimeout(timer);
        resolve(JSON.parse(String(event.data)));
      };
      ws.onerror = reject;
    });

    expect(hello.type).toBe("hello");
    expect(typeof hello.playerId).toBe("string");
    expect(typeof hello.serverTs).toBe("number");

    // Verify client registered in manager
    expect(gateway.clientManager.getSocket(hello.playerId)).toBeDefined();

    ws.close();
    await new Promise((r) => setTimeout(r, 50));
    expect(gateway.clientManager.getSocket(hello.playerId)).toBeUndefined();
  });

  test("4. ping sends pong echo directly from gateway", async () => {
    const ws = new WebSocket(wsUrl);
    const messages: any[] = [];

    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => {
        // Wait for hello first
      };
      ws.onmessage = (event) => {
        const msg = JSON.parse(String(event.data));
        messages.push(msg);
        if (msg.type === "hello") {
          ws.send(JSON.stringify({ type: "ping", clientTs: 12345 }));
        } else if (msg.type === "pong") {
          resolve();
        }
      };
      ws.onerror = reject;
    });

    const pong = messages.find((m) => m.type === "pong");
    expect(pong).toBeDefined();
    expect(pong.clientTs).toBe(12345);
    expect(typeof pong.serverTs).toBe("number");

    ws.close();
  });

  test("5. Malformed JSON does not crash or close the connection", async () => {
    const ws = new WebSocket(wsUrl);

    await new Promise<void>((resolve) => {
      ws.onmessage = (e) => {
        if (JSON.parse(String(e.data)).type === "hello") resolve();
      };
    });

    // Send malformed text
    ws.send("NOT_JSON{{{");

    // Ping afterwards to prove connection still active
    const pongPromise = new Promise<any>((resolve) => {
      ws.onmessage = (e) => {
        const msg = JSON.parse(String(e.data));
        if (msg.type === "pong") resolve(msg);
      };
    });

    ws.send(JSON.stringify({ type: "ping", clientTs: 999 }));
    const pong = await pongPromise;
    expect(pong.clientTs).toBe(999);

    ws.close();
  });
});
