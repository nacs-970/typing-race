---
phase: 04-reconnect
verified: 2026-09-23T00:00:00Z
status: human_needed
score: 5/6 must-haves verified (1 present, behavior-unverified — WS heartbeat timeout cleanup)
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
  - .planning/phases/04.1-add-proactive-room-closed-toast/04.1-01-SUMMARY.md
  - .planning/phases/04.1-add-proactive-room-closed-toast/04.1-CONTEXT.md
  - .planning/phases/04.1-add-proactive-room-closed-toast/04.1-VERIFICATION.md
  - apps/engine/src/__tests__/disconnect.test.ts
  - apps/engine/src/__tests__/reconnect.test.ts
  - apps/engine/src/__tests__/rooms.test.ts
  - apps/engine/src/engine.ts
  - apps/engine/src/race/controller.ts
  - apps/engine/src/race/validate-keystroke.ts
  - apps/engine/src/rooms/manager.ts
  - apps/gateway/src/__tests__/gateway.test.ts
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

covered_digest: "v1:sha256:229334ab94a51015787a31128d68cbed2d802327c6310004b5861d70a3bb4cc3"
behavior_unverified: 1
overrides_applied: 1
overrides:

  - must_have: "Idle rooms (>10min no activity) are evicted by a 60s sweeper"
    reason: >
      Explicit, documented user decision during Phase 4 discussion (04-CONTEXT.md D-09:
      "User explicitly requested no idle eviction. Rooms remain alive until empty.").
      Accepted risk given in-memory Map storage and small demo scale.
    accepted_by: "atithep_thepkit@cmu.ac.th"
    accepted_at: "2026-09-23"
re_verification:
  previous_status: human_needed
  previous_score: "6/7 (frontmatter) / 5/7 (body) — prior file's two counts disagreed with its own 6 enumerated truths; corrected to 6-truth denominator this pass"
  gaps_closed:
    - "Opponent views show a graceful 'room closed' toast within 5s of the last player leaving — fixed by Phase 04.1, independently re-confirmed this pass (see truth 3b)"
  gaps_remaining: []
  regressions: []
advisory: []
behavior_unverified_items:

  - truth: "WS heartbeat: dead connections are closed cleanly without state corruption (15s ping / 5s pong timeout)"
    test: "Open a WS connection, stop responding to ping frames, and wait for startHeartbeat's 20s timeout window to elapse"
    expected: "ws.close(1001, 'Heartbeat timeout') fires, manager.removeSocket(playerId) runs, and the resulting client_disconnected event correctly starts the 60s disconnect grace without leaving orphaned state (stale socket entries, room state referencing a dead player)"
    why_human: "No automated test exercises startHeartbeat's timeout branch — grep across apps/**/*.test.ts still finds zero references to startHeartbeat as of this pass. ws-lifecycle.test.ts only proves the ping->pong round trip and socket-registry cleanup on close(), not that the 20s no-pong timeout path fires ws.close()/removeSocket() cleanly. The mechanism is present and wired (apps/gateway/src/ws/handlers.ts:167-195) but the cleanup-on-timeout invariant remains unexercised."
coincidental_reliance_items: []
human_verification:

  - test: "Leave a WS tab open, block outgoing pong frames (e.g. via devtools throttling or a debug client that never responds to ping), and wait >20s"
    expected: "Server closes the socket with code 1001 within ~20s of the last pong, the disconnected player's room correctly starts the 60s grace (player_disconnected broadcast to opponents), and no duplicate/orphaned entries remain in ClientManager.sockets"
    why_human: "Requires a live socket held open across the 15s ping interval / 5s timeout window; not exercised by any existing automated test (see behavior_unverified_items)"
audit_acknowledged:
  milestone: v1.0
  at: 2026-09-22
  status: human_needed
---

# Phase 4: Reconnect Verification Report

