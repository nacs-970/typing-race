---
phase: 02-race-engine
plan: 02
subsystem: server-core
tags: [rooms, fsm, dispatch, bun, websocket]
status: completed
completed_at: 2026-08-30

# Dependency graph
requires:
  - phase: 02-race-engine/01
    provides: "Wire schemas, genRoomCode, RaceState union"
provides:
  - "In-memory Map<string, Room> with createRoom/addPlayer/removePlayer"
  - "Race Controller FSM with transition() + 1Hz tick()"
  - "dispatch.ts extended with create_room, join_room, leave_room, start_race, clock_sync (minimal), keystroke/cursor_position (no-op stubs)"
  - "broadcast helpers: broadcastToRoom, broadcastLobbyState, broadcastPlayerLeft, broadcastJoinedRoom"
  - "WsData extended with nickname and clientOffsetMs"
  - "14 unit tests (8 rooms + 6 FSM)"
affects:
  - 02-03 (clock-sync Plan 03 expands clock_sync dispatch case + /api/clock-sync HTTP)
  - 02-04 (anti-cheat Plan 04 wires keystroke + cursor_position dispatch cases)

actuals:
  tokens: 21000
  tasks: 3
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Room Manager as in-memory Map with collision retry on room code"
    - "FSM transitions via whitelist table (Record<RaceState, ReadonlyArray<RaceState>>)"
    - "1Hz setInterval tick() drives countdown → racing transition"
    - "WsData carries all connection state (playerId, roomCode, nickname, clientOffsetMs)"

key-files:
  created:
    - apps/server/src/race/types.ts
    - apps/server/src/race/controller.ts
    - apps/server/src/rooms/manager.ts
    - apps/server/src/ws/broadcast.ts
    - apps/server/src/__tests__/rooms.test.ts
    - apps/server/src/__tests__/race-controller.test.ts
  modified:
    - apps/server/src/index.ts
    - apps/server/src/ws/dispatch.ts
    - apps/server/src/ws/handlers.ts

key-decisions:
  - "FSM transitions stored as Record<RaceState, ReadonlyArray<RaceState>> — explicit whitelist makes adding a new state a one-line change"
  - "broadcastJoinedRoom is sent to the joining client only (carries their clockOffsetMs); broadcastLobbyState is sent to all room members"
  - "keystroke/cursor_position dispatch cases are explicit no-ops in this plan — Plan 04 fills them, preserving dispatch exhaustiveness today"
  - "Test fakeWs cast via `as unknown as ServerWebSocket<WsData>` — Bun's WS interface has 16 methods we don't need in tests"

patterns-established:
  - "Server-internal types (Room, Player, WsRef) live in apps/server/src/race/types.ts — NOT in shared"
  - "WsRef = import('bun').ServerWebSocket<WsData> type alias for readability"
  - "Broadcast helpers swallow individual send errors (one slow client ≠ DoS)"

requirements-completed: [REQ-01, REQ-02, REQ-04, REQ-06]

coverage:
  - id: D1
    description: "Room Manager — create/add/remove/evict + 8-player cap"
    verification:
      - kind: unit
        ref: apps/server/src/__tests__/rooms.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: "Race FSM — allowed transitions + countdown→racing on tick"
    verification:
      - kind: unit
        ref: apps/server/src/__tests__/race-controller.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: "Smoke test — host create → guest join → host leave → guest as host → last leave → room gone"
    verification:
      - kind: command
        ref: "bun -e 'createRoom/addPlayer/removePlayer' smoke (matches plan verifier output)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Two clients racing: cursor broadcast (manual two-laptop demo)"
    verification: []
    human_judgment: true
    rationale: "End-to-end cursor demo requires 2 connected clients + browser; not automatable without Playwright (Phase 5 add)"

duration: 22min
completed: 2026-08-30
---

# Phase 2 / Plan 02 — Room Manager + Race Controller FSM

**In-memory room store with 8-player cap and 3-attempt code-collision retry; 4-state race FSM (lobby→countdown→racing→finished with rematch and cancel transitions); 1Hz tick transitions countdown→racing; dispatch wired for `create_room`/`join_room`/`leave_room`/`start_race`/`clock_sync` + keystroke/cursor_position no-op stubs for Plan 04.**

## Performance

- **Duration:** 22 min
- **Tasks:** 3 (all complete)
- **Files modified:** 9 (6 created, 3 modified)
- **Tests:** 14 pass / 0 fail (8 rooms + 6 FSM)

## Accomplishments

