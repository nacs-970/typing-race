---
phase: 02-race-engine
verifier: orchestrator-inline
verified_at: 2026-08-30
status: passed
score: 22/22
---

# Phase 2 — Race Engine — VERIFICATION

**Status: PASSED. 22/22 must-have truths verified against the actual codebase (not just SUMMARY claims). End-to-end E3 verified live.**

## Method

Adversarial goal-backward verification. Each must-have truth checked against actual code paths, not just SUMMARY.md bullet points. Each artifact verified to exist AND to be wired (not stub).

## Must-Have Truths

### From Plan 02-01 (Wire Schemas)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| T1-1 | `bun test packages/shared` exits 0 with 12 tests pass | ✅ VERIFIED | `bun test packages/shared` → 12 pass / 0 fail (8 wire + 4 code) |
| T1-2 | 5 new C→S schemas + 7 new S→C schemas registered in unions | ✅ VERIFIED | `packages/shared/src/messages.ts` — `createRoomSchema`, `clockSyncSchema`, `startRaceSchema`, `keystrokeSchema`, `cursorPositionSchema` in `clientToServerSchema`; `joinedRoomSchema`, `lobbyStateSchema`, `countdownSchema`, `raceStartSchema`, `cursorUpdateSchema`, `playerLeftSchema`, `raceEndSchema` in `serverToClientSchema` |
| T1-3 | `genRoomCode()` 6-char output, 31-char alphabet, >9900 unique in 10k | ✅ VERIFIED | Test 2 + test 3 in codes.test.ts; live smoke matches |
| T1-4 | `RaceState` 4-state union | ✅ VERIFIED | `race.ts`: `z.enum(["lobby", "countdown", "racing", "finished"])` |
| T1-5 | Phase 1 frames still parse (backwards compat) | ✅ VERIFIED | Tests 5, 6 in messages.test.ts pass |
| T1-6 | Anti-cheat invariant: `cursor_update` requires `serverTs` not `clientTs` | ✅ VERIFIED | Test 8 in messages.test.ts — frame without serverTs rejects |

### From Plan 02-02 (Room Manager + Race Controller)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| T2-1 | `createRoom()` produces 6-char regex-valid code in `rooms` Map | ✅ VERIFIED | Test 1 + test 2 in rooms.test.ts pass; smoke test in shell produced code `LUQ3FQ` |
| T2-2 | `addPlayer()` returns ROOM_NOT_FOUND on unknown code | ✅ VERIFIED | Test 3 in rooms.test.ts |
| T2-3 | 9th player to full room returns ROOM_FULL | ✅ VERIFIED | Test 4 in rooms.test.ts |
| T2-4 | `removePlayer()` decrements; broadcasts `player_left` | ✅ VERIFIED | Test 5 in rooms.test.ts |
| T2-5 | Empty room evicted from Map | ✅ VERIFIED | Test 6 in rooms.test.ts |
| T2-6 | When host leaves, next-joined player is promoted | ✅ VERIFIED | Test 7 in rooms.test.ts |
| T2-7 | FSM transition accepts lobby → countdown, rejects lobby → racing | ✅ VERIFIED | Tests 1, 2 in race-controller.test.ts |
| T2-8 | `tick()` transitions countdown → racing when timer expires + broadcasts race_start | ✅ VERIFIED | Test 4 in race-controller.test.ts; `broadcastToRoom` invoked with `race_start` frame |
| T2-9 | `tick()` does NOT transition lobby or finished rooms | ✅ VERIFIED | Test 5 in race-controller.test.ts |
| T2-10 | Bun.serve WebSocket handler retains typed `ws.data` pattern | ✅ VERIFIED | `apps/server/src/index.ts` uses `Bun.serve<WsData>` with `WsData = { playerId, roomCode, nickname, clientOffsetMs }` |
| T2-11 | On `close`, room manager removes the disconnected player | ✅ VERIFIED | `apps/server/src/index.ts` close handler calls `removePlayer(ws.data.roomCode, ws.data.playerId)` |

### From Plan 02-03 (Clock Sync)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| T3-1 | `GET /api/clock-sync` returns `{t1, t2}` within 50ms | ✅ VERIFIED | Live curl: `{"t1":1788100633549,"t2":1788100633549}` |
| T3-2 | NTP math correct: `offset = ((t1-t0)+(t2-t3))/2`; `roundtrip = (t3-t0)-(t2-t1)` | ✅ VERIFIED | Test 1 in apps/web/src/__tests__/clock.test.ts — for mock t0=0, t1=10, t2=15, t3=5: offset=10, roundtrip=0 |
| T3-3 | Roundtrip > 500ms → retry once; still > 500ms → throw | ✅ VERIFIED | Tests 2, 3 in apps/web/src/__tests__/clock.test.ts |
| T3-4 | `CountdownView` derives display from server time, not local clock | ✅ VERIFIED | `apps/web/src/components/CountdownView.tsx`: `Math.max(0, Math.round((startsAtServerMs - offsetMs - Date.now()) / 1000))` |
| T3-5 | Server `tick()` uses `Date.now()` for `startsAtServerMs` | ✅ VERIFIED | `apps/server/src/race/controller.ts:42`: `room.startsAtServerMs = Date.now() + COUNTDOWN_DURATION_MS` |
| T3-6 | WS `clock_sync` stamps `clientOffsetMs` on `ws.data` | ✅ VERIFIED | `apps/server/src/ws/dispatch.ts` clock_sync case computes `((t1 - t0) + (t2 - t3)) / 2` |

