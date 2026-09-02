# Testing Patterns

**Analysis Date:** 2026-09-02

## Test Framework

**Runner:**
- Server & Shared: Bun test runner (`bun:test`)
- Web Client: Vitest `4.1.11`
- Config: `apps/web/vite.config.ts` (Vitest inline config using `environment: "happy-dom"`)

**Assertion Library:**
- `expect()` from `bun:test` (server/shared)
- `expect()` from `vitest` (web client)

**Run Commands:**
```bash
bun test                     # Run all server and shared unit tests
bun test apps/server         # Run server tests only (88 tests)
bun test packages/shared     # Run shared package tests only (25 tests)
cd apps/web && bun run test  # Run web client tests via Vitest (9 tests)
```

## Test File Organization

**Location:**
- Dedicated `__tests__/` directory co-located inside each package's `src/` directory:
  - `apps/server/src/__tests__/`
  - `apps/web/src/__tests__/`
  - `packages/shared/src/__tests__/`

**Naming:**
- `*.test.ts` for logic and backend tests
- `*.test.tsx` for React component tests

**Structure:**
```
apps/server/src/__tests__/
├── char-states.test.ts        # Char accent aggregation and backspace echo
├── clock.test.ts              # NTP clock offset calculation
├── corpus.test.ts             # Fisher-Yates shuffle and deck replenishment
├── disconnect.test.ts         # 60s disconnect grace window and ticker eviction
├── race-controller.test.ts    # FSM state transitions (lobby -> countdown -> racing -> grace -> finished)
├── race-end.test.ts           # Grace expiration and results aggregation
├── rate-limit.test.ts         # Per-IP room creation rate limiting
├── reconnect.test.ts          # Session tokens, socket re-binding, multi-tab takeover
├── rooms.test.ts              # Room creation, player join/leave, host migration
├── scoring.test.ts            # Net WPM and accuracy formulas
└── validate-keystroke.test.ts # Anti-cheat validation pipeline
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, test, expect, beforeEach } from "bun:test";
import { rooms, createRoom } from "../rooms/manager.ts";

beforeEach(() => {
  rooms.clear();
});

describe("Feature under test", () => {
  test("1. descriptive numbered test scenario", () => {
    // Arrange
    const ws = fakeWs("p1");
    // Act
    const { code, room } = createRoom(asWs(ws), "Host");
    // Assert
    expect(rooms.has(code)).toBe(true);
  });
});
```

**Patterns:**
- **Numbered Test Titles:** Tests are prefixed with numbers (`1.`, `2.`) for clear, structured test output.
- **State Cleanliness:** `beforeEach` resets in-memory global state (`rooms.clear()`, `ipRateLimiter.reset()`) to ensure complete test isolation.

## Mocking

**Framework:**
- Minimal lightweight duck-typing mocks rather than complex mocking libraries.

**Patterns:**
```typescript
type FakeWs = {
  data: WsData;
  send: (data: string) => void;
  sent: string[];
};

function fakeWs(playerId: string): FakeWs {
  const ws: FakeWs = {
    data: {
      playerId,
      roomCode: null,
      nickname: null,
      clientOffsetMs: 0,
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
```

**What to Mock:**
- WebSocket network connections (`fakeWs`).
- Network timestamps via injected `now` parameter in pure functions (`validateKeystroke`, `tick`, `computeNetWpm`).

**What NOT to Mock:**
- Zod schemas (always test with real schemas).
- Game state transitions and FSM logic (test against real domain instances).

## Fixtures and Factories

**Test Data:**
- Pre-defined passage texts and UUIDs conforming to RFC 4122:
  ```typescript
  const VALID_UUID = "11111111-1111-4111-8111-000000000001";
  const TEST_PASSAGE = "The quick brown fox jumps over the lazy dog.";
  ```

**Location:**
- Co-located within test suites or imported from `@typing-race/shared`.

## Coverage

**Requirements:**
- 100% test pass rate required before phase completion.
- All anti-cheat checks, FSM transitions, and edge cases explicitly tested.

**Total Test Count:**
- Total 122 tests:
  - 88 Server tests
  - 25 Shared contract tests
  - 9 Frontend web tests

## Common Patterns

**Async Testing:**
```typescript
test("syncClock handles latency", async () => {
  const result = await syncClock(mockFetch);
  expect(result.offsetMs).toBeDefined();
});
```

**Error Validation:**
```typescript
test("rejects invalid transitions", () => {
  const room = fakeRoom("lobby");
  expect(() => transition(room, "racing")).toThrow(InvalidTransitionError);
});
```

---

*Testing analysis: 2026-09-02*
