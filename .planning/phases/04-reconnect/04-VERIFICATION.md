---
phase: 04-reconnect
verified: 2026-09-16T00:00:00Z
status: gaps_found
score: 5/7 must-haves verified
covered_files:
  - .planning/phases/04-reconnect/04-01-PLAN.md
  - .planning/phases/04-reconnect/04-01-SUMMARY.md
  - .planning/phases/04-reconnect/04-02-PLAN.md
  - .planning/phases/04-reconnect/04-02-SUMMARY.md
  - .planning/phases/04-reconnect/04-03-PLAN.md
  - .planning/phases/04-reconnect/04-03-SUMMARY.md
  - .planning/phases/04-reconnect/04-04-PLAN.md
  - .planning/phases/04-reconnect/04-04-SUMMARY.md
  - .planning/phases/04-reconnect/04-05-PLAN.md
  - .planning/phases/04-reconnect/04-05-SUMMARY.md
  - .planning/phases/04-reconnect/04-CONTEXT.md
  - .planning/phases/04-reconnect/04-UAT.md
  - apps/engine/src/__tests__/disconnect.test.ts
  - apps/engine/src/__tests__/reconnect.test.ts
  - apps/engine/src/engine.ts
  - apps/engine/src/race/controller.ts
  - apps/engine/src/race/validate-keystroke.ts
  - apps/engine/src/rooms/manager.ts
  - apps/gateway/src/__tests__/rate-limit.test.ts
  - apps/gateway/src/__tests__/ws-lifecycle.test.ts
  - apps/gateway/src/index.ts
  - apps/gateway/src/rate-limit/ip-limiter.ts
  - apps/gateway/src/ws/dispatch.ts
  - apps/gateway/src/ws/handlers.ts
  - apps/web/src/App.tsx
  - apps/web/src/components/RaceView.tsx
  - apps/web/src/net/ws.ts
  - packages/shared/src/messages.ts
covered_digest: "v1:sha256:0b2d9ae9403ac1c39b429d9901d12ba114b4a2fcb8ba9ab3601adc8b386fb657"
behavior_unverified: 1
overrides_applied: 0
gaps:
  - truth: "Idle rooms (>10min no activity) are evicted by a 60s sweeper"
    status: failed
    reason: "No sweeper exists anywhere in the current codebase. Room.lastActivityAt is tracked on every player action but nothing reads it to evict. This was an explicit, documented user decision during Phase 4 discussion (04-CONTEXT.md D-09: 'User explicitly requested no idle eviction. Rooms remain alive until empty.') — it appears to be an intentional scope cut, not an oversight, but ROADMAP.md Phase 4 success criterion 3 was never updated to reflect the change, and no VERIFICATION.md override has been recorded to formally accept the deviation."
    artifacts:
      - path: "apps/engine/src/race/controller.ts"
        issue: "tick() evicts disconnected players after 60s but contains no idle-room sweep logic checking room.lastActivityAt against a 10-minute threshold"
    missing:
      - "Either implement the 60s-interval idle-room sweeper (>10min inactivity) as originally scoped in ROADMAP.md SC3, or add a VERIFICATION.md override accepting D-09 as the final decision and update ROADMAP.md Phase 4 SC3 text to match reality"
  - truth: "Opponent views show a graceful 'room closed' toast within 5s of the last player leaving"
    status: failed
    reason: "No 'room closed' (or equivalent proactive push) message exists anywhere in the wire schema, engine, or web client. The closest related UX is a *reactive* 'Room Lost' toast shown only when a client's own next action (e.g. rejoin_room with a stale sessionToken) fails with SESSION_INVALID/ROOM_NOT_FOUND — that is not a proactive broadcast pushed to a still-open viewer within 5s of the last player leaving. Checked Phase 5 (05-04, 'distinct error toasts') for a deferred match — its four toast cases are lost-connection / server-restart / rate-limit / version-mismatch, none of which cover idle-room-closed notification, so this is not a legitimate deferral to a later phase."
    artifacts:
      - path: "apps/web/src/App.tsx"
        issue: "No 'room_closed' message type is handled; the only closure-adjacent UX is the reactive ROOM_NOT_FOUND/SESSION_INVALID 'Room Lost' error toast"
      - path: "packages/shared/src/messages.ts"
        issue: "No room_closed (or similarly named) server-to-client schema exists"
    missing:
      - "A proactive room_closed (or equivalent) broadcast fired when the room is torn down after the last player leaves/is evicted, delivered to any remaining viewers within 5s"