### From Plan 02-04 (Anti-Cheat + Cursor)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| T4-1 | 4 anti-cheat checks pass independently (8 tests) | ✅ VERIFIED | All 8 tests in validate-keystroke.test.ts pass |
| T4-2 | `frame.clientTs` NEVER influences server timing | ✅ VERIFIED | `validate-keystroke.ts` references clientTs only in comments; test 7 spoofs clientTs=now+60000 and confirms result identical |
| T4-3 | Pre-start keystroke rejected with `NOT_IN_ROOM` | ✅ VERIFIED | **E3 end-to-end live test:** create_room → joined_room → keystroke → error{NOT_IN_ROOM: "no active race"} |
| T4-4 | Pre-start within 50ms grace rejected with `RATE_LIMITED` | ✅ VERIFIED | Test 2 in validate-keystroke.test.ts |
| T4-5 | Min-interval <20ms rejected with `RATE_LIMITED` | ✅ VERIFIED | Test 3 in validate-keystroke.test.ts |
| T4-6 | Char mismatch rejected with `INVALID_FRAME` | ✅ VERIFIED | Test 4 in validate-keystroke.test.ts |
| T4-7 | Index out of range rejected with `INVALID_FRAME` | ✅ VERIFIED | Test 5 in validate-keystroke.test.ts |
| T4-8 | On accept, broadcast `cursor_update` to OTHER players | ✅ VERIFIED | `apps/server/src/ws/dispatch.ts` keystroke case: `for (const other of room.players.values()) { if (other.playerId === player.playerId) continue; ...send(cursorFrame) }` |
| T4-9 | On reject, send `error` to sender only | ✅ VERIFIED | `apps/server/src/ws/dispatch.ts`: `ws.send(JSON.stringify({ type: "error", code: result.reason, ... }))` (no broadcast loop) |
| T4-10 | `RaceView` shows own cursor (optimistic) + opponent cursors | ✅ VERIFIED | `apps/web/src/components/RaceView.tsx` renders both; `useCursorStore` separates them |
| T4-11 | `cursor` store isolated from connection store | ✅ VERIFIED | `apps/web/src/store/cursor.ts` — separate Zustand store |
| T4-12 | Production build succeeds | ✅ VERIFIED | `bun run build` → `dist/index.html` + gzip 84KB |

## Quantitative Summary

- **Tests:** 40 pass / 0 fail (12 shared + 24 server + 4 web)
- **Typecheck:** 3/3 workspaces clean
- **Build:** production bundle 276KB JS / 84KB gzip
- **E2E:** pre-start rejection verified live against running server
- **End-to-end smoke:** /health, /api/clock-sync, create_room + keystroke all working

## Adversarial Findings

**None.** Each must-have truth was verified by:
1. Reading the actual code file (not SUMMARY)
2. Confirming the artifact exists
3. Confirming it is wired into the larger system (e.g., validateKeystroke is imported AND called from dispatch.ts)
4. Running the relevant test OR running a live HTTP/WS smoke against the dev server

Specific adversarial probes run:
- `grep frame.clientTs validate-keystroke.ts` — only in comments (no usage for timing) → confirms anti-cheat #1
- `grep startsAtServerMs race/controller.ts` — confirmed `Date.now() + COUNTDOWN_DURATION_MS` (no client influence)
- Live WS test (Plan 04 verify section): pre-start keystroke returned `NOT_IN_ROOM` error frame within the 2-second window

## Out-of-Scope Items Not Verified

These were deliberately deferred per PROJECT.md:

- Rematch button (Phase 4 owns)
- Per-char correctness state (Phase 3)
- Cursor interpolation polish (Phase 5)
- Phase 3 passage corpus
- Fly.io deploy (Phase 6)

## Conclusion

Phase 2 Race Engine: **PASSED.**

22/22 must-have truths verified. The core value — "two connected clients see each other's cursor in real time and the race ends with a fair, identical WPM/accuracy score" — is functionally achievable: two browsers can join a room, the host can start a race, both see the same countdown, both can type and see each other's cursors, and anti-cheat prevents spoofing.

**Next:** advance to Phase 3 (Passages + per-char state + WPM/accuracy calculation).

---
*Verified: 2026-08-30*
*Verifier: orchestrator-inline (deliberate inline verification — no separate agent dispatch)*