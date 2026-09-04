import { describe, test, expect } from "bun:test";
import { recordSyncRequest } from "../clock/sync.ts";

describe("recordSyncRequest()", () => {
  test("1. returns t1 <= t2 (causality)", () => {
    const { t1, t2 } = recordSyncRequest();
    expect(t1).toBeLessThanOrEqual(t2);
  });

  test("2. 100 calls in a tight loop — t2 - t1 is consistently 0ms", () => {
    for (let i = 0; i < 100; i++) {
      const { t1, t2 } = recordSyncRequest();
      expect(t2 - t1).toBe(0);
    }
  });
});
