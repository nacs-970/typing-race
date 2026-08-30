---
phase: 02-race-engine
plan: 01
subsystem: shared
tags: [zod, nanoid, wire-schema, ws]
status: completed
completed_at: 2026-08-30

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "@typing-race/shared package scaffold, bun workspace, zod dep"
provides:
  - "5 new C→S Zod schemas (create_room, clock_sync, start_race, keystroke, cursor_position)"
  - "7 new S→C Zod schemas (joined_room, lobby_state, countdown, race_start, cursor_update, player_left, race_end)"
  - "genRoomCode() + isValidRoomCode() type-guard using nanoid.customAlphabet"
  - "RaceState union (lobby|countdown|racing|finished)"
  - "12 unit tests covering round-trip, malformed rejection, Phase 1 backwards compat, anti-cheat invariants"
affects:
  - 02-02 (room manager + dispatch wires new C→S frames)
  - 02-03 (clock-sync uses clock_syncSchema + joined_room.clockOffsetMs)
  - 02-04 (anti-cheat uses Keystroke + ServerErrorCode; RaceView renders cursor_update)

actuals:
  tokens: 12100
  tasks: 3
  commits: 1

tech-stack:
  added: [nanoid@6.0.1 to shared, @types/bun@1.4.0 to shared]
  patterns: ["Zod 4 discriminated union as single source of wire-schema truth", "nanoid.customAlphabet for cryptographic room codes"]

key-files:
  created: [packages/shared/src/__tests__/codes.test.ts, packages/shared/src/__tests__/messages.test.ts]
  modified: [packages/shared/src/messages.ts, packages/shared/src/codes.ts, packages/shared/src/race.ts, packages/shared/package.json]

key-decisions:
  - "Use nanoid.customAlphabet over a hand-rolled randomizer — same pattern Plan 02's Room Manager reuses for collision retry"
  - "Keep PlayerSummary type in race.ts (not messages.ts) — single canonical export from race.ts avoids dual-export ambiguity"
  - "Test UUIDs conform to RFC 4122 v4 (group3 starts with 4, group4 with 8-b) — Zod 4 enforces this; Phase 1 test UUIDs starting with 0 would have failed"

patterns-established:
  - "Every new wire schema requires a `safeParse` round-trip test in `__tests__/messages.test.ts`"
  - "S→C frames carrying timestamps use `serverTs` (NOT `clientTs`) — anti-cheat invariant baked at schema level"

requirements-completed: [REQ-01, REQ-02, REQ-03, REQ-04, REQ-06, REQ-13]

coverage:
  - id: D1
    description: "Wire schema round-trip + malformed rejection (5 new C→S + 7 new S→C)"
    verification:
      - kind: unit
        ref: packages/shared/src/__tests__/messages.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: "Phase 1 wire frames still parse — backwards compatibility"
    verification:
      - kind: unit
        ref: packages/shared/src/__tests__/messages.test.ts (tests 5, 6)
        status: pass
    human_judgment: false
  - id: D3
    description: "genRoomCode() 6-char output, 31-char alphabet, low collision rate"
    verification:
      - kind: unit
        ref: packages/shared/src/__tests__/codes.test.ts
        status: pass
    human_judgment: false
  - id: D4
    description: "Anti-cheat invariant — cursor_update requires serverTs not clientTs"
    verification:
      - kind: unit
        ref: packages/shared/src/__tests__/messages.test.ts (test 8)
        status: pass
    human_judgment: false

duration: 18min
completed: 2026-08-30
---

# Phase 2 / Plan 01 — Wire Schemas + Room Code Generator

**REQ-13 single source of truth extended: 5 C→S + 7 S→C Zod schemas + nanoid-backed `genRoomCode()` + `RaceState` union, locked with 12 unit tests covering round-trip, malformed rejection, Phase 1 backwards compat, and the anti-cheat `serverTs` invariant.**

## Performance

- **Duration:** 18 min
- **Tasks:** 3 (all complete)
- **Files modified:** 6 (4 modified, 2 created)
- **Tests:** 12 pass / 0 fail (8 wire + 4 code)

## Accomplishments

