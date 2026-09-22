---
phase: 05
slug: frontend-polish
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-03
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun test (server/shared) + Vitest 4.x (web) |
| **Config file** | `apps/web/vite.config.ts` |
| **Quick run command** | `bun test packages/shared apps/server && bun run --cwd apps/web test` |
| **Full suite command** | `bun test packages/shared apps/server && bun run --cwd apps/web test` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test packages/shared apps/server && bun run --cwd apps/web test`
- **After every plan wave:** Run `bun test packages/shared apps/server && bun run --cwd apps/web test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | REQ-06 | ASVS-1 | Keystroke matching & scoring formulas | unit | `bun run --cwd apps/web test apps/web/src/__tests__/typing-engine.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | REQ-06 | ASVS-1 | Ring buffer, lerp math & rewind snap | unit | `bun run --cwd apps/web test apps/web/src/__tests__/cursor-manager.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | REQ-06 | ASVS-1 | RaceClient singleton lifecycle & dispatch | unit | `bun run --cwd apps/web test apps/web/src/__tests__/race-client.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 2 | REQ-06 | ASVS-1 | Tailwind v4 botanical palette integration | build | `bun run --cwd apps/web build` | ✅ | ⬜ pending |
| 05-02-02 | 02 | 2 | REQ-06 | ASVS-1 | Pretext multiline layout & coordinate lookup | unit | `bun run --cwd apps/web test apps/web/src/__tests__/layout.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-03 | 02 | 2 | REQ-06 | ASVS-1 | Translate3d cursor overlay (0 React commits) | unit/perf | `bun run --cwd apps/web test apps/web/src/__tests__/RaceView.test.tsx` | ✅ | ⬜ pending |
| 05-03-01 | 03 | 3 | REQ-06 | ASVS-1 | set_ready wire frame & server dispatch | unit | `bun test packages/shared/src/__tests__/messages.test.ts apps/server/src/__tests__/rooms.test.ts` | ✅ | ⬜ pending |
| 05-03-02 | 03 | 3 | REQ-06 | ASVS-1 | Passage filters & lobby readiness UI | unit | `bun run --cwd apps/web test apps/web/src/__tests__/LobbyView.test.tsx` | ❌ W0 | ⬜ pending |
| 05-03-03 | 03 | 3 | REQ-06 | ASVS-1 | Server-synced 3-2-1 GO countdown overlay | unit | `bun run --cwd apps/web test apps/web/src/__tests__/CountdownView.test.tsx` | ❌ W0 | ⬜ pending |
| 05-04-01 | 04 | 3 | REQ-06 | ASVS-1 | Live Race HUD, Net WPM integer & tooltip | unit | `bun run --cwd apps/web test apps/web/src/__tests__/RaceHud.test.tsx` | ❌ W0 | ⬜ pending |
| 05-04-02 | 04 | 3 | REQ-06 | ASVS-1 | Stacked toast notifications & error copy | unit | `bun run --cwd apps/web test apps/web/src/__tests__/ToastQueue.test.tsx` | ❌ W0 | ⬜ pending |
| 05-04-03 | 04 | 3 | REQ-06 | ASVS-1 | Results board podium medals & time deltas | unit | `bun run --cwd apps/web test apps/web/src/__tests__/ResultsBoard.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/src/__tests__/typing-engine.test.ts` — unit test for TypingEngine
- [ ] `apps/web/src/__tests__/cursor-manager.test.ts` — stubs for REQ-06 interpolation
- [ ] `apps/web/src/__tests__/race-client.test.ts` — unit test for RaceClient
- [ ] `apps/web/src/__tests__/layout.test.ts` — Pretext layout test with canvas 2D mock
- [ ] `apps/web/src/__tests__/LobbyView.test.tsx` — lobby readiness & filter test
- [ ] `apps/web/src/__tests__/CountdownView.test.tsx` — countdown timing test
- [ ] `apps/web/src/__tests__/RaceHud.test.tsx` — HUD stats & tooltip test
- [ ] `apps/web/src/__tests__/ToastQueue.test.tsx` — toast queue test
- [ ] `apps/web/src/__tests__/ResultsBoard.test.tsx` — results table & delta test

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Two-laptop side-by-side cursor smoothness | REQ-06 | Multi-client visual 60fps render | Open two browser windows, join room, complete race, check 60fps smoothness and leader glow |
| React DevTools 0 commits profile | REQ-06 | Profiler runtime trace | Record DevTools Profiler during active race; verify 0 per-frame renders in `RaceView` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-09-03
