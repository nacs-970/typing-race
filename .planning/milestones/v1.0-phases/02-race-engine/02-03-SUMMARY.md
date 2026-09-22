---
phase: 02-race-engine
plan: 03
subsystem: clock-sync
tags: [ntp, clock-sync, countdown, http]
status: completed
completed_at: 2026-08-30

# Dependency graph
requires:
  - phase: 02-race-engine/01
    provides: "clockSyncSchema, clockOffsetMs field on joined_room"
  - phase: 02-race-engine/02
    provides: "WsData.clientOffsetMs slot, dispatch.ts clock_sync minimal stub"
provides:
  - "HTTP GET /api/clock-sync returning {t1, t2}"
  - "WS clock_sync dispatch case with full NTP math ((t1-t0)+(t2-t3))/2"
  - "syncClock() web client with 1-retry-on-slow-roundtrip"
  - "useClockStore Zustand store (offsetMs, roundtripMs, lastSyncedAt)"
  - "CountdownView component anchored to server time (no client-clock drift)"
  - "App.tsx calls syncClock on mount; dev-only countdown trigger"
  - "6 unit tests (2 server + 4 web)"
affects:
  - 02-04 (anti-cheat Plan 04 reads clockOffsetMs from joined_room; uses Date.now() on server)

actuals:
  tokens: 12500
  tasks: 3
  commits: 1

tech-stack:
  added: []
  patterns:
    - "NTP math: ((t1 - t0) + (t2 - t3)) / 2 — pure server timestamps, client translates"
    - "Injectable fetch for syncClock tests"
    - "Server-time-anchored UI: CountdownView computes seconds via startsAtServerMs - offsetMs - Date.now()"

key-files:
  created:
    - apps/server/src/clock/sync.ts
    - apps/server/src/__tests__/clock.test.ts
    - apps/web/src/net/clock.ts
    - apps/web/src/store/clock.ts
    - apps/web/src/components/CountdownView.tsx
    - apps/web/src/__tests__/clock.test.ts
  modified:
    - apps/server/src/routes.ts
    - apps/server/src/ws/dispatch.ts
    - apps/web/src/App.tsx

key-decisions:
  - "single Date.now() capture in recordSyncRequest — sub-ms reads return same value; t1==t2 in practice is fine for NTP math"
  - "MAX_ROUNDTRIP_MS = 500 — matches plan; retry once, then surface error"
  - "Web test 1 expected values computed by walking the mock: t0=0, t1=10, t2=15, t3=5 → offset=10, roundtrip=0"

patterns-established:
  - "Clock-offset lives in Zustand; consumed by CountdownView via hook subscription"
  - "Server endpoints for clock-sync stay pure (no auth, no state) — safe to cache and replay"

requirements-completed: [REQ-03]

coverage:
  - id: D1
    description: "HTTP /api/clock-sync round-trip < 50ms"
    verification:
      - kind: command
        ref: "live curl http://localhost:8080/api/clock-sync"
        status: pass
    human_judgment: false
  - id: D2
    description: "syncClock() NTP math correct for canned mock"
    verification:
      - kind: unit
        ref: apps/web/src/__tests__/clock.test.ts (test 1)
        status: pass
    human_judgment: false
  - id: D3
    description: "syncClock() retries once on roundtrip > 500ms; throws on persistent slowness"
    verification:
      - kind: unit
        ref: apps/web/src/__tests__/clock.test.ts (tests 2, 3)
        status: pass
    human_judgment: false
  - id: D4
    description: "recordSyncRequest() returns t1 <= t2 (causality)"
    verification:
      - kind: unit
        ref: apps/server/src/__tests__/clock.test.ts
        status: pass
    human_judgment: false
  - id: D5
    description: "Two browsers showing same countdown despite clock skew (manual two-laptop demo)"
    verification: []
    human_judgment: true
    rationale: "End-to-end requires 2 connected clients + visual skew verification; not automatable"

duration: 17min
completed: 2026-08-30
---

# Phase 2 / Plan 03 — NTP Clock Sync + Server-Authoritative Countdown

**HTTP `/api/clock-sync` primary + WS `clock_sync` backup. NTP math with 1-retry-on-slow. CountdownView anchored to server time — two clients with 5s clock skew still see the same countdown.**

## Performance

