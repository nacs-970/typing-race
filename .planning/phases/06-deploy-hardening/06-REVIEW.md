---
phase: 06-deploy-hardening
reviewed: 2026-09-09T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - .bun-version
  - README.md
  - apps/engine/src/__tests__/drain.test.ts
  - apps/engine/src/__tests__/validate-keystroke.test.ts
  - apps/engine/src/engine.ts
  - apps/engine/src/index.ts
  - apps/gateway/src/__tests__/drain.test.ts
  - apps/gateway/src/index.ts
  - apps/gateway/src/ws/client-manager.ts
  - apps/gateway/src/ws/dispatch.ts
  - apps/gateway/src/ws/handlers.ts
  - apps/web/src/App.tsx
  - packages/shared/src/__tests__/bun-version-pin.test.ts
  - packages/shared/src/bridge.ts
  - packages/shared/src/messages.ts
  - scripts/smoke-test.sh
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-09-09T00:00:00Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Reviewed the Phase 6 (Deploy + Hardening) deliverables: the `.bun-version`/Dockerfile drift guard, `EngineWorker.drain()` / `GatewayInstance.drain()` graceful shutdown, the `SERVER_SHUTTING_DOWN` propagation path (engine → bridge → gateway → client toast), the anti-cheat regression test additions, and `scripts/smoke-test.sh`.

The drift-guard test and anti-cheat regression tests are well constructed, and the `draining` gate is applied consistently at both the gateway (`dispatch.ts`) and engine (`engine.ts`) layers for `create_room`/`join_room`/`start_race`, matching the documented behavior in `README.md` ("lets in-flight races finish normally").

Tracing the actual cross-process event flow for the two deploy topologies this phase targets (unified single-container / split or Redis-backed multi-container) surfaced one critical race condition that defeats the drain feature's own purpose in exactly the multi-container/Redis topology the phase is meant to harden, plus a duplicate-broadcast defect in unified mode, timer-cleanup gaps in both drain() implementations, and an un-guarded shutdown re-entrancy window that got materially riskier once the drain window grew to up to 90 seconds. Details and fixes below.

## Critical Issues

### CR-01: Lost `"drained"` event races the gateway's own `drain()` subscription in split/Redis mode — drain can silently degrade to the full 90s hard-cap, which is longer than the deployed `kill_timeout`

**File:** `apps/gateway/src/index.ts:124-148` (interacts with `apps/gateway/src/ws/handlers.ts:98-100`)

**Issue:** In split mode or Redis mode, `engineWorker` is `undefined` on the gateway (it only exists in `MODE=unified`), so `GatewayInstance.drain()` takes the `else` branch and *only then* subscribes to the bridge for a `"drained"` event:

```ts
} else {
  let unsubscribe: (() => void) | undefined;
  const eventPromise = new Promise<void>((resolve) => {
    unsubscribe = bridge.onGatewayEvent((event) => {
      if (event.type === "drained") { resolve(); }
    });
  });
  const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
  await Promise.race([eventPromise, timeoutPromise]);
  ...
}
```

The engine (a separate process in split mode, or a separate process/container in Redis mode) has its own independent `SIGTERM` handler (`apps/engine/src/index.ts:39-45`) and calls `worker.drain(90_000)` on its own schedule. `EngineWorker.drain()` resolves — and publishes `{ type: "drained" }` — almost immediately whenever there happen to be no active rooms (`apps/engine/src/engine.ts:39-69`, first poll iteration). Container orchestrators (Docker Compose `down`, Fly.io machine stop, Kubernetes pod termination) commonly deliver `SIGTERM` to multiple containers/processes at close to the same time, so it is entirely plausible — and will happen routinely whenever no race is in progress — for the engine to publish `"drained"` *before* the gateway's own `SIGTERM` handler has even called `instance.drain(90_000)`.