deferred: []
behavior_unverified_items:
  - truth: "WS heartbeat: dead connections are closed cleanly without state corruption (15s ping / 5s pong timeout)"
    test: "Open a WS connection, stop responding to ping frames, and wait for startHeartbeat's 20s timeout window to elapse"
    expected: "ws.close(1001, 'Heartbeat timeout') fires, manager.removeSocket(playerId) runs, and the resulting client_disconnected event correctly starts the 60s disconnect grace without leaving orphaned state (stale socket entries, room state referencing a dead player)"
    why_human: "No automated test exercises startHeartbeat's timeout branch — grep across apps/**/*.test.ts found zero references to startHeartbeat. ws-lifecycle.test.ts only proves the ping→pong round trip (test 4) and that close() cleans up the socket registry (test 3), not that the 20s no-pong timeout path fires ws.close()/removeSocket() cleanly. The mechanism is present and wired (apps/gateway/src/ws/handlers.ts:167-195) but the actual cleanup-on-timeout invariant is unexercised."
coincidental_reliance_items: []
human_verification:
  - test: "Leave a WS tab open, block outgoing pong frames (e.g. via devtools throttling or a debug client that never responds to ping), and wait >20s"
    expected: "Server closes the socket with code 1001 within ~20s of the last pong, the disconnected player's room correctly starts the 60s grace (player_disconnected broadcast to opponents), and no duplicate/orphaned entries remain in ClientManager.sockets"
    why_human: "Requires a live socket held open across the 15s ping interval / 5s timeout window; not exercised by any existing automated test (see behavior_unverified_items)"
---

# Phase 4: Reconnect Verification Report

**Phase Goal:** Mid-race reconnect without corrupting state, plus room lifecycle (idle sweeper, heartbeat ping/pong) and per-IP rate limiting. Makes the demo URL robust to wifi blips and prevents OOM on Fly.io.
**Verified:** 2026-09-16
**Status:** gaps_found
**Re-verification:** No — initial verification

