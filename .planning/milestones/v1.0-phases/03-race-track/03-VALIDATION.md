---
phase: 3
slug: race-track
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-30
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (server)** | `bun:test` (built-in, Phase 2 pattern) |
| **Framework (web)** | `vitest` + `@testing-library/react` + `happy-dom` (already installed) |
| **Config file** | `apps/web/vitest.config.ts` — none yet, Phase 2 didn't add component tests |
| **Quick run** | `bun test apps/server` |
| **Full suite** | `bun run --filter '*' test` |
| **Estimated runtime** | ~30 seconds |

## Sampling Rate

- **After every task commit:** `bun test apps/server apps/web/src/__tests__` (server scoring + char-states + race-end)
- **After every plan wave:** `bun run --filter '*' typecheck && bun run --filter '*' test && bun --filter '@typing-race/web' run build`
- **Before `/gsd-verify-work`:** Full suite green; production build succeeds
- **Max feedback latency:** 10 seconds

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | REQ-10 | T-01 / — | N/A | unit | `bun test packages/shared/src/__tests__/passages.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | REQ-10, D-04 | T-02 / — | N/A | unit | `bun test apps/server/src/__tests__/corpus.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | REQ-05 | T-03 / — | N/A | unit | `bun test apps/server/src/__tests__/char-states.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | REQ-05 | T-04 / — | N/A | unit | `bun test apps/server/src/__tests__/validate-keystroke.test.ts` (extend) | partial (8) | ⬜ pending |
| 03-02-03 | 02 | 1 | REQ-05, D-13 | T-05 / — | N/A | unit | `bun test apps/server/src/__tests__/char-states.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | D-05 | T-06 / — | N/A | unit | `bun test apps/server/src/__tests__/scoring.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03 | 2 | D-06 | T-07 / — | N/A | unit | same file | ❌ W0 | ⬜ pending |
| 03-04-01 | 04 | 2 | REQ-08, D-08 | T-08 / — | N/A | unit | `bun test apps/server/src/__tests__/race-end.test.ts` | ❌ W0 | ⬜ pending |
| 03-04-02 | 04 | 2 | D-08/14/15 | T-09 / — | N/A | unit | extend race-controller.test.ts | partial (6) | ⬜ pending |
| 03-04-03 | 04 | 2 | D-10 | T-10 / — | N/A | unit | same race-end.test.ts | ❌ W0 | ⬜ pending |
| 03-04-04 | 04 | 2 | REQ-08 | T-11 / — | N/A | unit + smoke | `bun --filter '@typing-race/web' test` + live e2e | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

## Wave 0 Requirements

- [ ] `apps/server/src/__tests__/char-states.test.ts` — REQ-05 + D-13
- [ ] `apps/server/src/__tests__/scoring.test.ts` — D-05/D-06 fixtures (incl. 30-chars/30s = 12 WPM)
- [ ] `apps/server/src/__tests__/corpus.test.ts` — D-04 no-repeat + D-03 corpus size
- [ ] `apps/server/src/__tests__/race-end.test.ts` — D-08/14/15 + race_end schema
- [ ] `packages/shared/src/__tests__/passages.test.ts` — REQ-10 corpus shape
- [ ] Extend `apps/server/src/__tests__/validate-keystroke.test.ts` with char-state side-effects
- [ ] Extend `apps/server/src/__tests__/race-controller.test.ts` with 'grace' state transitions
- [ ] `apps/web/src/__tests__/RaceView.test.tsx` — char-state accent classes

## Nyquist Experiments (E1–E6)

| Exp | What it verifies | Acceptance |
|-----|------------------|------------|
| **E1** Char-state transitions | type 10 correct → all 'correct'; type 11 wrong → 'error'; backspace → unchanged; retype correct → 'correct' | REQ-05 verified end-to-end |
| **E2** WPM spec fixture | known input → known output. 30 correct chars / 30s = 12 WPM (per D-05 formula). Document the 12-vs-2 ROADMAP-vs-fixture discrepancy. | D-05 verified |
| **E3** Race-end grace flow | 2-player race: A finishes → grace_countdown to B with `remainingMs ≈ graceSeconds*1000`. B keeps typing. Grace expires → race_end broadcast. | D-08/14/15 verified |
| **E4** Host-pick passage schema | `start_race { passageId }` validates; non-host `joined_room` carries `hostPickedPassagePreview` (first 30 chars), NOT full text | D-01/02/04 + Pitfall 4 verified |
| **E5** No-repeat deck | 5 sequential races; no `passageId` repeats; deck reshuffle when exhausted; reshuffled deck ≠ previous | D-04 verified |
| **E6** Results board ranked | race_end with `results` in arbitrary order → client sorts by finishTimeMs asc, WPM desc | D-10 verified |

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Two-laptop demo: host picks passage, both see countdown, both type, grace banner appears for loser, results board shows ranked stats | REQ-08 | Visual verification of race-end UX, banner timing, results layout | Open two browsers to same room, play through full race |
| Live host-pick UX: lobby passage list renders with preview, Random button picks different passage, picker closes after start_race | D-02 | UI/UX correctness | Host browser: see passage list, click one, verify preview; click Random, verify change |

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending