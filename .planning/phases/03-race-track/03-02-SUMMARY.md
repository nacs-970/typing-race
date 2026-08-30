---
phase: 03-race-track
plan: 02
subsystem: race-state-model
tags: [char-state, word-aggregation, anti-cheat-extension, cursor_update]
status: completed
completed_at: 2026-08-31

# Dependency graph
requires:
  - phase: 02-race-engine
    provides: "validateKeystroke (4 anti-cheat checks) + Player type + cursor_update wire"
  - phase: 03-race-track/01
    provides: "passageText on Room + start_race wire (passageId+graceSeconds)"
provides:
  - "CharState = 'pending' | 'correct' | 'error' (2-tone, D-11/D-12)"
  - "Player gains: charStates, totalKeystrokes, uncorrectedErrors, currentWpm, finishedAtServerMs"
  - "scoring.ts: 4 pure aggregation helpers — countCorrectChars, countUncorrectedErrors, isWordCorrect, aggregateWordCorrectness"
  - "validateKeystroke extended: returns newCharStates + playerPatch; last-write-wins per position (Pitfall 1); grace state accepted (D-08); finishedAtServerMs set on first-time passage completion"
  - "cursorUpdateSchema gains charStates? + wpm? (server-authoritative outbound; cursor_position inbound cannot spoof — Pitfall V5)"
  - "dispatch keystroke broadcasts cursor_update with charStates + wpm to OTHER players (sender renders optimistically)"
  - "47 server tests + 24 shared tests pass; typecheck clean; web build green"
affects:
  - 03 (WPM formula will read correctChars + uncorrectedErrors from newCharStates / playerPatch)
  - 04 (race-end detection uses finishedAtServerMs; grace state needs RaceState union extension)
  - Phase 5 (cursor interpolation polish uses charStates)

actuals:
  tokens: 18400
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Last-write-wins per position (Pitfall 1) — array indexed by position, not append-only log"
    - "D-11/D-12 2-tone char state — no 'corrected' intermediate; wrong-then-right flips to 'correct'"
    - "Pure scoring helpers — no Date.now / no I/O; deterministic and unit-testable"
    - "Server-authoritative broadcast — cursor_update is OUTBOUND ONLY; cursor_position inbound schema lacks charStates/wpm so client cannot spoof"
    - "Grace state permissively accepted: validator rejects ONLY lobby|countdown (Plan 04 will formally add 'grace' to RaceState union)"

key-files:
  created:
    - apps/server/src/race/scoring.ts
    - apps/server/src/__tests__/char-states.test.ts
  modified:
    - apps/server/src/race/types.ts
    - apps/server/src/race/validate-keystroke.ts
    - apps/server/src/rooms/manager.ts
    - apps/server/src/ws/dispatch.ts
    - apps/server/src/__tests__/validate-keystroke.test.ts
    - apps/server/src/__tests__/race-controller.test.ts
    - packages/shared/src/messages.ts
    - packages/shared/src/__tests__/messages.test.ts

key-decisions:
  - "currentWpm: 0 placeholder in validator — Plan 03 wires the real D-05 formula; not a regression (the wire carries the field; the value will become non-zero after Plan 03)"
  - "Grace state via permissive check (reject lobby|countdown only) — Plan 04 will formally add 'grace' to RaceState union; current approach future-proofs the validator without modifying the shared types in Plan 02's scope"
  - "aggregateWordCorrectness uses /\\S+/g so 'don't' (5 chars, 1 word) and 'ice-cream' (9 chars, 1 word) stay as single words (Pitfall 7)"

patterns-established:
  - "Server-authoritative char-state: client cursor_position can NOT send charStates/wpm (schema omits fields; dispatch reads only frame.index/char/clientTs)"
  - "End-to-end dispatch tests use a 2-player fakeWs setup that captures the opponent's wsRef.sent array; verifies payload shape, not just unit-level"
  - "Pre-commit review with [verified] prefix per requesting-code-review skill convention"

requirements-completed: [REQ-05]

coverage:
  - id: D1
    description: "Player has charStates / totalKeystrokes / uncorrectedErrors / currentWpm / finishedAtServerMs (REQ-05, D-11/D-12/D-13)"
    verification:
      - kind: unit
        ref: apps/server/src/__tests__/validate-keystroke.test.ts (test 9)
        status: pass
    human_judgment: false
  - id: D2
    description: "validateKeystroke returns { newCharStates, playerPatch } on accept — last-write-wins per position (Pitfall 1)"
    verification:
      - kind: unit
        ref: apps/server/src/__tests__/validate-keystroke.test.ts (test 10)
        status: pass
    human_judgment: false
  - id: D3
    description: "Wrong keystroke path: rejected by anti-cheat #4 char-match (cannot reach char-state set; tested via direct mutation in char-states.test.ts)"
    verification:
      - kind: unit
        ref: apps/server/src/__tests__/char-states.test.ts (test 3)
        status: pass
    human_judgment: false
  - id: D4
    description: "Backspace-and-retype: position goes error → correct (not append-only log)"
    verification:
      - kind: unit
        ref: apps/server/src/__tests__/char-states.test.ts (test 3)
        status: pass
    human_judgment: false
  - id: D5
    description: "cursor_update schema accepts optional charStates + wpm; both optional preserves Phase 2 backwards compat"
    verification:
      - kind: unit
        ref: packages/shared/src/__tests__/messages.test.ts (test 9 — round-trip + backwards-compat)
        status: pass
    human_judgment: false
  - id: D6
    description: "dispatch.keystroke broadcasts cursor_update with charStates + wpm to OTHER players only"
    verification:
      - kind: unit
        ref: apps/server/src/__tests__/char-states.test.ts (test 7 — end-to-end dispatch)
        status: pass
    human_judgment: false
  - id: D7
    description: "Word correctness aggregation handles contractions/hyphens correctly (Pitfall 7)"
    verification:
      - kind: unit
        ref: apps/server/src/__tests__/char-states.test.ts (test 5)
        status: pass
    human_judgment: false
  - id: D8
    description: "Server ignores inbound charStates/wpm (schema optional + cursor_position inbound lacks fields)"
    verification:
      - kind: unit
        ref: packages/shared/src/messages.ts (cursor_position schema has no charStates/wpm)
        status: pass
    human_judgment: false
  - id: D9
    description: "Independent code review verdict — no security or logic issues"
    verification:
      - kind: command
        ref: "[verified] commit 3b9937f — independent reviewer subagent verdict: passed=true, security=[], logic=[]"
        status: pass
    human_judgment: false

duration: 28min
completed: 2026-08-31
---

# Phase 3 / Plan 02 — Char-State Model + Word Aggregation

**Per-character 2-tone state model (D-11/D-12), 4 pure scoring helpers, last-write-wins per position (Pitfall 1), server-authoritative cursor_update broadcast with charStates + wpm. Pre-commit code review passed (verified).**

## Performance

- **Duration:** 28 min
- **Tasks:** 3 (all complete)
- **Files modified:** 8 (2 created, 6 modified)
- **Tests:** 47 server + 24 shared + 4 web = 75 pass / 0 fail
- **Reviewer:** passed (1 commit `[verified]`)

## Accomplishments

- **CharState = "pending" | "correct" | "error"** — 2-tone (no "corrected" intermediate). Wrong-then-right flips to "correct" (Pitfall 1's last-write-wins per position).
- **Player extended** with 5 new fields: charStates, totalKeystrokes, uncorrectedErrors, currentWpm, finishedAtServerMs.
- **scoring.ts (NEW)** — 4 pure aggregation helpers: `countCorrectChars`, `countUncorrectedErrors`, `isWordCorrect`, `aggregateWordCorrectness` (handles contractions and hyphens as single words).
- **validateKeystroke extended** — returns `{ newCharStates, playerPatch }`; state guard permissively accepts racing OR grace (D-08); sets `finishedAtServerMs` on first-time passage completion.
- **cursorUpdateSchema** — gains optional `charStates: CharState[]` and `wpm: number`. JSDoc documents OUTBOUND-ONLY invariant (Pitfall V5).
- **dispatch keystroke** — broadcasts cursor_update with new fields to OTHER players (sender already has the state).
- **8 new server tests** (6 scoring tracer + 1 dispatch end-to-end + 1 char-state recompute on next-accept); **4 new shared tests** (round-trip + backwards-compat + wpm-negative + invalid-enum + empty-array).
- **Pre-commit code review** passed (requesting-code-review skill): 0 security, 0 logic. Suggestions addressed: enum-validation test, empty-array edge-case test.

## Task Commits

1. **Task 1 (tracer):** `e59d763 feat(server): char-state model + scoring helpers`
2. **Task 2 (auto):** `88eb64d feat(server): validateKeystroke returns char-state snapshot + player patch`
3. **Task 3 (auto):** `3b9937f [verified] feat(cursor-update): wire charStates + wpm to OTHER players`

## Files Created/Modified

- `apps/server/src/race/types.ts` — CharState + 5 new Player fields
- `apps/server/src/race/scoring.ts` — 4 pure aggregation helpers
- `apps/server/src/race/validate-keystroke.ts` — return newCharStates + playerPatch; grace accepted; finishedAtServerMs boundary
- `apps/server/src/rooms/manager.ts` — addPlayer initializes new Player fields
- `apps/server/src/ws/dispatch.ts` — keystroke broadcasts cursor_update with charStates + wpm
- `packages/shared/src/messages.ts` — cursorUpdateSchema gains charStates? + wpm?; OUTBOUND-ONLY JSDoc
- `apps/server/src/__tests__/char-states.test.ts` — 7 tests (6 scoring + 1 dispatch end-to-end)
- `apps/server/src/__tests__/validate-keystroke.test.ts` — extended from 8 to 14 tests
- `apps/server/src/__tests__/race-controller.test.ts` — fakeRoom extends for new Player fields
- `packages/shared/src/__tests__/messages.test.ts` — 4 new cursor_update tests (tests 9, 10, 11, 12)

## Decisions Made

- **`currentWpm: 0` placeholder** in validator — Plan 03 wires the real D-05 formula. Wire extension faithfully reflects the current shape; not a regression. Reviewer flagged as known TODO.
- **Grace state via permissive check** — validator rejects only `lobby|countdown`. Plan 04 will formally add `"grace"` to `RaceState` union. This future-proofs the validator without modifying shared types in Plan 02's scope.
- **Empty `charStates: []` accepted** — reviewer's edge-case suggestion. Edge case can occur during first-keystroke race initialization. Schema correctly allows.
- **`aggregateWordCorrectness` uses `/\S+/g`** — contractions ("don't") and hyphens ("ice-cream") stay as single words (Pitfall 7). Verified by tests 4+5.

## Deviations from Plan

### Auto-fixed Issues

**1. [Type] RaceState union doesn't include "grace" yet (Plan 04 owns it)**
- **Found during:** typecheck after writing `state !== "racing" && state !== "grace"`
- **Issue:** TypeScript flagged "comparison appears unintentional" — `"grace"` is not in the union
- **Fix:** Inverted the check to `state === "lobby" || state === "countdown" → reject`. Semantically equivalent, future-proof, no shared-type change
- **Committed in:** `88eb64d` (Task 2)

**2. [Test] No end-to-end dispatch test in uncommitted work**
- **Found during:** Self-review before code review
- **Issue:** Plan 02 §success_criteria #6 ("dispatch.keystroke broadcasts cursor_update with charStates + wpm to OTHER players only") lacked end-to-end coverage — only the shared schema round-trip was tested
- **Fix:** Added Test 7 in `char-states.test.ts` — 2-player fakeWs setup, drive keystroke through dispatch, verify opponent's `wsRef.sent` contains cursor_update with `charStates.length === passageText.length` and `wpm: 0` (placeholder)
- **Committed in:** `3b9937f` (Task 3)

**3. [Reviewer suggestion] Add edge-case tests for cursor_update**
- **Found during:** Independent code review
- **Issue:** Reviewer flagged missing tests: invalid charStates enum value, empty array charStates
- **Fix:** Added tests 11 (invalid enum rejected) + 12 (empty array accepted) per Zod 4 spec
- **Committed in:** `3b9937f` (Task 3)

---

**Total deviations:** 3 auto-fixed (1 type, 1 missing test, 2 review suggestions)
**Impact on plan:** No functional change; all fixes preserve intent.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration.

## Next Phase Readiness

Plan 03 (WPM + accuracy pure functions + fixtures) can now proceed:
- `correctChars` available via `countCorrectChars(player.charStates)` (D-13)
- `uncorrectedErrors` available via `countUncorrectedErrors(player.charStates)` (Plan 02 stores it on `player`)
- `totalKeystrokes` available on player
- `room.startsAtServerMs` available (elapsed time = `now - startsAtServerMs`)
- Real D-05 formula `(correct/5 − uncorrected/5) / minutesElapsed` can be wired in validator at line 115 (currently `currentWpm: 0` placeholder)
- The wire already carries `wpm`; Plan 03 just needs the math

---
*Phase: 03-race-track*
*Completed: 2026-08-31*