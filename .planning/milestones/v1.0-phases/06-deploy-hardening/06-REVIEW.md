---
phase: 06-deploy-hardening
reviewed: 2026-09-09T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - README.md
  - apps/engine/src/engine.ts
  - apps/engine/src/index.ts
  - apps/gateway/src/__tests__/drain.test.ts
  - apps/gateway/src/index.ts
  - apps/gateway/src/ws/client-manager.ts
  - apps/gateway/src/ws/handlers.ts
  - apps/web/src/__tests__/App.test.tsx
findings:
  critical: 1
  warning: 1
  info: 1
  total: 3
status: issues_found
---

# Phase 6: Code Review Report (Re-Review)

**Reviewed:** 2026-09-09
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

This is a re-review of the fix commits for the prior review's 4 findings (CR-01 gateway
drain-event latch race, WR-01 duplicate `SERVER_SHUTTING_DOWN` broadcast, WR-02 uncleared
drain timers, WR-03 re-entrant SIGTERM/SIGINT guard), plus a new README "Environment
Variables" doc section and a new `App.test.tsx` regression test.

Traced against `git diff f391968..HEAD`:

- **WR-02 (uncleared drain timers):** Fixed correctly in `apps/engine/src/engine.ts`.
  Both `hardTimer` and `pollTimer` are captured and cleared in the `.then()` continuation,
  and the `stopped` flag guards the in-flight `check()` async function against scheduling a
  further poll after the race has already settled.
- **WR-03 (re-entrant SIGTERM/SIGINT):** Fixed correctly in both `apps/engine/src/index.ts`
  and `apps/gateway/src/index.ts` via a synchronously-set `shuttingDown` flag checked before
  any `await`, which closes the re-entrancy window given Node/Bun signal handlers run one at
  a time on the event loop.
- **CR-01 (latch race): the fix introduces a new, more serious bug.** The check-then-subscribe
  sequence itself is race-free (verified: no `await` between the `isDrained()` check and the
  `bridge.onGatewayEvent` subscription), so the *specific* interleaving the regression test
  targets is closed. But the underlying `manager.setDrained(true)` latch it relies on is
  **permanent and process-lifetime-scoped**, not scoped to a single drain cycle — see the
  Critical finding below. This is worse than the bug it replaced.
- **WR-01 (duplicate broadcast): only partially fixed.** Fixed for unified mode; still
  duplicates in split/Redis mode, the project's primary documented production topology.
  See the Warning finding below.

The new README section (Environment Variables) was cross-checked against
`apps/gateway/src/env.ts` and `apps/engine/src/env.ts` and is accurate. The `fly.toml
kill_timeout = "10s"` claim was verified directly against `fly.toml` and is correct. The
new `App.test.tsx` is functionally sound, with one minor hygiene note in Info.

## Critical Issues

### CR-B1: `manager.isDrained()` latch is never reset between drain cycles, causing premature/incorrect drain short-circuit and loss of in-flight race state

**File:** `apps/gateway/src/ws/handlers.ts:98-104` (sets the latch), `apps/gateway/src/index.ts:138-142` (consumes the latch), `apps/gateway/src/ws/client-manager.ts:18-24,97-102` (latch storage/reset)

**Issue:**
`bindBridgeToGateway`'s `"drained"` case sets the latch unconditionally, with no
correlation to *which* drain cycle produced it:

```ts
case "drained": {
  manager.setDrained(true);
  break;
}
```

The only place this is ever reset is `ClientManager.clear()`, which is only called from
`GatewayInstance.stop()` — i.e., *after* a real shutdown's `drain()` has already run. There
is no mechanism that resets the latch at the *start* of a drain cycle, and no timestamp or
epoch tying a given `"drained"` event to a given `drain()` invocation.

In split/Redis mode (`docker-compose.yml`'s topology, and the only topology where CR-01's
race is even reachable — see `RedisEventBridge`/`LoopbackIpcClient`), the engine process
publishes `"drained"` at the end of **every** `EngineWorker.drain()` call — which fires on
*any* SIGTERM the engine process receives, not only ones correlated with an intentional
gateway shutdown. `docker-compose.yml` gives the engine container `restart: unless-stopped`,
so an engine crash-restart, a `docker compose restart engine`, or an independent
engine-only redeploy all cause the engine to publish `"draining"` then `"drained"` on the
shared bridge. The long-lived gateway process latches `drained = true` at that point and
never clears it.