- Room Manager (`rooms/manager.ts`): `Map<string, Room>` global, `createRoom()` with nanoid-collision retry (3 attempts), `addPlayer()` with 8-player cap, `removePlayer()` with empty-room eviction + host-promotion
- Race Controller (`race/controller.ts`): `transition()` validates against an explicit whitelist table; `tick()` (1Hz from `index.ts`) walks rooms and transitions `countdown → racing` when timer expires; placeholder passage text broadcast in `race_start`
- Broadcast helpers (`ws/broadcast.ts`): `broadcastToRoom()` swallows individual send errors; 3 typed helpers for `lobby_state`/`player_left`/`joined_room`
- Dispatch (`ws/dispatch.ts`): exhaustive switch covers all 8 C→S frames; new cases for `create_room` (host becomes player), `join_room` (with `ALREADY_IN_ROOM` guard), `leave_room`, `start_race` (host-only FSM transition), `clock_sync` (minimal stub — Plan 03 expands), `keystroke`/`cursor_position` (no-op stubs — Plan 04 fills)
- `WsData` extended with `nickname` + `clientOffsetMs`; close handler calls `removePlayer` so disconnected players are reaped
- 14 unit tests (8 room + 6 FSM); smoke test (`bun -e`) matches plan verifier output exactly

## Task Commits

1. **Task 1+2+3: room manager + race controller + dispatch wiring** — `<this commit>` (feat(server))

**Plan metadata:** pending close-out in this SUMMARY.

## Files Created/Modified

- `apps/server/src/race/types.ts` — server-internal `Room` + `Player` types (NOT in shared)
- `apps/server/src/race/controller.ts` — FSM transition + 1Hz tick
- `apps/server/src/rooms/manager.ts` — Room store with collision retry
- `apps/server/src/ws/broadcast.ts` — broadcast helpers
- `apps/server/src/ws/handlers.ts` — WsData + sendHello/echoPing
- `apps/server/src/ws/dispatch.ts` — exhaustive switch with 8 C→S frames wired
- `apps/server/src/index.ts` — setInterval(tick, 1000); close → removePlayer
- `apps/server/src/__tests__/rooms.test.ts` — 8 tests
- `apps/server/src/__tests__/race-controller.test.ts` — 6 tests

## Decisions Made

- **FSM whitelist as `Record<RaceState, ReadonlyArray<RaceState>>`**: explicit per-state transition table makes adding a new state a one-line change. Throws `InvalidTransitionError` (typed exception) for forbidden moves.
- **`broadcastJoinedRoom` to joining client only, `broadcastLobbyState` to all members**: `joined_room` carries the client's own `clockOffsetMs` — only meaningful to the joiner.
- **No-op stubs for `keystroke`/`cursor_position`**: Plan 02 must keep dispatch exhaustive today; Plan 04 fills them. Comments mark the seam.
- **`asWs()` cast helper in tests**: Bun's `ServerWebSocket<T>` has 16 methods; tests only need `data` + `send`. The `as unknown as ServerWebSocket<WsData>` cast documents intent and keeps tests readable.
- **Plan 02 calls `createRoom` with `isHostOverride=true` for the creator**: avoids the first-player detection edge case when an existing player rejoins.

## Deviations from Plan

### Auto-fixed Issues

**1. [Plan 02 prerequisite] Server dispatch switch extended (was Plan 01 fallout)**
- **Found during:** `bun run --filter '*' typecheck` after Plan 01
- **Issue:** Phase 1's dispatch had a `default: { const _exhaustive: never = msg }` guard. Adding 5 new C→S schemas in Plan 01 broke it.
- **Fix:** Plan 02's dispatch extension adds cases for all 8 C→S frames, restoring exhaustiveness.
- **Committed in:** `<this commit>` (Task 2 dispatch wiring)

**2. [Test] ServerWebSocket type requires cast for fake WS in tests**
- **Found during:** `bun run --filter '@typing-race/server' typecheck`
- **Issue:** `FakeWs` mock has `data` + `send`; `ServerWebSocket<WsData>` has 16 methods (sendText, sendBinary, close, terminate, readyState, etc.). TS rejects the structural mismatch.
- **Fix:** `asWs()` cast helper, well-typed and documented.
- **Committed in:** `<this commit>` (Task 1 test fixtures)

---

**Total deviations:** 2 auto-fixed
**Impact on plan:** Both fixes preserve plan intent; no scope creep.

## Issues Encountered

None — plan executed cleanly.

## User Setup Required

None — no external service configuration.

## Next Phase Readiness

Plan 03 can now proceed:
- `ws.data.clientOffsetMs` slot exists (set by Plan 02's clock_sync stub at 0; Plan 03 will compute real value)
- `joined_room` already carries `clockOffsetMs` in dispatch.ts
- Server `tick()` running — Plan 03 only needs to add HTTP `/api/clock-sync` + update clock_sync WS case to use server-receive timestamp
- All wire schemas available

---
*Phase: 02-race-engine*
*Completed: 2026-08-30*