**Architecture note:** Phase 4 was originally built against `apps/server`. Phase 7 (completed 2026-09-04) split the monolith into `apps/gateway` (WS edge, heartbeat, IP rate limiting) and `apps/engine` (room manager, race controller, reconnect/session logic) connected by an `EventBridge`. All logic verified below was located and re-confirmed at its current N-tier location, not its original Phase 4 file path. The Phase 7 multi-tab takeover regression and its fix are out of scope here per the task brief (covered by the separate 07.1 verification).

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Closing a tab mid-race and reopening within 60s restores progress; opponents see "X reconnected" not "X joined" | ✓ VERIFIED | `RoomManager.rejoinPlayer` (`apps/engine/src/rooms/manager.ts:209-284`) re-binds the existing `Player` object (never resets `progress`/`charStates`) to the new `playerId`, clears `disconnectedAt`, sets `reconnectedAt`, and broadcasts `buildPlayerReconnectedFrame` (not `joined_room`). `reconnect.test.ts` test 3 asserts this end-to-end. Human UAT test 1 (04-UAT.md, result: pass, 2026-09-03) confirms exact-progress restoration; gap G-04-1 (cursor reset to 0 on reconnect) was found and fixed in 04-05 and re-confirmed by UAT. |
| 2 | Server sends full race snapshot on reconnect, 500ms grace before reconnected keystrokes count | ✓ VERIFIED | `buildRejoinedRoomFrame` (referenced in manager.ts, defined in `apps/engine/src/race/frames.ts`) is sent on every successful rejoin. `apps/engine/src/race/validate-keystroke.ts:27,65-68` defines `RECONNECT_GRACE_MS = 500` and rejects keystrokes while `now < player.reconnectedAt + RECONNECT_GRACE_MS`. |
| 3a | Idle rooms (>10min no activity) evicted by a 60s sweeper | ✗ FAILED | No sweeper exists. `room.lastActivityAt` is written on every action but never read for eviction anywhere in `apps/engine/src/race/controller.ts` (only the 60s *disconnect*-grace eviction loop exists, a different mechanism). Documented as an explicit exclusion in 04-CONTEXT.md D-09, but ROADMAP.md SC3 was never updated and no override was recorded. See Gaps. |
| 3b | Opponent views show "room closed" toast within 5s of last player leaving | ✗ FAILED | No `room_closed`-style proactive broadcast exists in `packages/shared/src/messages.ts` or `apps/web/src/App.tsx`. Only a reactive "Room Lost" toast exists, triggered by the *viewer's own* failed action, not a push notification. See Gaps. |
| 4 | WS heartbeat ping every 15s / 5s pong timeout; dead connections closed cleanly without state corruption | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `startHeartbeat` (`apps/gateway/src/ws/handlers.ts:167-195`) pings every 15s (`intervalMs=15_000`) and closes with code 1001 after 20s without a pong (`timeoutMs=20_000` = 15s+5s). Ping→pong round trip is tested (`ws-lifecycle.test.ts` test 4) but the timeout-closes-cleanly branch itself has zero automated or UAT coverage — routed to human verification. |
| 5 | Creating >10 rooms from one IP in 1h returns HTTP 429; existing rooms unaffected | ✓ VERIFIED | `IpRateLimiter` (`apps/gateway/src/rate-limit/ip-limiter.ts`) is a real sliding window keyed by real client IP (`apps/gateway/src/index.ts:88-92`, via `x-forwarded-for` then `srv.requestIP(req)`, not a hardcoded literal — confirmed real per-IP tracking). Enforced in `apps/gateway/src/ws/dispatch.ts:58-70` on `create_room`, returning a `RATE_LIMITED` WS error frame (not literal HTTP 429 — see note below). `gateway/__tests__/rate-limit.test.ts` passes; UAT test 4 (automated) confirms 11th creation from same IP rejected while independent IPs / existing rooms unaffected. |

**Score:** 5/7 truths verified (1 present, behavior-unverified; 2 failed)

