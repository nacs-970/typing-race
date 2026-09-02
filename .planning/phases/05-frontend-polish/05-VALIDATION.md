---
phase: 05
slug: frontend-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-03
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun test (server/shared) + Vitest 3.x (web) |
| **Config file** | `apps/web/vite.config.ts` |
| **Quick run command** | `bun test && bun run --cwd apps/web test` |
| **Full suite command** | `bun test && bun run --cwd apps/web test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test && bun run --cwd apps/web test`
- **After every plan wave:** Run `bun test && bun run --cwd apps/web test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | REQ-06 | — | Pure modular core engines | unit | `bun run --cwd apps/web test apps/web/src/__tests__/typing-engine.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | REQ-06 | — | Ring buffer & interpolation math | unit | `bun run --cwd apps/web test apps/web/src/__tests__/cursor-manager.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 2 | REQ-06 | — | Pretext layout & coordinate lookup | unit | `bun run --cwd apps/web test apps/web/src/__tests__/layout.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 2 | REQ-06 | — | Translate3d cursor layer (0 React commits) | manual / perf | Profiler inspection | — | ⬜ pending |
| 05-03-01 | 03 | 3 | REQ-06 | — | Per-player ready toggle & server-synced countdown | unit | `bun run --cwd apps/web test apps/web/src/__tests__/LobbyView.test.tsx` | ❌ W0 | ⬜ pending |
| 05-04-01 | 04 | 4 | REQ-06 | — | Results delta & toast queue | unit | `bun run --cwd apps/web test apps/web/src/__tests__/ResultsBoard.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/src/__tests__/cursor-manager.test.ts` — stubs for REQ-06 interpolation
- [ ] `apps/web/src/__tests__/layout.test.ts` — Pretext layout test with canvas 2D mock

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Two-laptop side-by-side cursor smoothness | REQ-06 | Multi-client visual 60fps render | Open two browser windows, join room, complete race, check 60fps smoothness and leader glow |
| React DevTools 0 commits profile | REQ-06 | Profiler runtime trace | Record DevTools Profiler during active race; verify 0 per-frame renders in `RaceView` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
