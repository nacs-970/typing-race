---
phase: 06-deploy-hardening
fixed_at: 2026-09-09T05:31:48Z
review_path: .planning/phases/06-deploy-hardening/06-REVIEW.md
iteration: 2
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 6: Code Review Fix Report (Iteration 2)

**Fixed at:** 2026-09-09T05:31:48Z
**Source review:** .planning/phases/06-deploy-hardening/06-REVIEW.md (Re-Review)
**Iteration:** 2

**Summary:**
- Findings in scope (critical + warning): 2
- Fixed: 2
- Skipped: 0

Iteration 2 addresses the two findings the iteration-1 re-review surfaced in the
iteration-1 fixes themselves (CR-01, WR-01). IN-01 (info, test hygiene) is out of
blocking scope and left open — same convention iteration 1 used for info-level findings.

## Fixed Issues

### CR-B1: `manager.isDrained()` latch never reset between drain cycles

**Files modified:** `apps/gateway/src/index.ts`
**Commit:** `79b54f2`
**Applied fix:** The review's suggested fix was a timestamp/freshness-scoped latch
(`isDrainedSince`). The simpler fix actually applied: `onShutdown` now calls
`instance.clientManager.setDrained(false)` synchronously, before `instance.drain(90_000)`
runs, clearing any stale latch left by an unrelated prior engine restart. Since there is
no `await` between that reset and `drain()`'s own `isDrained()` check, only a `"drained"`
event genuinely belonging to *this* shutdown cycle (published by the engine's own
concurrent SIGTERM handling) can re-set the latch before it's read. Verified by reading
`apps/gateway/src/index.ts:196-208` and the new regression test `CR-B1: a stale "drained"
latch from a PRIOR unrelated engine restart does not poison the next real drain()` in
`apps/gateway/src/__tests__/drain.test.ts`.

### WR-A1: `SERVER_SHUTTING_DOWN` still broadcast twice in split/Redis mode

**Files modified:** `apps/gateway/src/ws/client-manager.ts`, `apps/gateway/src/ws/handlers.ts`, `apps/gateway/src/index.ts`
**Commit:** `79b54f2`
**Applied fix:** Added `ClientManager.announceShuttingDownOnce()` (cycle-scoped boolean,
reset in `clear()`), matching the review's request for a shared idempotency gate rather
than two independent `broadcastAll()` calls. Both call sites — `bindBridgeToGateway`'s
`"draining"` case (`handlers.ts:92-96`) and `drain()`'s split/Redis branch
(`index.ts:139-144`) — now go through `announceShuttingDownOnce()`, so whichever fires
first wins and the client gets exactly one `SERVER_SHUTTING_DOWN` frame regardless of
event ordering. Verified by reading both call sites and the new regression test `WR-01
(split mode): engine-initiated "draining" + gateway's own drain() send exactly one
SERVER_SHUTTING_DOWN` in `apps/gateway/src/__tests__/drain.test.ts`.

## Verification Results

```
bun test apps/engine/src/__tests__/drain.test.ts apps/gateway/src/__tests__/drain.test.ts

 12 pass
 0 fail
 26 expect() calls
Ran 12 tests across 2 files. [799.00ms]
```

```
bunx tsc --noEmit -p apps/engine/tsconfig.json   # no output, no errors
bunx tsc --noEmit -p apps/gateway/tsconfig.json  # no output, no errors
```

Full monorepo suite (correct per-package runners — `bun run test`, which routes
`apps/web` through `vitest run` rather than bare `bun test`):

```
packages/shared + apps/gateway + apps/engine: 148 pass, 0 fail (23 files)
apps/web (vitest run): 12 files passed, 78 tests passed
```

## Skipped Issues

- **IN-01** (info, test hygiene — `drain.test.ts` describe-scope `manager` shadowing):
  not in scope for this iteration (info-level, non-blocking, matches the review's own
  classification). Left open for a future pass.

---

_Fixed: 2026-09-09T05:31:48Z_
_Fixer: Claude (manual verification of a directly-applied fix commit, not the automated gsd-code-fixer agent)_
_Iteration: 2_
