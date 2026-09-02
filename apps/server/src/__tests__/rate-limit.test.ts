import { describe, test, expect, beforeEach } from "bun:test";
import { IpRateLimiter, ipRateLimiter, rooms } from "../rooms/manager.ts";
import { dispatch } from "../ws/dispatch.ts";
import type { WsData } from "../ws/handlers.ts";

type FakeWs = {
  data: WsData;
  send: (data: string) => void;
  sent: string[];
};

function fakeWs(playerId: string, ip: string = "127.0.0.1"): FakeWs {
  const ws: FakeWs = {
    data: {
      playerId,
      roomCode: null,
      nickname: null,
      clientOffsetMs: 0,
      ip,
      lastPongAt: Date.now(),
    },
    sent: [],
    send(data: string) {
      ws.sent.push(data);
    },
  };
  return ws;
}

function asWs(fake: FakeWs): import("bun").ServerWebSocket<WsData> {
  return fake as unknown as import("bun").ServerWebSocket<WsData>;
}

beforeEach(() => {
  rooms.clear();
  ipRateLimiter.reset();
});

describe("Phase 4 Plan 03: Per-IP Rate Limiting", () => {
  test("1. IpRateLimiter allows up to 10 creations within 1-hour window", () => {
    const limiter = new IpRateLimiter(10, 3600_000);
    const ip = "192.168.1.100";
    const baseTime = 100_000;

    for (let i = 0; i < 10; i++) {
      expect(limiter.checkAndConsume(ip, baseTime + i * 1000)).toBe(true);
    }

    // 11th should fail
    expect(limiter.checkAndConsume(ip, baseTime + 11_000)).toBe(false);
  });

  test("2. Independent IPs have separate creation quotas", () => {
    const limiter = new IpRateLimiter(10, 3600_000);
    const ip1 = "10.0.0.1";
    const ip2 = "10.0.0.2";
    const now = 100_000;

    // Exhaust ip1
    for (let i = 0; i < 10; i++) {
      limiter.checkAndConsume(ip1, now);
    }
    expect(limiter.checkAndConsume(ip1, now)).toBe(false);

    // ip2 should still have quota
    expect(limiter.checkAndConsume(ip2, now)).toBe(true);
  });

  test("3. Quota resets after 1 hour (sliding window)", () => {
    const limiter = new IpRateLimiter(10, 3600_000);
    const ip = "192.168.1.50";
    const t0 = 10_000;

    // Exhaust at t0
    for (let i = 0; i < 10; i++) {
      limiter.checkAndConsume(ip, t0);
    }
    expect(limiter.checkAndConsume(ip, t0)).toBe(false);

    // 1 hour and 1 ms later (t0 + 3600_001)
    expect(limiter.checkAndConsume(ip, t0 + 3600_001)).toBe(true);
  });

  test("4. dispatch create_room returns error RATE_LIMITED on 11th creation", () => {
    const ip = "1.2.3.4";

    // Create 10 rooms
    for (let i = 0; i < 10; i++) {
      const ws = fakeWs(`p-${i}`, ip);
      dispatch(asWs(ws), JSON.stringify({ type: "create_room", nickname: `Host${i}` }));
      expect(ws.data.roomCode).not.toBeNull();
    }

    // 11th creation attempt from same IP
    const wsBlocked = fakeWs("p-blocked", ip);
    dispatch(asWs(wsBlocked), JSON.stringify({ type: "create_room", nickname: "BlockedHost" }));

    expect(wsBlocked.data.roomCode).toBeNull();
    expect(wsBlocked.sent.length).toBe(1);
    const err = JSON.parse(wsBlocked.sent[0]);
    expect(err.type).toBe("error");
    expect(err.code).toBe("RATE_LIMITED");
  });
});
