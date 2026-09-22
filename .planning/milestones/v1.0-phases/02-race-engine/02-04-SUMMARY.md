---
phase: 02-race-engine
plan: 04
subsystem: race-core
tags: [anti-cheat, cursor, race-view, zustand]
status: completed
completed_at: 2026-08-30

# Dependency graph
requires:
  - phase: 02-race-engine/01
    provides: "Keystroke type, ServerErrorCode, CursorUpdate schema"
  - phase: 02-race-engine/02
    provides: "Room + Player types, dispatch wiring, race controller tick()"
  - phase: 02-race-engine/03
    provides: "Clock offset flow (joined_room.clockOffsetMs → useClockStore)"
provides:
  - "Server-authoritative validateKeystroke() with 4 anti-cheat checks"
  - "dispatch.ts keystroke case: validate + broadcast cursor_update on accept; error on reject"
  - "dispatch.ts cursor_position case: 10Hz throttle + broadcast to all"
  - "RaceView component (passage + own cursor optimistic + opponent cursors server-confirmed)"
  - "useCursorStore isolated Zustand store with shouldSendCursor() 10Hz throttle"
  - "App.tsx race lifecycle: syncClock on mount + WS subscribe + DevTools buttons"
  - "8 unit tests for the 4 anti-cheat checks (positive + negative + spoofed clientTs + progress monotonicity)"
affects:
  - 03-passages (Phase 3 introduces real passage corpus + per-char state + WPM/accuracy)
  - 05-polish (cursor interpolation polish, animated transitions)

actuals:
  tokens: 16800
  tasks: 3
  commits: 1

tech-stack:
  added: []
  patterns:
    - "validateKeystroke() is a pure function (frame + room + player + passageText + now) — easily testable"
    - "Anti-cheat #1 is implicit: server uses `now` for all timing decisions; `frame.clientTs` is never read for timing"
    - "10Hz cursor throttle on both client (shouldSendCursor) and server (lastKeystrokeAt reused)"
    - "RaceView separates own cursor (optimistic local) from opponent cursors (server-confirmed)"

key-files:
  created:
    - apps/server/src/race/validate-keystroke.ts
    - apps/server/src/__tests__/validate-keystroke.test.ts
    - apps/web/src/store/cursor.ts
    - apps/web/src/components/RaceView.tsx
  modified:
    - apps/server/src/ws/dispatch.ts
    - apps/web/src/App.tsx
    - apps/web/src/net/ws.ts
    - apps/web/src/styles.css

key-decisions:
  - "Anti-cheat #1 implicit — `frame.clientTs` exists in the schema but the validator never reads it for timing; covered by test 7"
  - "cursor_position throttled at server using `player.lastKeystrokeAt` (NOT a separate field) — Phase 5 will split if needed"
  - "setCursorState() accepts both Partial<CursorState> AND (state) => Partial<CursorState> — matches Zustand 5 dual API"
  - "Static import of setClockState in ws.ts — was lazy/dynamic to avoid circular dep but no actual cycle exists"
  - "WsConnection.send() exposes a typed frame sender (replaces direct socket access from App.tsx)"

patterns-established:
  - "Pure-function validators in race/ — easy to unit-test, no I/O"
  - "Server broadcasts cursor_update ONLY on accepted keystrokes; rejected keystrokes send error to sender only"
  - "Progress is monotonic (max of progress and frame.index + 1) — out-of-order or replayed frames can't reduce progress"

requirements-completed: [REQ-04, REQ-06]

