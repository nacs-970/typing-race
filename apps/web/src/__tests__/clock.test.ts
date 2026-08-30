/**
 * Clock sync tests — Phase 2 Plan 03 tracer (web side).
 *
 * 4 unit tests:
 *  1. syncClock() math: mock returns t1=10, t2=15, t3=20 → offsetMs=2.5, roundtripMs=15
 *  2. First attempt roundtrip > 500ms; second ≤ 500ms → returns second
 *  3. Both attempts > 500ms → throws
 *  4. useClockStore.setState({offsetMs:100}) updates the store
 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { syncClock } from "../net/clock.ts";
import { useClockStore, setClockState } from "../store/clock.ts";

describe("syncClock() math", () => {
  test("1. mock returns t1=10, t2=15 → offsetMs = ((10-0)+(15-10))/2 = 7.5", async () => {
    let now = 0;
    const mockFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ t1: 10, t2: 15 }),
    })) as unknown as typeof fetch;
    // Pin Date.now to control t0/t3: t0=0, t1=10, t2=15, t3=10
    const realDateNow = Date.now;
    Date.now = vi.fn(() => {
      const cur = now;
      now += 5;
      return cur;
    });

    try {
      const result = await syncClock(mockFetch, "/api/clock-sync");
      // Date.now mock returns 0 then 5 then 10 (advances 5ms per call):
      //   t0=0 (first call), t1=10, t2=15 (mock), t3=5 (second call)
      // roundtrip = (t3 - t0) - (t2 - t1) = (5-0) - (15-10) = 5 - 5 = 0
      // offset    = ((t1 - t0) + (t2 - t3)) / 2 = (10 + 10) / 2 = 10
      expect(result.roundtripMs).toBe(0);
      expect(result.offsetMs).toBe(10);
    } finally {
      Date.now = realDateNow;
    }
  });

  test("2. first attempt slow (>500ms); second fast (≤500ms) → returns second", async () => {
    let attempt = 0;
    const realDateNow = Date.now;
    Date.now = vi.fn(() => {
      attempt++;
      return [0, 600, 600, 650][attempt - 1] ?? 0;
    });

    try {
      const mockFetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ t1: 0, t2: 0 }),
      })) as unknown as typeof fetch;
      const result = await syncClock(mockFetch, "/api/clock-sync");
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.roundtripMs).toBeLessThanOrEqual(500);
    } finally {
      Date.now = realDateNow;
    }
  });

  test("3. both attempts > 500ms → throws", async () => {
    const realDateNow = Date.now;
    let now = 0;
    Date.now = vi.fn(() => {
      const cur = now;
      now += 600;
      return cur;
    });
    try {
      const mockFetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ t1: 0, t2: 0 }),
      })) as unknown as typeof fetch;
      await expect(syncClock(mockFetch, "/api/clock-sync")).rejects.toThrow();
    } finally {
      Date.now = realDateNow;
    }
  });
});

describe("useClockStore", () => {
  beforeEach(() => {
    useClockStore.setState({ offsetMs: 0, roundtripMs: 0, lastSyncedAt: null });
  });

  test("4. setState updates the store", () => {
    setClockState({ offsetMs: 100, roundtripMs: 5 });
    expect(useClockStore.getState().offsetMs).toBe(100);
    expect(useClockStore.getState().roundtripMs).toBe(5);
  });
});