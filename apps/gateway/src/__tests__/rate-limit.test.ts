import { describe, test, expect, beforeEach } from "bun:test";
import { IpRateLimiter, ipRateLimiter } from "../rate-limit/ip-limiter.ts";

beforeEach(() => {
  ipRateLimiter.reset();
});

describe("Phase 4 Plan 03 / Phase 7 Plan 02: Per-IP Rate Limiting", () => {
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

  test("4. check() alias behaves identically to checkAndConsume()", () => {
    const limiter = new IpRateLimiter(2, 60_000);
    const ip = "172.16.0.1";
    const now = 50_000;

    expect(limiter.check(ip, now)).toBe(true);
    expect(limiter.check(ip, now)).toBe(true);
    expect(limiter.check(ip, now)).toBe(false);
  });
});
