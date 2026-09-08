---
phase: 06-deploy-hardening
plan: 04
status: complete
commit: TBD
completed: 2026-09-08T09:35:00.000Z
---

# 06-04: Client-side SERVER_SHUTTING_DOWN Toast — Summary

## What shipped

Added a `SERVER_SHUTTING_DOWN` branch to `apps/web/src/App.tsx`'s error-handling
if/else chain (keyed on `msg.code`), producing a distinct "Server Restarting" toast
instead of falling through to the generic `title = "Error"` fallback.

## How it was built

Done directly (not delegated) — single-file, single-branch change, well below the
delegation break-even.

## Verification

- `grep -c "SERVER_SHUTTING_DOWN" apps/web/src/App.tsx`: 1.
- `bun run --filter '@typing-race/web' typecheck`: exit 0.
- `bun run --filter '@typing-race/web' test`: 77/77 pass.

## Next

06-03 (anti-cheat regression tests + README/smoke-test) — depends on 06-01, 06-02,
06-04, all now satisfied.