**Note on truth 5's wire protocol:** ROADMAP.md's literal wording ("returns HTTP 429") does not match the implementation because `create_room` has always been a WebSocket message, not an HTTP endpoint (`apps/gateway/src/routes.ts` only exposes `/health` and `/api/clock-sync`) — this is consistent with the project's WS-first architecture from Phase 1 onward, not a Phase 4 shortfall. The functional intent (10/hr per-IP cap, other IPs/rooms unaffected) is fully implemented and verified via the `RATE_LIMITED` WS error code.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/engine/src/rooms/manager.ts` — `rejoinPlayer`, `findPlayerBySessionToken` | Session re-bind logic | ✓ VERIFIED | Present, substantive, wired from `engine.ts` dispatch |
| `apps/engine/src/race/frames.ts` — `buildRejoinedRoomFrame`, `buildPlayerReconnectedFrame`, `buildPlayerDisconnectedFrame` | Snapshot + broadcast builders | ✓ VERIFIED | Imported and called in manager.ts |
| `apps/engine/src/race/validate-keystroke.ts` | 500ms reconnect grace | ✓ VERIFIED | `RECONNECT_GRACE_MS` check present |
| `apps/engine/src/race/controller.ts` | 60s disconnect eviction + idle sweeper | ⚠️ PARTIAL | 60s disconnect eviction present (verified); idle (>10min) sweeper absent |
| `apps/gateway/src/ws/handlers.ts` | Heartbeat ping/pong | ✓ VERIFIED | `startHeartbeat` wired in `index.ts`; timeout-close branch present but behaviorally unverified |
| `apps/gateway/src/rate-limit/ip-limiter.ts` | Per-IP room-creation limiter | ✓ VERIFIED | Real client IP, sliding window, wired in dispatch.ts |
| `apps/web/src/App.tsx` | Disconnect/reconnect/takeover toasts | ✓ VERIFIED | `player_disconnected`, `player_reconnected`, `session_taken_over` all handled and rendered |
| `packages/shared/src/messages.ts` — `room_closed` schema | Idle-room closure notice | ✗ MISSING | No such schema exists |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `apps/web/src/net/ws.ts` (rejoin) | `apps/engine/src/engine.ts` `case "rejoin_room"` | WS `rejoin_room` frame → `roomManager.rejoinPlayer` | ✓ WIRED | `engine.ts:191-210` |
| `RoomManager.rejoinPlayer` | `apps/web/src/App.tsx` `rejoined_room` handler | `buildRejoinedRoomFrame` → `send_to_client` bridge event → gateway → WS frame | ✓ WIRED | Confirmed via `App.tsx:109-116` hydration and `reconnect.test.ts` test 3 |
| `apps/gateway/src/ws/dispatch.ts` `create_room` | `IpRateLimiter.check` | Direct call before room creation proceeds | ✓ WIRED | `dispatch.ts:58-70` |
| `apps/gateway/src/ws/handlers.ts` `startHeartbeat` | Disconnect grace flow | `ws.close(1001,...)` → gateway `close` handler → `client_disconnected` bridge event → `manager.handlePlayerDisconnect` | ⚠️ WIRED, UNEXERCISED | Code path is connected but not exercised by any test — see behavior_unverified_items |
| Idle sweeper | (none) | N/A | ✗ NOT_WIRED | No such component exists to wire |

### Behavioral Spot-Checks / Test Runs

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Reconnect handshake, snapshot, multi-tab takeover, duplicate-rejoin idempotency | `bun test apps/engine/src/__tests__/reconnect.test.ts` | 5 pass, 0 fail | ✓ PASS |
| 60s disconnect grace, boundary timing (59s vs 60s), host migration, room deletion | `bun test apps/engine/src/__tests__/disconnect.test.ts` | included in below run | ✓ PASS |
| Per-IP rate limit sliding window | `bun test apps/gateway/src/__tests__/rate-limit.test.ts` | included in below run | ✓ PASS |
| WS lifecycle (hello, ping/pong echo, malformed JSON resilience, socket registry cleanup on close) | `bun test apps/gateway/src/__tests__/ws-lifecycle.test.ts` | included in below run | ✓ PASS |
| Combined run | `bun test apps/engine/src/__tests__/reconnect.test.ts apps/engine/src/__tests__/disconnect.test.ts apps/gateway/src/__tests__/rate-limit.test.ts apps/gateway/src/__tests__/ws-lifecycle.test.ts` | 17 pass, 0 fail, 66 expect() calls | ✓ PASS |
| Heartbeat timeout → close → cleanup invariant | grep for `startHeartbeat` usage across `apps/**/*.test.ts` | 0 references found | ✗ NO COVERAGE (routed to human verification) |

### Requirements Coverage

| Requirement | Source Plan | Description (from PROJECT.md / ROADMAP.md) | Status | Evidence |
|-------------|------------|---------------------------------------------|--------|----------|
| REQ-07 | 04-01, 04-02, 04-04, 04-05 | "Reconnect mid-race without corrupting race state" | ✓ SATISFIED | Truths 1–2 verified above; disconnect/eviction/host-migration behaviorally tested |
| REQ-09 | 04-03 | "rematch polish from Phase 3 deliverable" (room lifecycle: sweeper, heartbeat, rate limit per ROADMAP Phase 4 text) | ⚠️ PARTIALLY SATISFIED | Heartbeat and rate-limit portions verified (with 1 behavior-unverified item); idle sweeper portion is a documented but unresolved gap |

