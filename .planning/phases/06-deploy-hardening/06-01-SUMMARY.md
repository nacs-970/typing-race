---
phase: 06-deploy-hardening
plan: 01
status: complete
commit: da0f5c5
completed: 2026-09-08T09:08:00.000Z
---

# 06-01: Graceful SIGTERM Shutdown — Summary

## What shipped

Implemented graceful drain on SIGTERM per D-01/D-02/D-03 in `06-CONTEXT.md`:

- Engine is the drain source of truth. `EngineWorker.drain(timeoutMs = 90_000)` sets
  `draining = true`, publishes a `draining` event over the EventBridge, polls active
  room state, and resolves either when zero rooms are active or after the 90s hard cap.
- `drain()` is idempotent — a second call (e.g. SIGTERM then SIGINT) returns the same
  in-flight `drainPromise` instead of starting a second timer.
- Gateway subscribes to the `draining`/`drained` bridge events, flips `ClientManager`
  into reject-new-rooms mode, and broadcasts `SERVER_SHUTTING_DOWN` to all connected
  clients immediately. `create_room` / `join_room` / `start_race` are rejected during
  drain; `keystroke` / `cursor_position` / `correction` / `rejoin_room` are unaffected.
  A room already in countdown/racing/grace keeps running to completion.
- Both `apps/engine/src/index.ts` and `apps/gateway/src/index.ts` SIGTERM handlers call
  `.drain(90_000)` before `.stop()` / `process.exit(0)`.
- New tests: `apps/engine/src/__tests__/drain.test.ts` (131 lines),
  `apps/gateway/src/__tests__/drain.test.ts` (98 lines).

Files: `packages/shared/src/bridge.ts`, `packages/shared/src/messages.ts`,
`apps/engine/src/engine.ts`, `apps/engine/src/index.ts`,
`apps/gateway/src/ws/client-manager.ts`, `apps/gateway/src/ws/handlers.ts`,
`apps/gateway/src/ws/dispatch.ts`, `apps/gateway/src/index.ts`,
`apps/engine/src/__tests__/drain.test.ts`, `apps/gateway/src/__tests__/drain.test.ts`.

## How it was built

Delegated to agy (Gemini 3.1 Pro) in two passes on branch `phase-06-deploy-hardening`:
first pass wrote the implementation but timed out before testing/committing; second,
narrower pass (scoped to this plan only) ran `bun test`, fixed two type errors and one
must_haves gap (drain wasn't idempotent — fixed with the `drainPromise` cache), then
committed.

## Verification

Independently re-run by Claude after agy reported done (per antigravity verification
gates — never trust a self-reported pass):

- `bun test apps/engine apps/gateway`: 101 pass, 0 fail, 795 expect() calls.
- `tsc --noEmit` on both `apps/engine` and `apps/gateway`: no errors.
- Confirmed `90_000` (not shortened) in both `apps/engine/src/index.ts:33` and
  `apps/gateway/src/index.ts:176` (D-02 prohibition).
- Confirmed `drainPromise` idempotency guard present in both `EngineWorker.drain()`
  (`apps/engine/src/engine.ts:39-40`) and the gateway's `drain()` closure
  (`apps/gateway/src/index.ts:125-126`).
- `git show --stat da0f5c5`: exactly the 10 `files_modified` files, no scope creep.

## Deviations from plan

None — the drain idempotency fix was already required by 06-01-PLAN.md's must_haves
("Calling drain() twice ... does not start a second independent drain timer"); agy's
first pass had missed it, second pass caught and fixed it before commit.

## Next

06-02 (`.bun-version` + Dockerfile pinning, wave 1, no deps — can run independently),
then 06-04 (depends on 06-01, now satisfied), then 06-03 last (depends on 06-01/02/04).