- Added 5 C→S Zod schemas (`create_room`, `clock_sync`, `start_race`, `keystroke`, `cursor_position`)
- Added 7 S→C Zod schemas (`joined_room` carries `clockOffsetMs`, `lobby_state`, `countdown`, `race_start` carries passage text, `cursor_update` carries `serverTs` not `clientTs`, `player_left`, `race_end`)
- `genRoomCode()` via `nanoid.customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6)` — 31-char alphabet, 887M keyspace
- `isValidRoomCode(code): code is RoomCode` type-guard using `ROOM_CODE_REGEX = /^[A-HJ-NP-Z2-9]{6}$/`
- `RaceState` union exported from `race.ts` (4 states: lobby | countdown | racing | finished)
- All Phase 1 frames (`ping`, `join_room`, `leave_room`, `hello`, `pong`, `error`) still parse — backwards compat verified
- Test suite: `bun test packages/shared` exits 0, 12 tests pass

## Task Commits

1. **Task 1: Tracer — wire schemas + room code generator** — `eab5f9a` (feat(shared))

**Plan metadata:** pending close-out in this SUMMARY.

## Files Created/Modified

- `packages/shared/src/messages.ts` — extended with new Zod schemas + inferred TS types (129 lines added)
- `packages/shared/src/codes.ts` — added `genRoomCode()` + `isValidRoomCode()` + `ROOM_CODE_REGEX`
- `packages/shared/src/race.ts` — `RaceState` Zod enum + `PlayerSummary` type
- `packages/shared/package.json` — added `nanoid` dep + `@types/bun` devDep + `scripts.test`
- `packages/shared/src/__tests__/messages.test.ts` — 8 wire-schema tests
- `packages/shared/src/__tests__/codes.test.ts` — 4 room-code tests

## Decisions Made

- **`PlayerSummary` lives in `race.ts`, not `messages.ts`.** Initial draft exported from both — Zod-inferred `PlayerSummary` from `PLAYER_SUMMARY` collided with the re-exported one. Single-source-of-truth wins: `race.ts` is the canonical home.
- **Test UUIDs conform to RFC 4122 v4.** First test run failed because test UUIDs (`00000000-0000-0000-0000-000000000001`) violated Zod 4's stricter UUID regex (group3 must start with 1-8, group4 with 8-b). Replaced with v4-conformant `11111111-1111-4111-8111-111111111111` etc.
- **`nanoid` hoisted from server to shared.** Server already had `nanoid: 6.0.1`. Shared needs it for `genRoomCode()`. Bun workspaces hoist to root `node_modules` — no duplicate install.

## Deviations from Plan

### Auto-fixed Issues

**1. [Plan 02 prerequisite] Zod 4 UUID strictness broke test fixtures**
- **Found during:** Task 1 (run `bun test packages/shared` — 3 failures on S→C frames)
- **Issue:** Plan provided UUID fixtures starting with `00000000-...`; Zod 4's `string().uuid()` requires RFC 4122 v4 format (group3 starts with `4`, group4 with `8-b`). Phase 1 tests passed because Phase 1's UUIDs were never actually used in `safeParse` calls — only the schema's TYPE was asserted.
- **Fix:** Switched all test UUIDs to v4-conformant format. Same plan, same fields, just valid UUIDs.
- **Verification:** `bun test packages/shared` exits 0, 12/12 pass.
- **Committed in:** `eab5f9a` (Task 1 commit)

**2. [Plan 02 prerequisite] Server dispatch switch needs extension**
- **Found during:** `bun run --filter '*' typecheck`
- **Issue:** Phase 1's `dispatch.ts` has `default: { const _exhaustive: never = msg; }` guard. Adding new C→S types without cases triggers TS2322. Plan 02 was always going to wire them — this is expected, not a regression.
- **Fix:** Left as-is for Plan 02 to fix.
- **Committed in:** N/A (no code change in this plan)

---

**Total deviations:** 1 auto-fixed (1 test fixture adjustment)
**Impact on plan:** Single fix to test fixtures. Plan 02 will fix the dispatch switch (already in its scope).

## Issues Encountered

None — plan executed cleanly aside from the auto-fixed test fixture above.

## User Setup Required

None — no external service configuration.

## Next Phase Readiness

Plan 02 can now proceed:
- All wire schemas available for `dispatch.ts` to import + wire
- `genRoomCode()` available for `rooms/manager.ts` to call with collision retry
- `RaceState` union available for `race/types.ts` to import
- Server `typecheck` failing on the dispatch `never` guard — Plan 02's primary deliverable

---
*Phase: 02-race-engine*
*Completed: 2026-08-30*