When that ordering occurs, the early `"drained"` event is silently dropped: `bindBridgeToGateway`'s handler for it is an explicit no-op (`apps/gateway/src/ws/handlers.ts:98-100`, `case "drained": { break; }`), so nothing latches the fact that draining already completed. The gateway's later, freshly-registered `eventPromise` listener will never see that event (it already fired), so `Promise.race` can only resolve via `timeoutPromise` — meaning the gateway now blocks for the *entire* `timeoutMs` (90s by default) even though the engine finished draining instantly.

This is the exact failure mode `README.md` calls out as a known deploy risk: `fly.toml`'s `kill_timeout` is `"10s"`, "well under the 90s drain window." The intent of that note is that *whoever wires up the real deploy* must bump `kill_timeout`. But this bug means even a correctly-configured deploy with `kill_timeout >= 90s` pays the full 90-second penalty on every ordinary shutdown (engine-drained-first case) instead of exiting promptly, and any deploy that has *not yet* bumped `kill_timeout` (i.e., the current `fly.toml` as shipped) gets `SIGKILL`ed mid-drain non-deterministically — killing in-flight WebSocket connections/races ungracefully, which is precisely the outcome graceful drain was built to prevent.

**Fix:** Latch `"drained"` state on the bridge event as soon as it's observed, independent of whether `drain()` has been called yet, and have `drain()` check that latch before subscribing:

```ts
// client-manager.ts (or a small module-level flag near drain wiring)
let alreadyDrained = false;

// handlers.ts
case "drained": {
  alreadyDrained = true; // or manager.setDrained(true)
  break;
}

// index.ts drain()
} else {
  if (alreadyDrained) {
    // engine already reported drained before we started listening
  } else {
    let unsubscribe: (() => void) | undefined;
    const eventPromise = new Promise<void>((resolve) => {
      unsubscribe = bridge.onGatewayEvent((event) => {
        if (event.type === "drained") resolve();
      });
    });
    const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
    await Promise.race([eventPromise, timeoutPromise]);
    if (unsubscribe) unsubscribe();
  }
}
```
Register this latch listener at gateway startup (alongside `bindBridgeToGateway`), not inside `drain()`, so it cannot miss an early event. Add a regression test that publishes `"drained"` *before* calling `instance.drain()` and asserts it resolves promptly rather than waiting for the timeout.

## Warnings

### WR-01: Duplicate SERVER_SHUTTING_DOWN broadcast in unified mode (self-triggered feedback loop)

**File:** `apps/gateway/src/index.ts:125-134` (also involves `apps/gateway/src/ws/handlers.ts:92-96`)

**Issue:** In `MODE=unified` (the documented Fly.io fallback target — see `README.md` "Single-Container Fallback"), the gateway and the in-process `EngineWorker` share the *same* `InMemoryEventBridge` instance. `GatewayInstance.drain()` does two things back-to-back:

1. It calls `manager.broadcastAll({ type: "error", code: "SERVER_SHUTTING_DOWN", ... })` directly (line 129).
2. It then calls `engineWorker.drain(timeoutMs)` (line 132), which internally does `void this.bridge.publishToGateway({ type: "draining" })` (`apps/engine/src/engine.ts:42`).

That `publishToGateway({ type: "draining" })` call is delivered back to the *same* gateway process via the bridge, where `bindBridgeToGateway`'s `"draining"` case (`apps/gateway/src/ws/handlers.ts:92-96`) again calls `manager.setDraining(true)` and `manager.broadcastAll(...)` with the identical payload. Every connected socket therefore receives two `SERVER_SHUTTING_DOWN` frames per shutdown instead of one. The client-side `addToast` dedup (`apps/web/src/store/toast.ts`) happens to mask this when both sends land within the same ~5s toast window, but in split/Redis mode the two publishes can be separated by real network latency (Redis pub/sub round-trip, or independent SIGTERM delivery skew between containers), which can cause the toast to reappear after the first one auto-dismissed. This is also not caught by the existing test (`apps/gateway/src/__tests__/drain.test.ts:60-75`, "GatewayInstance.drain() in unified mode"), which only asserts `expect(ws.send).toHaveBeenCalled()` rather than call count, so a regression to double-send would pass silently.