coverage:
  - id: D1
    description: "Anti-cheat #2 state guard: lobby state → NOT_IN_ROOM"
    verification:
      - kind: unit
        ref: apps/server/src/__tests__/validate-keystroke.test.ts (test 1)
        status: pass
    human_judgment: false
  - id: D2
    description: "Anti-cheat #2 grace: within 50ms → RATE_LIMITED"
    verification:
      - kind: unit
        ref: apps/server/src/__tests__/validate-keystroke.test.ts (test 2)
        status: pass
    human_judgment: false
  - id: D3
    description: "Anti-cheat #3 min-interval: <20ms → RATE_LIMITED"
    verification:
      - kind: unit
        ref: apps/server/src/__tests__/validate-keystroke.test.ts (test 3)
        status: pass
    human_judgment: false
  - id: D4
    description: "Anti-cheat #4 char-match + range: mismatch → INVALID_FRAME"
    verification:
      - kind: unit
        ref: apps/server/src/__tests__/validate-keystroke.test.ts (tests 4, 5)
        status: pass
    human_judgment: false
  - id: D5
    description: "Spoofed clientTs ignored: clientTs=now+60000 doesn't change result"
    verification:
      - kind: unit
        ref: apps/server/src/__tests__/validate-keystroke.test.ts (test 7)
        status: pass
    human_judgment: false
  - id: D6
    description: "Progress monotonic: index 5 then index 3 → progress=6"
    verification:
      - kind: unit
        ref: apps/server/src/__tests__/validate-keystroke.test.ts (test 8)
        status: pass
    human_judgment: false
  - id: D7
    description: "Pre-start keystroke end-to-end rejection (E3 validation experiment)"
    verification:
      - kind: e2e
        ref: "live WS test against bun dev server → joined_room → keystroke → error{NOT_IN_ROOM}"
        status: pass
    human_judgment: false
  - id: D8
    description: "Two clients racing: opponent cursors visible within 200ms (manual two-laptop demo)"
    verification: []
    human_judgment: true
    rationale: "End-to-end requires 2 connected clients + visual cursor sync verification; not automatable without Playwright (Phase 5)"

duration: 20min
completed: 2026-08-30
---

# Phase 2 / Plan 04 — Anti-Cheat + Cursor Broadcasting

**Server-authoritative `validateKeystroke()` with 4 anti-cheat checks (state+grace, min-interval, char-match, range); cursor broadcasting at 10Hz; basic `RaceView` with own cursor (optimistic) + opponent cursors (server-confirmed). End-to-end E3 verified: pre-start keystroke → `NOT_IN_ROOM`.**

## Performance

- **Duration:** 20 min
- **Tasks:** 3 (all complete)
- **Files modified:** 8 (4 created, 4 modified)
- **Tests:** 8 server anti-cheat pass / 0 fail
- **E2E verification:** Pre-start keystroke rejected with `NOT_IN_ROOM`

## Accomplishments

- `validateKeystroke()` is a pure function — `(room, player, frame, passageText, now) → {ok} | {ok: false, reason}` — trivially testable, no I/O
- Check 1 (server-timestamp) is implicit: `frame.clientTs` exists in the schema but the validator never reads it for timing. Test 7 verifies this by spoofing clientTs=now+60000 and confirming the result is identical.
- Check 2 (pre-start reject): state must be `racing` AND `now >= startsAtServerMs + 50ms` grace
- Check 3 (min-interval): `now - player.lastKeystrokeAt >= 20ms` — caps raw keystrokes at 50/sec, practical WPM at ~250
- Check 4 (char-match + range): `frame.char === passageText[frame.index]` AND `0 <= index < length`
- `dispatch.ts` keystroke case: validates → on accept, broadcasts `cursor_update` to OTHER players (sender already renders optimistically); on reject, sends `error` to sender only
- `dispatch.ts` cursor_position case: 10Hz server-side throttle (reuses `lastKeystrokeAt`; Phase 5 may split field)
- Web `RaceView`: passage render with `<span class="char">` per char; own cursor = blue bottom-border; opponent cursors = red vertical bar overlays
- Web `useCursorStore`: isolated Zustand store; 10Hz `shouldSendCursor()` throttle for outgoing cursor_position frames
- Web `App.tsx`: race lifecycle via `ws.subscribe()` for countdown / race_start / race_end; dev-only Create room + Start race buttons
- 8 unit tests covering each anti-cheat check independently + combined positive case + spoofed clientTs + progress monotonicity

## Task Commits