Note: This project has no REQUIREMENTS.md; PROJECT.md's `## Requirements` section lists items as an unlabeled checklist rather than numbered REQ IDs (e.g., "Reconnect mid-race without corrupting race state" maps to REQ-07, "Rematch button (same room, new passage)" maps to REQ-09). All items remain listed under "Active" rather than "Validated" in PROJECT.md despite ROADMAP.md marking phases 1–5 and 7 complete — this appears to be a PROJECT.md staleness issue (the phase-transition evolution step was not run), not a Phase 4 implementation gap, but is noted for awareness.

### Anti-Patterns Found

Scanned `apps/engine/src/rooms/manager.ts`, `apps/engine/src/engine.ts`, `apps/engine/src/race/controller.ts`, `apps/engine/src/race/validate-keystroke.ts`, `apps/gateway/src/ws/handlers.ts`, `apps/gateway/src/ws/dispatch.ts`, `apps/gateway/src/rate-limit/ip-limiter.ts`, `apps/web/src/App.tsx`, `apps/web/src/net/ws.ts`, `apps/web/src/components/RaceView.tsx` for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER`.

None found. No debt-marker gate triggered.

ℹ️ Info: `apps/gateway/src/index.ts:89-92` trusts the client-supplied `x-forwarded-for` header before falling back to `srv.requestIP()`. This is spoofable by a direct (non-proxied) client and could be used to bypass the per-IP rate limiter in a real deployment without a trusted reverse proxy stripping/overwriting that header. Not a Phase 4 goal blocker (the demo/local-run architecture per PROJECT.md's current scope has no public deploy yet) but worth hardening before any public Fly.io deploy (Phase 6).

### Gaps Summary

Two of the five ROADMAP.md Phase 4 success criteria are not met in the current codebase:

1. **No idle-room sweeper.** `room.lastActivityAt` is tracked but nothing evicts rooms after >10 minutes of inactivity. This was a real-time, documented decision made during the Phase 4 discussion (`04-CONTEXT.md` D-09: "User explicitly requested no idle eviction... Rooms remain alive until empty."), which reads as an intentional, informed scope cut rather than an oversight. However, per verifier rules a discussion-log entry is not a formal verification override — `ROADMAP.md` still states the sweeper as a hard success criterion, and no `VERIFICATION.md` override with `accepted_by`/`accepted_at` has been recorded to close that gap between the contract and the decision.

   **This looks intentional.** To accept this deviation, add to this file's frontmatter and re-run verification (or have a human confirm directly):
   ```yaml
   overrides:
     - must_have: "Idle rooms (>10min no activity) are evicted by a 60s sweeper"
       reason: "User explicitly decided during Phase 4 discussion (04-CONTEXT.md D-09) that rooms should not expire on inactivity — accepted risk given in-memory Map storage and small demo scale."
       accepted_by: "<name>"
       accepted_at: "<ISO timestamp>"
   ```
   Also recommended: update `ROADMAP.md` Phase 4 SC3 text to remove/rephrase the sweeper requirement so future verification runs don't re-flag it.

2. **No proactive "room closed" notification.** Unlike the sweeper, this half of SC3 was not discussed or explicitly excluded in `04-CONTEXT.md` — it appears to simply not have been built. The closest existing UX (a reactive "Room Lost" toast on a failed action) does not satisfy "opponent views show a toast within 5s of last player leaving" as a push notification to an idle viewer.

Neither gap blocks REQ-07 (the phase's primary reconnect deliverable, which is solidly implemented and tested) — both concern REQ-09's secondary room-lifecycle scope. Given the demo-first, in-memory-Map, single-process architecture explicitly chosen for this project (PROJECT.md Constraints), the practical OOM/resource risk from these gaps is low at current scale, but they remain unmet success criteria as literally written in ROADMAP.md.

Separately, one truth (WS heartbeat dead-connection cleanup) is present and wired but has no automated or manual behavioral evidence exercising the actual timeout-closes-socket path — routed to human verification rather than blocked, since the code is demonstrably correct on inspection but unproven at runtime.

---

_Verified: 2026-09-16_
_Verifier: Claude (gsd-verifier)_