**Fix:** Don't broadcast directly from `GatewayInstance.drain()` when delegating to `engineWorker.drain()` — let the single `"draining"` event (handled by `bindBridgeToGateway`) be the sole source of the broadcast, or guard the direct call so it only fires on the non-engineWorker (event-listening) branch:

```ts
const drain = async (timeoutMs = 90_000) => {
  if (drainPromise) return drainPromise;
  drainPromise = (async () => {
    manager.setDraining(true);
    if (engineWorker && engineWorker.drain) {
      // "draining" event from engineWorker.drain() will trigger the broadcast
      // via bindBridgeToGateway — don't double-send here.
      await engineWorker.drain(timeoutMs);
    } else {
      manager.broadcastAll({ type: "error", code: "SERVER_SHUTTING_DOWN", message: "Server is shutting down" });
      let unsubscribe: (() => void) | undefined;
      ...
    }
  })();
  return drainPromise;
};
```
Also tighten the regression test to assert `expect(ws.send).toHaveBeenCalledTimes(1)` so a re-introduced double-send fails CI.

### WR-02: Both `drain()` implementations leak timers after they resolve

**File:** `apps/engine/src/engine.ts:39-69`, `apps/gateway/src/index.ts:124-148`

**Issue:** Two related timer-cleanup gaps, present in both drain implementations:

1. **Engine (`engine.ts:44`):** `hardTimeout`'s `setTimeout(resolve, timeoutMs)` is never captured in a variable, so it can never be cancelled. If `pollLoop` resolves quickly (the common case — no active rooms), the underlying OS timer for `hardTimeout` (up to 90s by default) keeps running in the background until it naturally fires, doing nothing useful.

   Separately, when `hardTimeout` *does* win the race (active rooms never clear before the cap), the recursive `check()` closure has an `await this.store.list()` gap. If `hardTimeout` fires and the `.then()` (lines 64-67) calls `clearTimeout(pollTimer)` while a `check()` invocation is mid-flight, that `check()` call will — after its `await` resolves — reassign `pollTimer = setTimeout(check, pollIntervalMs)` (line 59) *after* the cleanup already ran. This new timer is never tracked or cleared, so the poll loop keeps re-invoking `check()` (and re-querying `this.store.list()`) indefinitely, even after `"drained"` has already been published.

2. **Gateway (`index.ts:142`):** The identical pattern exists here — `const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));` is never captured or cleared. This one is arguably worse: the engine's `index.ts` always calls `process.exit(0)` immediately after `drain()` resolves, masking the leak in production, but `GatewayInstance.stop()` is a clean-teardown API that tests call directly with no process exit (`apps/gateway/src/__tests__/drain.test.ts:74,96`, `await inst.stop()`), so a ref'd up-to-90s timer survives `stop()` and keeps the event loop (and, in a real deployment reusing `startGateway()` as a library, the process) alive well past teardown.

Neither timer is `.unref()`'d (unlike the heartbeat timer in `handlers.ts:187`, which is).

**Fix:** Track and always clear every timer regardless of which branch of the race wins, in both files. For `engine.ts`:

```ts
drain(timeoutMs = 90_000, pollIntervalMs = 500): Promise<void> {
  if (this.drainPromise) return this.drainPromise;
  this.draining = true;
  void this.bridge.publishToGateway({ type: "draining" });

  let hardTimer: ReturnType<typeof setTimeout>;
  const hardTimeout = new Promise<void>(resolve => { hardTimer = setTimeout(resolve, timeoutMs); });

  let pollTimer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const pollLoop = new Promise<void>((resolve) => {
    const check = async () => {
      if (stopped) return;
      try {
        const rooms = await this.store.list();
        if (stopped) return;
        const active = rooms.filter(r => r.state === "countdown" || r.state === "racing" || r.state === "grace");
        if (active.length === 0) { resolve(); return; }
      } catch (e) {
        logger.error({ err: e }, "[engine] drain poll error");
      }
      if (!stopped) pollTimer = setTimeout(check, pollIntervalMs);
    };
    void check();
  });

  this.drainPromise = Promise.race([pollLoop, hardTimeout]).then(() => {
    stopped = true;
    clearTimeout(hardTimer);
    if (pollTimer) clearTimeout(pollTimer);
    void this.bridge.publishToGateway({ type: "drained" });
  });
  return this.drainPromise;
}
```
Apply the same "capture and clear" treatment to the `timeoutPromise` in `apps/gateway/src/index.ts`'s `drain()`.