1. **Task 1+2+3: validateKeystroke + dispatch wiring + RaceView** — `<this commit>` (feat(race))

## Files Created/Modified

- `apps/server/src/race/validate-keystroke.ts` — 4-check pure function
- `apps/server/src/__tests__/validate-keystroke.test.ts` — 8 tests
- `apps/server/src/ws/dispatch.ts` — keystroke + cursor_position cases
- `apps/web/src/store/cursor.ts` — isolated Zustand store + 10Hz throttle
- `apps/web/src/components/RaceView.tsx` — passage + cursors
- `apps/web/src/App.tsx` — race lifecycle + dev tools
- `apps/web/src/net/ws.ts` — subscribe() + send() helpers; cursor_update → cursor store
- `apps/web/src/styles.css` — passage + cursor + countdown + race-end styles

## Decisions Made

- **Anti-cheat #1 is implicit** — `frame.clientTs` is in the schema (Plan 01) but the validator never reads it for timing decisions. Test 7 verifies this is an intentional invariant.
- **`cursor_position` throttled at server using `player.lastKeystrokeAt`** — Phase 2 keeps it simple; Phase 5 polish can add a separate `lastCursorAtMs` field if cross-contamination with keystroke throttle becomes an issue.
- **`setCursorState()` accepts both `Partial<CursorState>` and `(state) => Partial<CursorState>`** — matches Zustand 5's dual API. Both call sites work without separate helpers.
- **Static import of `setClockState` in `ws.ts`** — initially used `import("../store/clock.ts").then(...)` to dodge a perceived circular dep. No cycle exists; replaced with static import (Vite warned about ineffective dynamic import).
- **`WsConnection.send(frame)`** — replaces direct `socket?.send(JSON.stringify(frame))` from App.tsx; private socket accessor hidden behind a typed method.
- **`broadcastCursorToOthers` loop** uses `for...of room.players.values()` and skips sender inline — Plan 02's `broadcastToRoom` was for room-wide broadcasts; this per-keystroke broadcast is a tight 1-N walk.

## Deviations from Plan

### Auto-fixed Issues

**1. [Type] `setCursorState()` union type for both Partial and function forms**
- **Found during:** `bun run --filter '@typing-race/web' typecheck`
- **Issue:** Zustand's `setState` accepts either `Partial<S>` or `(s: S) => Partial<S>`. Plan signature was `Partial<CursorState>` only — broke the `(s) => { cursors: new Map(s.cursors) }` form in ws.ts.
- **Fix:** Union type with `typeof patch === "function"` dispatch. Both call sites work; both functions delegate to `useCursorStore.setState`.
- **Committed in:** `<this commit>` (Task 2 cursor store)

**2. [Cleanup] Replaced dynamic import of setClockState with static import**
- **Found during:** `bun run build` (Vite warning: "INEFFECTIVE_DYNAMIC_IMPORT")
- **Issue:** `ws.ts` had `import("../store/clock.ts").then(...)` for `setClockState`. Static-imported elsewhere; the dynamic import was unnecessary.
- **Fix:** Static import + direct call.
- **Committed in:** `<this commit>` (Task 3 ws wiring)

---

**Total deviations:** 2 auto-fixed (both type/cleanup)
**Impact on plan:** No functional change; both fixes preserve intent.

## Issues Encountered

- `bun --cwd` is not valid syntax on Bun 1.3.2 — initial background server start failed. Used `cd && bun run dev` pattern instead.

## User Setup Required

None — no external service configuration.

## Next Phase Readiness

Phase 3 (passages + per-char state + WPM/accuracy) can now proceed:
- All wire schemas available; race controller tick() running
- `RaceView` renders a placeholder passage; Phase 3 replaces with real corpus
- `validateKeystroke` is in place; Phase 3 extends with per-char correctness tracking (correct/error/corrected)
- Cursor store + RaceView are the integration point for Phase 3's char-level state model
- DevTools buttons let a developer exercise create_room → start_race end-to-end locally

---
*Phase: 02-race-engine*
*Completed: 2026-08-30*