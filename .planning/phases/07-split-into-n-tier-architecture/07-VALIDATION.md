---
phase: "07"
slug: "split-into-n-tier-architecture"
status: draft
nyquist_compliant: true
wave_0_complete: false
created: "2026-09-04"
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bun test (backend / engine / shared), vitest 4.x (web) |
| **Config file** | `tsconfig.base.json`, `apps/web/vite.config.ts` |
| **Quick run command** | `bun test packages/shared && bun run --filter '@typing-race/gateway' test && bun run --filter '@typing-race/engine' test` |
| **Full suite command** | `bun run typecheck && bun test packages/shared apps/gateway apps/engine && bun run --cwd apps/web test && bun run --cwd apps/web build` |
| **Estimated runtime** | ~6 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test packages/shared apps/engine apps/gateway`
- **After every plan wave:** Run Full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | D-01, D-06 | T-07-01 | Event bridge isolates socket types from engine logic | unit | `bun test packages/shared` | ✅ | ⬜ pending |
| 07-01-02 | 01 | 1 | D-02, D-08 | T-07-02 | Ephemeral room store handles 60s grace timeout | unit | `bun test apps/engine` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 2 | D-01, D-08 | T-07-03 | Gateway forwards valid frames, rejects invalid | integration | `bun test apps/gateway` | ❌ W0 | ⬜ pending |
| 07-02-02 | 02 | 2 | D-04, D-05 | — | Local dev boots in unified and split modes | integration | `bun run typecheck` | ✅ | ⬜ pending |
| 07-03-01 | 03 | 3 | D-07 | — | Docker compose config parses cleanly | config | `docker compose config` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/shared/src/bridge.ts` — EventBridge contract and event schemas
- [ ] `apps/engine/package.json` & `apps/gateway/package.json` — workspace package stubs
- [ ] `docker-compose.yml` — root container orchestration descriptor

---

## Manual-Only Verifications

| Action | Expected Behavior | Verification Steps |
|--------|-------------------|--------------------|
| Run `bun run dev` | Boots web (:5173), gateway (:8080), engine (:8081) concurrently | Open `http://localhost:5173`, verify lobby and countdown |
| Disconnect player | 60s disconnect grace triggered in engine; reconnect restores state | Close tab during race, reopen within 60s with same session |