### WR-03: Shutdown handlers are not guarded against re-entrant SIGINT/SIGTERM

**File:** `apps/engine/src/index.ts:31-45`, `apps/gateway/src/index.ts:172-184`

**Issue:** Both entrypoints register `SIGINT`/`SIGTERM` handlers that call an unguarded `shutdown`/`onShutdown` async function:

```ts
const shutdown = async () => {
  logger.info("[engine] Shutting down gracefully...");
  await worker.drain(90_000);
  worker.stop();
  await bridge.close();
  process.exit(0);
};
process.on("SIGINT", () => { void shutdown(); });
process.on("SIGTERM", () => { void shutdown(); });
```

Before this phase, shutdown was effectively immediate, so the window for a second signal to arrive mid-shutdown was negligible. Now that `drain()` can legitimately keep the process alive for up to 90 seconds, a second `SIGINT`/`SIGTERM` (common with impatient operators, or orchestrators that send a repeat signal before their configured grace period) will invoke `shutdown()`/`onShutdown()` a second time concurrently. `EngineWorker.drain()` itself is idempotent (`if (this.drainPromise) return this.drainPromise;`), but `bridge.close()` is not guaranteed to be — for `RedisEventBridge.close()` (`packages/shared/src/bridge.ts:175-179`), calling `pub.quit()`/`sub.quit()` a second time on an already-quitting/closed `ioredis` client can reject, and since the outer call site is `void shutdown()` (fire-and-forget), a rejection becomes an unhandled promise rejection during the shutdown path.

**Fix:** Guard the handler so a second signal is a no-op:

```ts
let shuttingDown = false;
const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info("[engine] Shutting down gracefully...");
  await worker.drain(90_000);
  worker.stop();
  await bridge.close();
  process.exit(0);
};
```
Apply the same pattern to `apps/gateway/src/index.ts`'s `onShutdown`.

## Info

### IN-01: Stray `console.log` at module scope in test file

**File:** `apps/engine/src/__tests__/validate-keystroke.test.ts:519`

**Issue:** `console.log("D-07 bypass scenarios")` is called directly inside the `describe()` body (not inside a `test()`/`beforeAll()`), so it executes once at test-collection time on every test run, unconditionally polluting test output. It doesn't affect test correctness/reliability, but it's debug-artifact noise that should have been removed before commit.

**Fix:** Remove the stray `console.log`, or replace with a code comment if the intent was documentation.

### IN-02: Local smoke test never exercises the phase's headline feature (graceful drain)

**File:** `scripts/smoke-test.sh`

**Issue:** `README.md` describes `scripts/smoke-test.sh` as "the local pre-ship check" for Phase 6. The script boots the unified server, polls `/health`, and opens one WebSocket connection to confirm a `hello` frame — but it never sends `SIGTERM` to the server and asserts that connected clients receive `SERVER_SHUTTING_DOWN` / that the process exits within the drain window. `cleanup()` (lines 22-26) does send `SIGTERM` via `kill "$SERVER_PID"`, but only as unconditional teardown in the `EXIT` trap, with `|| true` swallowing the result — it makes no assertion about drain behavior at all. Given this phase's primary deliverable is graceful shutdown, and given CR-01/WR-01/WR-02 above, a smoke test that actually SIGTERMed the server mid-connection and asserted the drain announcement + timely exit would likely have caught at least WR-01.

**Fix:** Add a step that connects a WS client, sends `SIGTERM` to `$SERVER_PID`, and asserts (a) the client receives exactly one `SERVER_SHUTTING_DOWN` error frame, and (b) the process exits within a bounded time.

---

_Reviewed: 2026-09-09T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