**Phase Goal:** Mid-race reconnect without corrupting state, plus room lifecycle (idle sweeper, heartbeat ping/pong) and per-IP rate limiting. Makes the demo URL robust to wifi blips and prevents OOM on Fly.io.
**Verified:** 2026-09-23
**Status:** human_needed
**Re-verification:** Yes — after gap closure (Phase 04.1) and formal override acceptance

## Context for this pass

This is an independent re-verification of the 2026-09-16 04-VERIFICATION.md, which found 2 gaps:

1. **No idle-room sweeper** — the prior pass identified this as an intentional, documented scope cut (04-CONTEXT.md D-09) that was missing a formal override. A formal override has now been signed off (`atithep_thepkit@cmu.ac.th`, 2026-09-23) and is applied below (see frontmatter `overrides:`), matching D-09's rationale verbatim.
2. **No proactive "room closed" toast** — closed by the separate gap-closure phase 04.1. This pass independently re-verifies that fix against the current codebase rather than trusting 04.1-VERIFICATION.md's resolution claim.

The 1 `behavior_unverified` item (WS heartbeat 20s timeout cleanup path) carries forward unchanged — still no automated test exercises it, and it remains a legitimate `human_verification` item, not a gap.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Closing a tab mid-race and reopening within 60s restores progress; opponents see "X reconnected" not "X joined" | ✓ VERIFIED | `RoomManager.rejoinPlayer` (`apps/engine/src/rooms/manager.ts:229+`) still present; re-bind logic unchanged in substance since the prior pass. `reconnect.test.ts` re-run this pass: pass. |
| 2 | Server sends full race snapshot on reconnect, 500ms grace before reconnected keystrokes count | ✓ VERIFIED | `RECONNECT_GRACE_MS = 500` still present and enforced in `apps/engine/src/race/validate-keystroke.ts:27,68`. |
| 3a | Idle rooms (>10min no activity) evicted by a 60s sweeper | ✓ PASSED (override) | No sweeper exists anywhere in the current codebase — confirmed by re-grep (`room.lastActivityAt` is written in `manager.ts` and `controller.ts` but never read for eviction). Override: "Explicit, documented user decision during Phase 4 discussion (04-CONTEXT.md D-09)... Accepted risk given in-memory Map storage and small demo scale." — accepted by atithep_thepkit@cmu.ac.th on 2026-09-23. |
| 3b | Opponent views show "room closed" toast within 5s of last player leaving | ✓ VERIFIED | Fixed by Phase 04.1, independently re-confirmed this pass (not trusted from 04.1-VERIFICATION.md's resolution claim). `RoomManager.removePlayer` (`apps/engine/src/rooms/manager.ts:147-170`) broadcasts `ROOM_CLOSED` at the `room.players.size === 1` transition (retargeted from the original `size === 0`, which had zero reachable recipients). Both real-world departure paths reach this: explicit `leave_room` calls `removePlayer` directly, AND tab-close/disconnect eviction (`apps/engine/src/race/controller.ts:203`, the 60s grace-expiry path) also calls `this.roomManager.removePlayer(...)` — so the proactive notice fires regardless of whether the last player leaves via an explicit action or a dead connection. `apps/web/src/App.tsx:201-203` renders it as an "Alone in Room" toast ("All other players have left this room."). `apps/gateway/src/__tests__/gateway.test.ts` (lines 135-152) is a genuine two-real-socket integration test: it starts a real gateway server (`startGateway`), connects two live `WebSocket` clients, drives one to `leave_room`, and asserts the *other* live socket receives the `ROOM_CLOSED` error frame while the leaver's own socket does not. I re-ran this test myself this pass (see Behavioral Spot-Checks) — it passed, not just claimed passing in a SUMMARY. **Semantic note:** the delivered behavior diverges from SC3's literal wording — it fires at "one player remains" (not "room becomes fully empty"), the room is NOT torn down at that point (`rooms.test.ts` test 9b confirms deletion happens only at `size===0`, with no re-broadcast), and the copy is "Alone in Room" rather than "room closed." For the project's actual 2-player-race shape this is functionally equivalent to the intended UX (the opponent sees a toast when the other player leaves), but a reader should not assume the literal SC3 text was implemented verbatim. |
| 4 | WS heartbeat ping every 15s / 5s pong timeout; dead connections closed cleanly without state corruption | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `startHeartbeat` (`apps/gateway/src/ws/handlers.ts:167-195`) still pings every 15s and closes with code 1001 after 20s without a pong. Still zero automated tests exercise the timeout-closes-cleanly branch (re-confirmed by fresh grep this pass: `grep -rn "startHeartbeat" apps/**/*.test.ts` → no matches). Routed to human verification, unchanged from prior pass. |
| 5 | Creating >10 rooms from one IP in 1h returns HTTP 429 (functionally: `RATE_LIMITED` WS error); existing rooms unaffected | ✓ VERIFIED | `IpRateLimiter` (`apps/gateway/src/rate-limit/ip-limiter.ts`) still present, still a real sliding window on real client IP. `gateway/__tests__/rate-limit.test.ts` re-run this pass: pass. |

**Score:** 5/6 truths verified (1 present, behavior-unverified). Truth 3a counts toward the score via accepted override; truth 4 does not count toward either verified or failed — see `behavior_unverified_items`.

### Deferred Items

None.

### Advisory (New Scope, Unevidenced)

New-scope findings from Step 7 with no deterministic evidence — reported, not blocking, do not revert a completed must-have.

None found this pass. The only carried-forward Info-level note (client-supplied `x-forwarded-for` trust in `apps/gateway/src/index.ts`) was already non-blocking in the prior pass and is preserved as Info below, not promoted.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/engine/src/rooms/manager.ts` — `rejoinPlayer`, `removePlayer` | Session re-bind + room-closed broadcast | ✓ VERIFIED | Present, substantive, wired. `removePlayer` now broadcasts `ROOM_CLOSED` at `size===1` (lines 147-170). |
| `apps/engine/src/race/frames.ts` — snapshot/broadcast builders | Snapshot + broadcast builders | ✓ VERIFIED | Unchanged, still wired from manager.ts |
| `apps/engine/src/race/validate-keystroke.ts` | 500ms reconnect grace | ✓ VERIFIED | `RECONNECT_GRACE_MS` check present |
| `apps/engine/src/race/controller.ts` | 60s disconnect eviction; idle sweeper (overridden) | ✓ VERIFIED (disconnect eviction) / ✓ PASSED (override, idle sweeper) | 60s disconnect eviction present and confirmed to call `removePlayer` (line 203), which now carries the room-closed side effect. No idle sweeper — covered by accepted override. |
| `apps/gateway/src/ws/handlers.ts` | Heartbeat ping/pong | ✓ VERIFIED (present, wired) | Timeout-close branch present but behaviorally unverified — see truth 4 |
| `apps/gateway/src/rate-limit/ip-limiter.ts` | Per-IP room-creation limiter | ✓ VERIFIED | Real client IP, sliding window, wired in dispatch.ts |
| `apps/web/src/App.tsx` | Disconnect/reconnect/room-closed toasts | ✓ VERIFIED | `player_disconnected`, `player_reconnected`, `ROOM_CLOSED` ("Alone in Room") all handled and rendered (lines 187-206) |
| `packages/shared/src/messages.ts` — `ROOM_CLOSED` schema | Room-lifecycle closure notice | ✓ VERIFIED | `ROOM_CLOSED` present in `errorSchema` enum (line 182) — was MISSING in the prior pass, now fixed by Phase 04.1 |
| `apps/gateway/src/__tests__/gateway.test.ts` | Two-socket integration proof of proactive push | ✓ VERIFIED | Real `startGateway` server, two live `WebSocket` clients, asserts delivery to remaining player + exclusion of leaver (lines 135-152). Re-run this pass: pass. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `apps/web/src/net/ws.ts` (rejoin) | `apps/engine/src/engine.ts` `case "rejoin_room"` | WS `rejoin_room` frame -> `roomManager.rejoinPlayer` | ✓ WIRED | Unchanged from prior pass |
| `RoomManager.rejoinPlayer` | `apps/web/src/App.tsx` `rejoined_room` handler | Snapshot frame -> bridge event -> gateway -> WS frame | ✓ WIRED | Unchanged from prior pass |
| `apps/gateway/src/ws/dispatch.ts` `create_room` | `IpRateLimiter.check` | Direct call before room creation proceeds | ✓ WIRED | Unchanged from prior pass |
| `apps/gateway/src/ws/handlers.ts` `startHeartbeat` | Disconnect grace flow | `ws.close(1001,...)` -> `client_disconnected` bridge event -> `manager.handlePlayerDisconnect` | ⚠️ WIRED, UNEXERCISED | Unchanged — no test exercises the timeout branch |
| `apps/engine/src/race/controller.ts` (60s disconnect grace-evict) | `RoomManager.removePlayer` | Direct call at grace expiry (line 203) | ✓ WIRED | Confirms tab-close/disconnect departures also trigger the `size===1` ROOM_CLOSED broadcast, not just explicit `leave_room` |
| `RoomManager.removePlayer` (`size===1`) | `apps/gateway/src/ws/handlers.ts` `broadcast_to_room` | `bridge.publishToGateway({type: "broadcast_to_room", ...})` | ✓ WIRED | Re-confirmed this pass via `gateway.test.ts` real-socket run |
| `broadcast_to_room` handler | `apps/web/src/App.tsx` "Alone in Room" toast | `ClientManager.getRoomSockets` -> `ws.send` -> client `ws.subscribe` handler | ✓ WIRED, REACHABLE RECIPIENT CONFIRMED | Unlike the prior pass's `size===0` hook (zero reachable recipients), `size===1` has a live, confirmed recipient — proven end-to-end by `gateway.test.ts`, not just by code inspection |
| Idle sweeper | (none) | N/A | ✗ NOT_WIRED (overridden) | No such component exists — covered by accepted override, not a gap |

### Behavioral Spot-Checks / Test Runs

Re-run myself this pass, not trusted from any SUMMARY or prior VERIFICATION.md claim:

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Reconnect handshake, snapshot, multi-tab takeover, duplicate-rejoin idempotency | `bun test apps/engine/src/__tests__/reconnect.test.ts` | pass (part of combined run below) | ✓ PASS |
| 60s disconnect grace, boundary timing, host migration, room deletion | `bun test apps/engine/src/__tests__/disconnect.test.ts` | pass (part of combined run below) | ✓ PASS |
| Room lifecycle: size===1 ROOM_CLOSED broadcast, size===0 no-rebroadcast, room deletion | `bun test apps/engine/src/__tests__/rooms.test.ts` | pass (part of combined run below) | ✓ PASS |
| Per-IP rate limit sliding window | `bun test apps/gateway/src/__tests__/rate-limit.test.ts` | pass (part of combined run below) | ✓ PASS |
| WS lifecycle (hello, ping/pong echo, malformed JSON resilience, socket registry cleanup on close) | `bun test apps/gateway/src/__tests__/ws-lifecycle.test.ts` | pass (part of combined run below) | ✓ PASS |
| Two-real-socket ROOM_CLOSED delivery + leaver-exclusion (04.1 fix) | `bun test apps/gateway/src/__tests__/gateway.test.ts` | pass (part of combined run below) | ✓ PASS |
| Combined run | `bun test apps/engine/src/__tests__/reconnect.test.ts apps/engine/src/__tests__/disconnect.test.ts apps/engine/src/__tests__/rooms.test.ts apps/gateway/src/__tests__/rate-limit.test.ts apps/gateway/src/__tests__/ws-lifecycle.test.ts apps/gateway/src/__tests__/gateway.test.ts` | 28 pass, 0 fail, 109 expect() calls, across 6 files | ✓ PASS |
| Heartbeat timeout -> close -> cleanup invariant | `grep -rn "startHeartbeat" --include="*.test.ts" apps/` | 0 references found | ✗ NO COVERAGE (routed to human verification, unchanged) |
| Idle sweeper existence | `grep -n "lastActivityAt\|setInterval\|sweep\|IDLE" apps/engine/src/race/controller.ts apps/engine/src/rooms/manager.ts` | Only writes to `lastActivityAt`; no reader/evictor anywhere | ✗ CONFIRMED ABSENT (covered by accepted override) |

### Requirements Coverage

| Requirement | Source Plan | Description (from PROJECT.md / ROADMAP.md) | Status | Evidence |
|-------------|------------|---------------------------------------------|--------|----------|
| REQ-07 | 04-01, 04-02, 04-04, 04-05 | "Reconnect mid-race without corrupting race state" | ✓ SATISFIED | Truths 1-2 verified; disconnect/eviction/host-migration behaviorally tested |
| REQ-09 | 04-03, 04.1-01 | "rematch polish from Phase 3 deliverable" / room lifecycle (sweeper, heartbeat, rate limit) | ✓ SATISFIED (with accepted deviation + 1 human item) | Heartbeat and rate-limit portions verified (1 behavior-unverified item, unchanged); idle-sweeper portion covered by accepted override; room-closed toast portion fixed by Phase 04.1 and independently re-confirmed this pass |

This project has no REQUIREMENTS.md (confirmed again this pass — `ls .planning/REQUIREMENTS.md` returns nothing); PROJECT.md's unlabeled checklist is the only requirements source, consistent with the prior pass's note.

### Anti-Patterns Found

Re-scanned `apps/engine/src/rooms/manager.ts`, `apps/engine/src/race/controller.ts`, `apps/gateway/src/ws/handlers.ts`, `apps/gateway/src/ws/dispatch.ts`, `apps/web/src/App.tsx`, `apps/gateway/src/__tests__/gateway.test.ts`, `apps/engine/src/__tests__/rooms.test.ts`, `packages/shared/src/messages.ts` for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER`.

One match: `apps/engine/src/__tests__/rooms.test.ts:44` — `"XXXXXX"`, a deliberately invalid room-code fixture string, not a debt marker (same finding as the prior pass; re-confirmed, not a regression).

No debt-marker gate triggered.

ℹ️ Info (carried forward, unchanged): `apps/gateway/src/index.ts` trusts the client-supplied `x-forwarded-for` header before falling back to `srv.requestIP()`. Spoofable by a direct client without a trusted reverse proxy. Not a Phase 4 goal blocker at current demo scale; worth hardening before any public deploy.

### Gaps Summary

No open gaps remain. Both items from the prior pass are closed:

1. **Idle-room sweeper** — now covered by a formally accepted verification override (`atithep_thepkit@cmu.ac.th`, 2026-09-23), matching the pre-existing D-09 decision. `PASSED (override)`, counts toward score.
2. **Proactive "room closed" toast** — independently re-confirmed as actually fixed in the current codebase by Phase 04.1: the broadcast trigger is retargeted to `size===1` (a real, reachable recipient, unlike the original `size===0`), reachable via both explicit leave and tab-close/disconnect eviction, rendered as an "Alone in Room" toast, and proven by a genuine two-real-socket integration test that I re-ran myself this pass (28/28 pass across the full relevant test set).

One item remains routed to human verification, unchanged from the prior pass and not a gap: the WS heartbeat's 20s no-pong timeout -> `ws.close()` -> `removeSocket()` cleanup path is present and correctly wired by inspection but has zero automated test coverage exercising the actual timeout branch. This is a legitimate `human_needed` item per the verifier's behavior-dependent-truth rules (a cancellation/cleanup invariant that presence+wiring alone cannot prove), not a blocker.

---

_Verified: 2026-09-23_
_Verifier: Claude (gsd-verifier)_
