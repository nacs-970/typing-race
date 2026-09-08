---
phase: 06-deploy-hardening
fixed_at: 2026-09-09T00:00:00Z
review_path: .planning/phases/06-deploy-hardening/06-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 6: Code Review Fix Report

**Fixed at:** 2026-09-09T00:00:00Z
**Source review:** .planning/phases/06-deploy-hardening/06-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope (critical + warning): 4
- Fixed: 4
- Skipped: 0

**Verification environment:** Fixes were authored and Tier-1-verified inside an isolated git worktree (no `node_modules`, so no build tooling available there). After the worktree's commits were fast-forwarded onto `master` and the worktree was torn down, Tier 2/3 verification (`bun test`, `bunx tsc --noEmit`) ran in the **main checkout** at `/home/nacs/Documents/git/typing-race`. All reported test/type-check results below are reproducible from that tree as it now stands on `master`.

## Fixed Issues

### CR-01: Lost "drained" event races the gateway's own drain() subscription in split/Redis mode

**Files modified:** `apps/gateway/src/ws/client-manager.ts`, `apps/gateway/src/ws/handlers.ts`, `apps/gateway/src/index.ts`, `apps/gateway/src/__tests__/drain.test.ts`
**Commit:** `9f056b0`
**Applied fix:** Added `setDrained()`/`isDrained()` to `ClientManager` (reset in `clear()`). `bindBridgeToGateway`'s `"drained"` case (registered at gateway startup, so it can't miss an early event) now latches `manager.setDrained(true)` instead of being a no-op. `GatewayInstance.drain()`'s split/Redis branch checks `manager.isDrained()` before subscribing to the bridge, skipping the wait entirely if the engine already reported drained. Added a regression test (`CR-01: drain() resolves promptly if "drained" arrives before drain() is called`) that publishes `"drained"` before calling `drain(5000)` and asserts it resolves in well under 200ms rather than blocking for the full timeout.

### WR-01: Duplicate SERVER_SHUTTING_DOWN broadcast in unified mode

**Files modified:** `apps/gateway/src/index.ts`, `apps/gateway/src/__tests__/drain.test.ts`
**Commits:** `7c05531` (fix), `b037b67` (test tightening)
**Applied fix:** Moved the direct `manager.broadcastAll(...)` call out of the shared path and into the split/Redis (non-`engineWorker`) branch only. In unified mode, the single broadcast now happens exclusively via the `"draining"` event round-tripping through `bindBridgeToGateway`, eliminating the double-send. Tightened the existing "GatewayInstance.drain() in unified mode" test from `toHaveBeenCalled()` to `toHaveBeenCalledTimes(1)` so a regression fails CI.

### WR-02: Both drain() implementations leak timers after they resolve

**Files modified:** `apps/engine/src/engine.ts`, `apps/gateway/src/index.ts`
**Commit:** `7de3e21`
**Applied fix:** In `EngineWorker.drain()`, captured the hard-cap timer handle (`hardTimer`) and always `clearTimeout` it in the `.then()` regardless of which race branch won; added a `stopped` flag checked both on entry to `check()` and immediately after the `await this.store.list()` gap, preventing a poll iteration that was mid-flight when the hard timeout fired from rescheduling an untracked new timer. Applied the same "capture and clear" treatment to `GatewayInstance.drain()`'s `timeoutPromise` in the split/Redis branch.

### WR-03: Shutdown handlers not guarded against re-entrant SIGINT/SIGTERM

**Files modified:** `apps/engine/src/index.ts`, `apps/gateway/src/index.ts`
**Commit:** `898ad21`
**Applied fix:** Added a `shuttingDown` boolean guard to both entrypoints' shutdown handlers (`shutdown` in engine, `onShutdown` in gateway) so a second `SIGINT`/`SIGTERM` arriving mid-drain is a no-op instead of re-invoking the handler concurrently (which could otherwise call `bridge.close()` a second time and produce an unhandled promise rejection on an already-quitting Redis client).

**Note on verification depth:** WR-03 touches entrypoint code that only runs under `import.meta.main` / module-scope execution and is not exported or exercised by the existing test suites. Verification for this fix is Tier 1 (re-read, diff review) + Tier 2 (`tsc --noEmit` passes) only — there is no automated regression test covering the re-entrancy guard itself. This is a straightforward idempotency guard (not a conditional/algorithmic logic change), so it is recorded as `fixed` rather than `fixed: requires human verification`; a human should still sanity-check it against real process-signal behavior before relying on it in production.

## Verification Results

```
bun test apps/engine/src/__tests__/drain.test.ts apps/gateway/src/__tests__/drain.test.ts

 9 pass
 0 fail
 18 expect() calls
Ran 9 tests across 2 files. [708.00ms]
```

```
bunx tsc --noEmit -p apps/engine/tsconfig.json   # no output, no errors
bunx tsc --noEmit -p apps/gateway/tsconfig.json  # no output, no errors
```

All 5 pre-existing engine drain tests and all 4 gateway drain tests (2 pre-existing + 1 tightened + 1 new CR-01 regression test) pass. No hanging timers observed (suite completed in 708ms, consistent with WR-02's cleanup taking effect).

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-09-09T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