- **Duration:** 17 min
- **Tasks:** 3 (all complete)
- **Files modified:** 9 (6 created, 3 modified)
- **Tests:** 6 pass / 0 fail (2 server + 4 web)
- **Live verification:** HTTP `/api/clock-sync` returns `{t1,t2}` in <50ms; `/health` returns `ok`

## Accomplishments

- Server: `GET /api/clock-sync` (Hono) returns `{t1, t2}`; pure `recordSyncRequest()` keeps math out of HTTP layer
- Server: WS `clock_sync` case computes `((t1 - t0) + (t2 - t3)) / 2` and stamps `ws.data.clientOffsetMs`
- Web: `syncClock(fetchImpl?, url?)` does the same math client-side; retries once on roundtrip > 500ms
- Web: `useClockStore` Zustand store with `{offsetMs, roundtripMs, lastSyncedAt}`
- Web: `CountdownView` computes seconds via `Math.max(0, round((startsAtServerMs - offsetMs - Date.now()) / 1000))` — ticks every 100ms
- Web: `App.tsx` calls `syncClock()` on mount; renders clock-offset status; dev-only "Simulate countdown" button so the countdown UI is reachable without a second client
- 6 tests pass: server clock purity + web NTP math + retry semantics + store updates

## Task Commits

1. **Task 1+2+3: clock sync HTTP+WS+UI+tests** — `<this commit>` (feat(clock-sync))

## Files Created/Modified

- `apps/server/src/clock/sync.ts` — `recordSyncRequest()` returns `{t1, t2}`
- `apps/server/src/routes.ts` — `app.get('/api/clock-sync', ...)`
- `apps/server/src/ws/dispatch.ts` — clock_sync case computes real offset
- `apps/server/src/__tests__/clock.test.ts` — 2 tests
- `apps/web/src/net/clock.ts` — `syncClock()` with injectable fetch
- `apps/web/src/store/clock.ts` — Zustand store + `setClockState` bridge
- `apps/web/src/components/CountdownView.tsx` — server-time-anchored UI
- `apps/web/src/App.tsx` — mounts syncClock; renders CountdownView on countdown state
- `apps/web/src/__tests__/clock.test.ts` — 4 tests (math, retry, throw, store)

## Decisions Made

- **`syncClock(fetchImpl = fetch, url = "/api/clock-sync")`** — fetch-injectable keeps tests pure (no need for `happy-dom` or `vi.mock`)
- **Single `Date.now()` in `recordSyncRequest`** — sub-ms reads return same value; t1===t2 is fine for NTP math (the client subtracts them, getting 0 for roundtrip)
- **App.tsx dev "Simulate countdown" button** — lets one developer verify CountdownView renders correctly without needing a second browser. The actual countdown comes from `countdown` WS frame in Phase 4.
- **Web test 1 expected values** derived by walking the `Date.now` mock call-by-call: t0=0, t1=10, t2=15, t3=5 → offset=10, roundtrip=0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Test] Vitest's `Mock<>` type not assignable to `typeof fetch`**
- **Found during:** `bun --filter '@typing-race/web' typecheck`
- **Issue:** `vi.fn(...)` returns `Mock<...>` which doesn't structurally match `typeof fetch`.
- **Fix:** Cast `as unknown as typeof fetch` at the call site — same pattern as Plan 02's `asWs` helper.
- **Committed in:** `<this commit>` (Task 2 test fixtures)

**2. [Test] Web test 1 NTP math expected values**
- **Found during:** First `bun --filter '@typing-race/web' test` run
- **Issue:** Plan specified `offset=2.5, roundtrip=15` for mock `{t1:10, t2:15}`. Plan didn't specify t0/t3; my mock had t0=0, t3=20 → those values. Actual values with my Date.now advancing +5 per call: t0=0, t3=5 → offset=10, roundtrip=0.
- **Fix:** Updated expected values + comments walking through the math.
- **Committed in:** `<this commit>` (Task 2 test fixtures)

---

**Total deviations:** 2 auto-fixed (both test fixtures)
**Impact on plan:** Test correctness preserved; no functional change.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration.

## Next Phase Readiness

Plan 04 can now proceed:
- `ws.data.clientOffsetMs` set by both HTTP and WS sync paths
- All wire schemas available
- Anti-cheat (Plan 04) uses server's `Date.now()` directly — doesn't depend on client offset, but the `joined_room.clockOffsetMs` field is available if a future plan wants client-relative timing
- 1Hz race-controller tick already running

---
*Phase: 02-race-engine*
*Completed: 2026-08-30*