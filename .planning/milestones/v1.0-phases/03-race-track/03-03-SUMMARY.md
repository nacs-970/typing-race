---
phase: 03-race-track
plan: 03
subsystem: scoring
tags: [wpm, accuracy, d05, d06, zod]
status: completed
completed_at: 2026-08-31

# Dependency graph
requires:
  - phase: 02-race-engine
    provides: "validateKeystroke + Player.charStates/totalKeystrokes/uncorrectedErrors"
  - phase: 03-race-track/02
    provides: "charStates snapshot + player.currentWpm placeholder (= 0) + cursor_update wire"
provides:
  - "computeNetWpm({ correctChars, uncorrectedErrors, elapsedMs }) — D-05 verbatim, defensive against elapsedMs <= 0"
  - "computeAccuracy({ correctChars, totalKeystrokes }) — D-06 verbatim, defensive against totalKeystrokes === 0"
  - "validateKeystroke stamps real computeNetWpm value into player.currentWpm on every accept (Plan 02 placeholder retired)"
  - "playerPatch.currentWpm === player.currentWpm (consistency invariant)"
  - "60 server + 24 shared + 4 web = 88 tests pass / 0 fail; typecheck clean; web build green"
affects:
  - 04 (race-end results will use computeAccuracy for per-player final stats; raceEnd.results[].accuracy)

actuals:
  tokens: 6800
  tasks: 3
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Pure functions: computeNetWpm + computeAccuracy have no Date.now / no I/O; deterministic and unit-testable"
    - "Defensive arithmetic: minutes <= 0 → 0 (no NaN/Infinity); totalKeystrokes === 0 → 0 (no divide-by-zero)"
    - "ROADMAP-vs-D-05 discrepancy documented in source JSDoc + test comment (audit trail for the 12 WPM vs 2 WPM reconciliation in commit b17c739)"

key-files:
  created:
    - apps/server/src/__tests__/scoring.test.ts
  modified:
    - apps/server/src/race/scoring.ts
    - apps/server/src/race/validate-keystroke.ts
    - apps/server/src/__tests__/validate-keystroke.test.ts
    - apps/server/src/__tests__/char-states.test.ts

key-decisions:
  - "D-05 implemented verbatim (max(0, (correct/5 − uncorrected/5)) / minutesElapsed) — not the algebraic equivalent (correct - uncorrected)/5/minutes, which loses the intermediate clamp per RESEARCH.md Pitfall 2"
  - "elapsedMs uses server's `now` (never frame.clientTs — anti-cheat #1 invariant)"
  - "Test 16 (spec fixture via validator) uses PASSAGE='hello world' (11 chars) yielding 4.4 WPM. The canonical 30/30/12 fixture is tested at the scoring layer (Test 1) — both verify the same formula, just at different layers and with different passage lengths."

patterns-established:
  - "Formula source of truth: scoring.ts JSDoc cites D-05/D-06 verbatim + ROADMAP-vs-D-05 discrepancy; validator imports + computes; tests cover spec fixture + edge cases"
  - "Plan 02 placeholder retirement: when Plan 03 fills a placeholder, the dispatch wire field shape is unchanged; only the value changes from 0 to real. This kept the cursor_update schema stable across plans."

requirements-completed: [REQ-05]

coverage:
  - id: D1
    description: "computeNetWpm matches D-05 formula verbatim: max(0, (correctChars/5) - (uncorrectedErrors/5)) / minutesElapsed"
    verification:
      - kind: unit
        ref: apps/server/src/__tests__/scoring.test.ts (test 1, 6)
        status: pass
    human_judgment: false
  - id: D2
    description: "computeAccuracy matches D-06: correctChars / totalKeystrokes"
    verification:
      - kind: unit
        ref: apps/server/src/__tests__/scoring.test.ts (test 7, 10)
        status: pass
    human_judgment: false
  - id: D3
    description: "30 correct chars / 30s / 0 errors = 12 WPM per D-05 (discrepancy with ROADMAP 2 WPM documented)"
    verification:
      - kind: unit
        ref: apps/server/src/__tests__/scoring.test.ts (test 1)
        status: pass
    human_judgment: false
  - id: D4
    description: "Zero correct → 0 WPM; negative errors clamp to 0 (max(0, …) verified)"
    verification:
      - kind: unit
        ref: apps/server/src/__tests__/scoring.test.ts (test 2, 3)
        status: pass
    human_judgment: false
  - id: D5
    description: "elapsedMs <= 0 → 0 WPM (defensive, no NaN/Infinity)"
    verification:
      - kind: unit
        ref: apps/server/src/__tests__/scoring.test.ts (test 4, 5)
        status: pass
    human_judgment: false
  - id: D6
    description: "accuracy = 0 when totalKeystrokes === 0 (no divide-by-zero)"
    verification:
      - kind: unit
        ref: apps/server/src/__tests__/scoring.test.ts (test 8)
        status: pass
    human_judgment: false
  - id: D7
    description: "validateKeystroke calls computeNetWpm on every accept; player.currentWpm matches playerPatch.currentWpm"
    verification:
      - kind: unit
        ref: apps/server/src/__tests__/validate-keystroke.test.ts (test 15, 16, 17)
        status: pass
    human_judgment: false
  - id: D8
    description: "All 88 tests green; typecheck clean; web build green"
    verification:
      - kind: command
        ref: "bun run --filter '*' test (88 pass) + bun run --filter '*' typecheck (3/3 clean) + bun --filter '@typing-race/web' run build"
        status: pass
    human_judgment: false

duration: 18min
completed: 2026-08-31
---

# Phase 3 / Plan 03 — WPM + Accuracy Pure Functions

**D-05 net WPM (`max(0, (correct/5 − uncorrected/5)) / minutesElapsed`) + D-06 char accuracy (`correctChars / totalKeystrokes`) — pure functions, defensive against zero-division. Spec fixture (30 correct / 30s / 0 errors) = 12 WPM per D-05, with ROADMAP-vs-D-05 discrepancy documented in source. Wired into validateKeystroke (Plan 02 placeholder retired). 88 tests pass.**

## Performance

- **Duration:** 18 min
- **Tasks:** 3 (all complete)
- **Files modified:** 5 (1 created, 4 modified)
- **Tests:** 88 pass / 0 fail (24 shared + 60 server + 4 web)
- **Commits:** 1

## Accomplishments

- **computeNetWpm** — D-05 verbatim, with defensive `minutes <= 0 → 0` guard (no NaN/Infinity).
- **computeAccuracy** — D-06 verbatim, with defensive `totalKeystrokes === 0 → 0` guard (no divide-by-zero).
- **JSDoc audit trail** — ROADMAP criterion 2 vs D-05 discrepancy documented in `scoring.ts` (the 12 WPM vs 2 WPM reconciliation in commit b17c739).
- **validateKeystroke wires real D-05** — Plan 02 placeholder `player.currentWpm = 0` replaced with `computeNetWpm({ correctChars, uncorrectedErrors, elapsedMs: now - room.startsAtServerMs })`. `elapsedMs` uses server's `now` (anti-cheat #1 invariant).
- **10 new scoring tests** — spec fixture (12 WPM) + zero-correct + clamped + zero/negative elapsed + mid-race realistic + 4 accuracy tests.
- **3 new validator tests** — live WPM update on single accept, spec fixture via validator, playerPatch consistency invariant.
- **Test 7 (Plan 02 end-to-end)** updated — `wpm` assertion `=== 0` → `>= 0` (placeholder retired, real value).

## Task Commits

1. **Task 1+2+3 (combined):** `da8d5ba feat(scoring): net WPM (D-05) + char accuracy (D-06) pure functions`

## Files Created/Modified

- `apps/server/src/race/scoring.ts` — `computeNetWpm` + `computeAccuracy` + extended JSDoc with ROADMAP-vs-D-05 audit
- `apps/server/src/race/validate-keystroke.ts` — imports `computeNetWpm`; replaces placeholder; stamps real WPM
- `apps/server/src/__tests__/scoring.test.ts` (NEW) — 10 tests (6 WPM + 4 accuracy)
- `apps/server/src/__tests__/validate-keystroke.test.ts` — 3 new tests (15, 16, 17)
- `apps/server/src/__tests__/char-states.test.ts` — Test 7 wpm assertion relaxed

## Decisions Made

- **D-05 implemented verbatim, not algebraically simplified** — the `max(0, (a/5 − b/5) / m)` form keeps the intermediate clamp on the raw value. The equivalent `(a − b) / 5 / m` form can produce slightly different numbers near zero crossings per RESEARCH.md Pitfall 2.
- **`elapsedMs` is server `now` − `room.startsAtServerMs`**, never `frame.clientTs` — preserves anti-cheat #1 invariant. Frame.clientTs is read in the validator only for `lastKeystrokeAt` tracking.
- **Test 16 uses 11-char PASSAGE, not 30-char** — the canonical 30/30/12 fixture is tested at the scoring layer (Test 1) with a synthetic 30-char setup. The validator layer tests the formula end-to-end with the actual 11-char test passage yielding 4.4 WPM. Both layers verify the same formula.

## Deviations from Plan

### Auto-fixed Issues

**1. [Test] Plan 02 Test 7 broke when wpm became non-zero**
- **Found during:** First full test run after Plan 03 wired D-05
- **Issue:** Plan 02 Test 7 asserted `frame.wpm === 0` (placeholder value). After Plan 03, real D-05 value flows, so the assertion fails.
- **Fix:** Updated assertion to `typeof frame.wpm === "number" && frame.wpm >= 0` — still verifies the field is present and non-negative, doesn't pin to a specific (now-meaningless) value.
- **Committed in:** `da8d5ba`

---

**Total deviations:** 1 auto-fixed (test fixture update)
**Impact on plan:** No functional change; test still verifies the wire payload end-to-end.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration.

## Next Phase Readiness

Plan 04 (race-end grace + results + rematch) can now proceed:
- `computeAccuracy(correctChars, totalKeystrokes)` available for `raceEnd.results[].accuracy` per-player final stats
- `player.finishedAtServerMs` already populated by validateKeystroke on first-time passage completion (Plan 02)
- `player.currentWpm` populated with real D-05 value (Plan 03)
- `Room` already has `graceSeconds` (Plan 01)
- `RaceState` union needs `'grace'` added + tick() needs grace state transitions (Plan 04's Task 1)
- `grace_countdown` S→C frame (D-15) + `race_end.results[]` extension (D-10) — both new wire frames

---
*Phase: 03-race-track*
*Completed: 2026-08-31*