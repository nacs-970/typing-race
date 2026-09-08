---
phase: 06-deploy-hardening
plan: 02
status: complete
commit: 9c4087f
completed: 2026-09-08T09:30:00.000Z
---

# 06-02: Pin .bun-version and Add Drift-Guard Test — Summary

## What shipped

- Created `.bun-version` at repo root with `1.3.2\n` (D-04).
- Added `packages/shared/src/__tests__/bun-version-pin.test.ts` drift guard test:
  - Resolves repo root from `import.meta.dir` walking up 4 levels (`../../../..`).
  - Asserts `.bun-version` trimmed content is `1.3.2`.
  - Asserts each Dockerfile (`Dockerfile`, `apps/web/Dockerfile`, `apps/gateway/Dockerfile`, `apps/engine/Dockerfile`) contains `ARG BUN_VERSION=1.3.2` via regex.
  - Asserts `package.json` retains `engines.bun` as `>=1.3.2 <1.5.0` and `packageManager` as `bun@1.3.2` via `JSON.parse`.
- Committed in commit `9c4087f` containing only `.bun-version` and `packages/shared/src/__tests__/bun-version-pin.test.ts`.

## Verification

- `bun test packages/shared/src/__tests__/bun-version-pin.test.ts`: 6 pass, 0 fail.
- `bun run --filter "*" typecheck`: all 4 workspaces passed with 0 errors.