Much later, when the *gateway* itself is actually asked to shut down (its own SIGTERM), its
`drain()` runs:

```ts
manager.broadcastAll({ type: "error", code: "SERVER_SHUTTING_DOWN", message: "Server is shutting down" });
if (manager.isDrained()) {
  // "nothing left to wait for" — but this is a stale latch from an
  // unrelated engine restart that may have happened hours/days earlier
} else {
  // wait for a fresh "drained" event or timeout
}
```

`manager.isDrained()` returns the stale `true` from the earlier, unrelated engine restart,
so `drain()` resolves **immediately** instead of waiting up to 90s for the current engine
instance to actually finish in-flight races. `GatewayInstance.stop()` then runs
`server.stop(true)` (a forceful close), tearing down every currently-open WebSocket
connection — including any race that is genuinely mid-progress at that moment. This directly
contradicts the documented shutdown contract in `README.md:85` ("lets in-flight races finish
normally... exits once drained or after a 90-second hard cap") and is a real risk of losing
in-progress race state / abruptly disconnecting players who are mid-race, purely because of
an unrelated engine restart that happened at some earlier point in the gateway's uptime.

Note this is worse than the bug CR-01 originally fixed: the pre-fix behavior in the true
CR-01 race (both processes SIGTERM'd together, "drained" published a hair before `drain()`
subscribes) was merely "wait the full timeout instead of resolving instantly" — a slow but
otherwise correct drain. The fix trades that timing inefficiency for a correctness bug: a
stale latch from a completely unrelated, non-concurrent event can now cause an *incorrect*
instant resolution during a real, unrelated shutdown.

(This is compounded by a pre-existing, out-of-diff-scope issue in the same code path: the
sibling `manager.setDraining(true)` in `bindBridgeToGateway`'s `"draining"` case has the
identical staleness problem — a lone engine restart also permanently flips the gateway into
"draining" mode, causing `dispatch.ts` to reject all `create_room`/`join_room`/`start_race`
frames for the remaining lifetime of the gateway process, even though the gateway itself
never received a shutdown signal. That defect predates this diff, but it's worth flagging
here since it makes the scenario above far more likely to occur in practice than a one-off
edge case.)

**Fix:** Scope the latch to a drain cycle instead of the process lifetime — e.g., only trust
a `"drained"` event if it arrived recently relative to when this `drain()` invocation
started, and reset the latch when a new drain cycle begins:

```ts
// client-manager.ts
private drainedAtMs: number | null = null;

setDrained(): void {
  this.drainedAtMs = Date.now();
}

isDrainedSince(sinceMs: number, freshnessMs = 10_000): boolean {
  return this.drainedAtMs !== null
    && this.drainedAtMs >= sinceMs - freshnessMs;
}
```

```ts
// index.ts drain()
const drainStartedAtMs = Date.now();
manager.setDraining(true);
...
manager.broadcastAll({ ... });
if (manager.isDrainedSince(drainStartedAtMs)) {
  // genuinely a CR-01-style race with *this* shutdown, not a stale event
} else {
  // subscribe for a fresh "drained" event, as today
}
```

Apply the same epoch/freshness discipline to the `WR-A1` fix's proposed
"broadcast shutdown once" latch below — a bare boolean there would reintroduce this exact
staleness class.

## Warnings

### WR-A1: `SERVER_SHUTTING_DOWN` is still broadcast twice in split/Redis mode

**File:** `apps/gateway/src/index.ts:124-162` (the `drain()` closure), interacting with
`apps/gateway/src/ws/handlers.ts:92-96` (`bindBridgeToGateway`'s `"draining"` case)

**Issue:**
The WR-01 fix only prevents the double broadcast when the gateway has a **local**
`engineWorker` (unified mode: `if (engineWorker && engineWorker.drain) { await
engineWorker.drain(timeoutMs); }` — no direct `manager.broadcastAll(...)` call here, relying
solely on the `"draining"` bridge event to trigger the single broadcast in
`bindBridgeToGateway`).

In split mode (`LoopbackIpcClient`) and Redis mode (`RedisEventBridge`) — the topology used
by `docker-compose.yml`, where gateway and engine run as **separate processes/containers** —
`engineWorker` is always `undefined` in the gateway process, so `drain()` always takes the
`else` branch:

```ts
} else {
  manager.broadcastAll({ type: "error", code: "SERVER_SHUTTING_DOWN", message: "Server is shutting down" });
  ...
}
```

This unconditionally broadcasts directly from the gateway's own `drain()` call (triggered by
the gateway process's own SIGTERM/SIGINT handler). Independently, the **engine** process has
its own SIGTERM handler (`apps/engine/src/index.ts`) that calls `worker.drain(90_000)`, whose
first action is `void this.bridge.publishToGateway({ type: "draining" })`. That event
traverses the IPC/Redis bridge to the gateway's already-bound `bindBridgeToGateway` listener,
whose `"draining"` case *also* calls `manager.broadcastAll(SERVER_SHUTTING_DOWN)`.

Because `docker compose down`/`docker compose stop` sends SIGTERM to all containers
essentially in parallel (per `docker-compose.yml`, gateway and engine are separate
`services:` entries with independent lifecycles), a normal production shutdown will trigger
**both** code paths, producing two `SERVER_SHUTTING_DOWN` frames per connected client — the
exact class of bug WR-01 was meant to close, just relocated to the mode that actually matters
for deployment. The only existing regression test for this ("GatewayInstance.drain() in
split mode", `drain.test.ts:80-100`) never simulates a concurrent `"draining"` event from a
real second process, so it does not exercise this path and the regression passed unnoticed.

**Fix:** Guard the direct broadcast with a cycle-scoped idempotency latch (not a bare
permanent boolean — see CR-B1 above for why that's insufficient) shared between the
split-mode branch of `drain()` and `bindBridgeToGateway`'s `"draining"` case:

```ts
// client-manager.ts
private shutdownBroadcastAtMs: number | null = null;
broadcastShutdownOnce(): void {
  if (this.shutdownBroadcastAtMs !== null) return; // already sent this cycle
  this.shutdownBroadcastAtMs = Date.now();
  this.broadcastAll({ type: "error", code: "SERVER_SHUTTING_DOWN", message: "Server is shutting down" });
}
```

Call `manager.broadcastShutdownOnce()` from both call sites instead of two independent
`manager.broadcastAll(...)` calls, and reset `shutdownBroadcastAtMs` alongside whatever reset
mechanism CR-B1's fix introduces. Add a regression test that publishes a `"draining"` bridge
event *and* calls `instance.drain()` in split mode and asserts `ws.send` is called exactly
once, mirroring the existing unified-mode regression test.

## Info

### IN-01: `drain.test.ts` describe-scope `manager` variable is shadowed, making its `afterEach` cleanup misleading

**File:** `apps/gateway/src/__tests__/drain.test.ts:12-21, 60-125`

**Issue:** The `describe` block declares `let manager: ClientManager;` at the top and
`afterEach` calls `manager?.clear();` expecting this to clean up whatever `ClientManager` each
test used. Only the first test ("E2E contract...") actually assigns to this describe-scope
variable (`manager = new ClientManager();`). The next three tests either use the default
`clientManager` singleton implicitly (via `startGateway()` without an explicit `manager`
option) or declare their own **local** `const manager = new ClientManager();` inside the test
body (the CR-01 test), which shadows the outer `let manager` rather than assigning to it.
Consequently `afterEach`'s `manager?.clear()` is, for tests 2-4, clearing a stale reference
left over from test 1 (or `undefined`), not the `ClientManager` instance actually exercised by
that test. This doesn't currently cause test failures because each of those tests separately
calls `inst.stop()`, which does perform the correct cleanup on the manager it actually used —
but the `afterEach` line gives false confidence that it's doing cleanup work it isn't, and a
future test added without its own explicit `inst.stop()` call would silently leak
`ClientManager` state (sockets/room membership/draining flags) into subsequent tests via the
shared `clientManager` singleton.

**Fix:** Either reassign the outer `manager` variable explicitly in every test (`manager =
new ClientManager()` without `const`, or `manager = inst.clientManager` after `startGateway`),
or drop the shared `afterEach` cleanup assumption and have each test responsible for its own
teardown (already effectively true via `inst.stop()`), removing the misleading
`manager?.clear()` line from `afterEach`.

---

_Reviewed: 2026-09-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
