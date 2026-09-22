---
phase: 03-race-track
verified: 2026-09-16T00:00:00Z
resolved: 2026-09-21T00:00:00Z
status: closed_via_override
score: 4/5 must-haves verified, remaining must-have closed via accepted override (Gap A + Gap B, see below)
covered_files:

  - .planning/phases/03-race-track/03-01-PLAN.md
  - .planning/phases/03-race-track/03-01-SUMMARY.md
  - .planning/phases/03-race-track/03-02-PLAN.md
  - .planning/phases/03-race-track/03-02-SUMMARY.md
  - .planning/phases/03-race-track/03-03-PLAN.md
  - .planning/phases/03-race-track/03-03-SUMMARY.md
  - .planning/phases/03-race-track/03-04-PLAN.md
  - .planning/phases/03-race-track/03-04-SUMMARY.md
  - .planning/phases/03-race-track/03-UAT.md
  - .planning/phases/03-race-track/03-CONTEXT.md
  - .planning/phases/03-race-track/03-VALIDATION.md
  - .planning/PROJECT.md
  - .planning/ROADMAP.md
  - packages/shared/src/passages.ts
  - packages/shared/src/messages.ts
  - apps/engine/src/race/corpus.ts
  - apps/engine/src/race/scoring.ts
  - apps/engine/src/race/types.ts
  - apps/engine/src/race/controller.ts
  - apps/engine/src/race/frames.ts
  - apps/engine/src/race/validate-keystroke.ts
  - apps/engine/src/engine.ts
  - apps/engine/src/rooms/manager.ts
  - apps/web/src/components/RaceView.tsx
  - apps/web/src/components/ResultsBoard.tsx
  - apps/web/src/components/RaceHud.tsx
  - apps/web/src/components/LobbyView.tsx
  - apps/web/src/components/GraceBanner.tsx
  - apps/web/src/components/CountdownView.tsx
  - apps/web/src/core/typing-engine.ts
  - apps/web/src/styles.css
  - apps/engine/src/__tests__/scoring.test.ts
  - apps/engine/src/__tests__/char-states.test.ts
  - apps/engine/src/__tests__/corpus.test.ts
  - packages/shared/src/__tests__/passages.test.ts

covered_digest: "unavailable — installed gsd-tools.cjs (.hermes/gsd-core/bin/gsd-tools.cjs) does not expose a `verification.fingerprint` subcommand (query verification --help lists only: status, resolve-file). Not hand-written per #4155; left absent rather than fabricated."
behavior_unverified: 0
overrides_applied: 0
gaps:

  - truth: "Errored-then-corrected chars render in a visually distinct 'neutral' state, separate from first-try-correct chars (ROADMAP SC1, clause 1)"
    status: failed
    reason: >
      Implementation is a documented, deliberate 2-tone model (CharState = 'pending'|'correct'|'error',
      decisions D-11/D-12 in 03-CONTEXT.md, predating planning). A char that is typed wrong then
      backspace-corrected transitions straight to 'correct' — same visual treatment (green underline,
      .char-correct in apps/web/src/styles.css:360) as a char typed correctly on the first try. There is
      no third/neutral state anywhere in CharState, RaceView.tsx, or styles.css. UAT Test 2 explicitly
      confirms and accepts this: "Already-typed wrong chars (then backspaced + retyped correct) have a
      GREEN underline" (result: pass). This is a disclosed spec deviation, not an accidental miss —
      the CONTEXT → PLAN (03-02-PLAN.md must_haves) → SUMMARY (03-02-SUMMARY.md line 37) → UAT chain is
      consistent and explicit about the simplification ("Simpler to read").
    artifacts:
      - path: apps/engine/src/race/types.ts
        issue: "CharState = 'pending' | 'correct' | 'error' — no 'corrected' member"
      - path: apps/web/src/styles.css
        issue: "Only .char-pending / .char-correct / .char-error exist; no neutral/corrected style"
      - path: apps/web/src/components/RaceView.tsx
        issue: "Renders className=`char-${state}` from the 3-value CharState; nothing computes a 4th state"
    missing:
      - "Either implement a 4th 'corrected' char-state (distinct color/underline) and wire it through validate-keystroke.ts + RaceView.tsx + styles.css, OR accept the documented 2-tone deviation via an explicit override (see suggestion below)."
  - truth: "Word shows correct only when ALL its chars end 'correct' (ROADMAP SC1, clause 2 / REQ-05 / D-13) — as an observable, wired behavior, not just a helper function"
    status: failed
    reason: >
      `aggregateWordCorrectness`, `isWordCorrect`, and the `WordEntry` type exist in
      apps/engine/src/race/scoring.ts, are logically correct, and pass 6 unit tests
      (char-states.test.ts). But they are referenced nowhere outside their own test file — not in
      buildRaceEndFrame() (apps/engine/src/race/frames.ts), not in PlayerFinalStats, not in
      cursor_update frames, and not rendered by any web component (RaceView.tsx only renders
      per-char accents, never per-word). No player, at any point in the running app, ever sees or
      receives a per-word-correctness signal. D-13 (03-CONTEXT.md) states the function is "used by
      server-side correctness stats" — no such consumer exists in the codebase. Unlike the 2-tone
      color deviation above, nothing documents an explicit decision to leave this unconsumed; it
      reads as unfinished wiring rather than a disclosed scope cut.
    artifacts:
      - path: apps/engine/src/race/scoring.ts
        issue: "aggregateWordCorrectness/isWordCorrect/WordEntry defined and tested but never imported by engine.ts, frames.ts, or any apps/web/src file"
      - path: apps/engine/src/race/frames.ts
        issue: "buildRaceEndFrame()/PlayerFinalStats carry only finishTimeMs/wpm/accuracy — no per-word or word-count field"
    missing:
      - "Wire aggregateWordCorrectness into buildRaceEndFrame (or a results-facing field) so word-correctness is observable to at least one client, OR obtain an explicit human decision to descope per-word correctness display from v1 and record it as an override."

deferred: []
advisory: []
human_verification: []
audit_acknowledged:
  milestone: v1.0
  at: 2026-09-22
  status: closed_via_override
---

# Phase 3: Race Track + WPM Verification Report

**Phase Goal:** The visible typing surface and the universal closer. Per-character state model for
backspace-aware correctness, word-correctness aggregated from char states, server-computed standard
WPM formula, and a race-end results board ranked by finish time then WPM. Bundled passage corpus with
~50-100 short public-domain passages.

**Verified:** 2026-09-16
**Status:** gaps_found
**Re-verification:** No — initial verification

**Note on project layout:** Phase 3 was originally planned against `apps/server`. Phase 7 (complete,
2026-09-04) split the monolith into `apps/web` (presentation), `apps/gateway` (WS/rate-limit), and
`apps/engine` (race FSM + scoring + corpus — the direct successor of `apps/server/src/race/*`). All
Phase 3 deliverables were located and verified at their current `apps/engine` / `apps/web` / `packages/shared`
paths, not their original `apps/server` paths.

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP Success Criterion) | Status | Evidence |
|---|---|---|---|
| 1 | SC1: Backspace-aware char states — correct=green, errored-then-corrected=neutral, errored=red; word correct iff ALL chars correct | ✗ FAILED | Two sub-gaps, see `gaps:` — (a) 2-tone model renders corrected chars green, not neutral (documented D-11/D-12, UAT-confirmed); (b) word-correctness aggregator exists + tested but is never wired into any race_end frame, results board, or UI (orphaned) |
| 2 | SC2: Server WPM = `correctChars/5/minutesElapsed`, fixture 30 chars/30s → 12 WPM, unit-tested | ✓ VERIFIED | `apps/engine/src/race/scoring.ts` `computeNetWpm()`; exact fixture test at `apps/engine/src/__tests__/scoring.test.ts:5-7` (`computeNetWpm({correctChars:30, uncorrectedErrors:0, elapsedMs:30_000}) === 12`); ran `bun test apps/engine/src/__tests__/scoring.test.ts` → 10 pass / 0 fail. `player.currentWpm` (server-authoritative, set via validate-keystroke.ts using this formula) is what flows into `race_end.results[].wpm` in `buildRaceEndFrame()` |
| 3 | SC3: Results board within 1s of first finish, all players see finish time/WPM/accuracy/ranking (time primary, WPM tiebreak) | ✓ VERIFIED | `apps/engine/src/race/controller.ts` calls `controller.tick()` synchronously inside the `keystroke` handler the instant a player finishes (`apps/engine/src/engine.ts:433-438`), broadcasting `grace_countdown` or `race_end` immediately — not waiting for the 1000ms poll interval (`apps/engine/src/engine.ts:81-83`, `setInterval(..., 1000)`). `buildRaceEndFrame()` computes `finishTimeMs`/`wpm`/`accuracy` per player server-side. `ResultsBoard.tsx` sorts `finishTimeMs` asc then `wpm` desc as tiebreak (lines 36-43). UAT Test 3 ("Grace period: others keep typing after first finishes") and Test 4 ("Results board: ranking + per-player stats") both `result: pass` |
| 4 | SC4: Bundled corpus, no network call, 30-60 words/passage, no two consecutive races in same room repeat a passage | ✓ VERIFIED | `packages/shared/src/passages.ts` — 67 passages (within 50-100 range) compiled as a TS const (no fetch/network); word-count check on all 67 entries confirmed 30-60 words (script run, 0 out-of-range). The only start_race code path actually reachable from the UI (`LobbyView.handleStartRace` → `onStartRace(undefined, ...)`, `apps/web/src/components/LobbyView.tsx:85-93`) always omits `passageId`, so every race is served by `getRandomPassage(category, room.lastPassageId)` (`packages/shared/src/passages.ts:174-189`), which excludes the immediately-previous passage. `room.lastPassageId` is set on every `start_race` (`apps/engine/src/engine.ts:361`) and is never reset (checked `return_to_lobby` handler and race-end transitions — no reset path found), so the no-repeat guarantee holds across lobby→race→results→rematch/return-to-lobby→race cycles. UAT Test 5 ("Rematch serves a new passage") confirms `result: pass` across 5+ sequential rematches |
| 5 | SC5: Rematch button starts new race, same room, new passage; server-synced "Starting in Ns…" countdown | ✓ VERIFIED | `ResultsBoard.handleRematch()` sends `start_race` with no `passageId` (auto no-repeat pick, per SC4 evidence above). `apps/engine/src/race/controller.ts:13,39` sets `room.startsAtServerMs = Date.now() + COUNTDOWN_DURATION_MS` (server clock, broadcast via `countdown` frame); `CountdownView.tsx` renders from `startsAtServerMs`, not local clock. UAT Test 1 ("Two-laptop demo... full race") and Test 5 both confirm rematch flow + countdown work end to end (`result: pass`) |

**Score:** 4/5 truths verified (0 present-but-behavior-unverified)

### This looks intentional — override suggestion for Gap A

```yaml
overrides:

  - must_have: "Errored-then-corrected chars render in a visually distinct 'neutral' state, separate from first-try-correct chars (ROADMAP SC1, clause 1)"
    reason: >
      Deliberate, disclosed simplification captured in 03-CONTEXT.md decisions D-11 ("char color,
      correct accent, wrong accent") and D-12 ("2-tone only... Simpler to read") — made during
      phase discussion, before planning. Carried consistently through 03-02-PLAN.md must_haves,
      03-02-SUMMARY.md, and confirmed as expected/working behavior in 03-UAT.md Test 2 (result: pass).
      No hidden regression — the team chose this on purpose and verified it visually.
    accepted_by: "atithep_thepkit@cmu.ac.th"
    accepted_at: "2026-09-21"
```

### This looks intentional — override suggestion for Gap B (added post-03.1 investigation)

```yaml
overrides:

  - must_have: "aggregateWordCorrectness/isWordCorrect are consumed by a real feature (UI or server stats)"
    reason: >
      D-13 (03-CONTEXT.md) is explicit and two-part: "Word-correctness aggregation in server data
      model (not UI)... UI just renders per-char accents." The "not UI" clause directly forecloses
      wiring this into RaceView or any client-visible rendering — a gap-closure phase (03.1) built
      exactly that before this decision was found, and it was reverted once D-13 surfaced (see
      03.1-VERIFICATION.md). The remaining "used by server-side correctness stats" clause has no
      concrete deliverable anywhere in ROADMAP.md or PROJECT.md: REQ-05 itself reads "Per-word
      correctness + backspace handling for accurate WPM calculation" — i.e. per-word aggregation was
      always in service of WPM/accuracy, not a separate stats feature — and WPM/accuracy are already
      fully implemented and verified (Truth #2 above) via countCorrectChars/countUncorrectedErrors,
      not aggregateWordCorrectness. No requirement or roadmap success criterion calls for a distinct
      per-word stats consumer beyond that. Unused-but-intentional (same resting state as
      countCorrectChars would be if nothing called it) is the correct closure, not a defect.
    accepted_by: "atithep_thepkit@cmu.ac.th"
    accepted_at: "2026-09-21"
```

Both Gap A and Gap B are now recorded as suggested overrides pending explicit human sign-off — see
`03.1-VERIFICATION.md` for the fuller investigation trail (including the reverted UI-rendering attempt).

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `packages/shared/src/passages.ts` | 50-100 public-domain passages, 30-60 words each | ✓ VERIFIED | 67 entries, 0 out-of-range on word count |
| `apps/engine/src/race/corpus.ts` | Fisher-Yates `dealNextPassage()` deck | ⚠️ ORPHANED | Function exists, logically correct, 6 passing unit tests (`corpus.test.ts`) — but `dealNextPassage`/`shuffle` are imported in `apps/engine/src/engine.ts:8` and never called; `room.deckOrder`/`deckCursor` are initialized to `[]`/`0` in `apps/engine/src/rooms/manager.ts:52-53` and never populated or read. The actual no-repeat mechanism in production is `getRandomPassage`'s single-passage `excludeId`, not this deck. Not a blocker for SC4 (which only requires no *consecutive* repeat, satisfied by the exclude mechanism) — flagged so a future reader doesn't assume the deck machinery is live |
| `apps/engine/src/race/scoring.ts` | 4 pure aggregation helpers (`countCorrectChars`, `countUncorrectedErrors`, `isWordCorrect`/`aggregateWordCorrectness`, `computeNetWpm`, `computeAccuracy`) | ⚠️ PARTIAL | `countCorrectChars`/`countUncorrectedErrors`/`computeNetWpm`/`computeAccuracy` are wired (feed `buildRaceEndFrame`). `aggregateWordCorrectness`/`isWordCorrect` are orphaned — see Gap B |
| `apps/engine/src/race/controller.ts` / `frames.ts` | Race-end detection + results frame, ranked | ✓ VERIFIED | Grace/finished FSM + `buildRaceEndFrame` wired and tested (`race-end.test.ts`, `race-controller.test.ts`) |
| `apps/web/src/components/ResultsBoard.tsx` | Ranked board: rank/time/WPM/accuracy, rematch button | ✓ VERIFIED | Sorts by `finishTimeMs` asc, `wpm` desc tiebreak; rematch/return-to-lobby wired to `ws.send` |
| `apps/web/src/components/RaceView.tsx` | Per-char accent rendering | ✓ VERIFIED (2-tone only, see Gap A) | `char-${state}` class from 3-value `CharState` |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `LobbyView.handleStartRace` | `apps/engine/src/engine.ts` `start_race` handler | `ws.send({type:"start_race", ...})` (no passageId) | ✓ WIRED | Confirmed in code; UAT Test 1 |
| `engine.ts` `start_race` handler | `getRandomPassage(category, room.lastPassageId)` | direct call, `passages.ts:341-345` | ✓ WIRED | excludeId prevents consecutive repeat |
| `validate-keystroke.ts` → `player.currentWpm` | `buildRaceEndFrame` → `race_end.results[].wpm` | `frames.ts:95` `p.currentWpm` | ✓ WIRED | Server-authoritative WPM reaches results |
| `controller.tick()` (on finish) | `broadcast_to_room` `grace_countdown` / `race_end` | `engine.ts:433-438` synchronous tick on finish keystroke | ✓ WIRED | Confirms "within 1s" — actually near-immediate, not just polled |
| `apps/engine/src/race/scoring.ts` `aggregateWordCorrectness` | *(none)* | *(none found)* | ✗ NOT WIRED | See Gap B |
| `apps/engine/src/race/corpus.ts` `dealNextPassage` | *(none)* | *(none found)* | ✗ NOT WIRED | See ORPHANED artifact note above; not a blocker for SC4 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `ResultsBoard.tsx` `results` prop | `race_end.results` | `buildRaceEndFrame(room, now)` — computed from live `room.players` charStates/currentWpm | Yes | ✓ FLOWING |
| `RaceView.tsx` own-player char accents | `ownCharStates` (race store) | Local `TypingEngine` prediction (`apps/web/src/core/typing-engine.ts`), NOT server round-trip (server's own `cursor_update` for the sender is intentionally excluded via `excludePlayerId`, confirmed in `apps/engine/src/engine.ts` and disclosed in `03-02-SUMMARY.md` line 198 + covered by "Test 7" dispatch test) | Yes (locally computed, same char-matching logic as server) | ℹ️ Info — client-predicted, not server round-tripped, for the local player's own rendering. Deliberate/tested latency optimization; opponents' char states ARE server-sourced via `cursor_update`. Not treated as a gap |
| `RaceView.tsx` opponent char accents | `cursors` store, populated from `cursor_update` frames | `buildCursorUpdateFrame(player, serverTs)` in `frames.ts`, server-authoritative | Yes | ✓ FLOWING |
| Word-correctness (`aggregateWordCorrectness`) | *(no consumer)* | — | No live consumer | ✗ DISCONNECTED — see Gap B |

### Behavioral Spot-Checks / Test Runs

| Behavior | Command | Result | Status |
|---|---|---|---|
| WPM fixture (30 chars/30s → 12 WPM) | `bun test apps/engine/src/__tests__/scoring.test.ts` | 10 pass / 0 fail | ✓ PASS |
| Char-state 2-tone transitions + word aggregation logic | `bun test apps/engine/src/__tests__/char-states.test.ts` | 6 pass / 0 fail, 21 expect() calls | ✓ PASS |
| Corpus deck + no-repeat pure functions | `bun test apps/engine/src/__tests__/corpus.test.ts packages/shared/src/__tests__/passages.test.ts` | 19 pass / 0 fail, 710 expect() calls | ✓ PASS |
| Full engine test suite (regression check) | `bun test apps/engine` | 92 pass / 0 fail across 13 files | ✓ PASS |
| Full web test suite (regression check) | `bun run --filter '@typing-race/web' test` | 78 pass / 0 fail across 12 files | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` files exist in the repository, and no PLAN/SUMMARY/VALIDATION document
for this phase references a probe script. Step 7c is not applicable.

| Probe | Command | Result | Status |
|---|---|---|---|
| — | — | — | N/A — no probes declared or found |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| REQ-05 | 03-02, 03-03 | Per-word correctness + backspace handling for accurate WPM | ⚠️ PARTIAL | Backspace-aware char-state model correct and tested; WPM formula correctly uses char-level `correctChars`/`uncorrectedErrors` (backspace-aware) independent of word aggregation. But the "per-word correctness" half is orphaned (Gap B) and the visual 3-tone requirement is a documented 2-tone deviation (Gap A) |
| REQ-08 | 03-04 | Race-end board: WPM + accuracy, ranked by finish time then WPM | ✓ SATISFIED | `ResultsBoard.tsx` + `buildRaceEndFrame`; UAT Tests 3/4 pass |
| REQ-10 | 03-01 | Bundled passage corpus, ~50-100 public-domain, no-repeat | ✓ SATISFIED | 67 passages, no-network, no-consecutive-repeat confirmed; UAT Test 5 pass |

No orphaned requirements found — REQUIREMENTS.md does not exist in this project; cross-referenced
against `.planning/PROJECT.md` `## Requirements` and `.planning/ROADMAP.md` Phase 3 section instead, per
task instructions.

### Anti-Patterns Found

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers or empty-implementation stubs found in any
of the 10 key Phase 3 source files scanned (`passages.ts`, `corpus.ts`, `scoring.ts`, `controller.ts`,
`validate-keystroke.ts`, `RaceView.tsx`, `ResultsBoard.tsx`, `GraceBanner.tsx`, `CountdownView.tsx`,
`types.ts`).

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `apps/engine/src/engine.ts` | 8 | `dealNextPassage`/`shuffle` imported, never called | ℹ️ Info | Dead deck machinery — see ORPHANED artifact note; not a functional gap given SC4's actual (weaker) requirement is met by a different mechanism |
| `apps/engine/src/race/controller.ts` | 13 | `COUNTDOWN_DURATION_MS = 3_000` | ℹ️ Info | ROADMAP SC5 text says "Starting in 2s…"; implementation uses 3s (same value as the original Phase 2 race-start countdown, reused for rematch). Substance — server-synced countdown pause — holds; only the specific numeric example in the ROADMAP prose differs. Not flagged as a gap |
| `packages/shared/src/passages.ts` | — | Corpus is a TS `const` array, not literally a `.json` file | ℹ️ Info | ROADMAP SC4 says "bundled JSON file"; D-03 (03-CONTEXT.md) documents the TS-const choice explicitly. Intent (no runtime fetch, no network call) is fully met. Not flagged as a gap |

### Human Verification Required

None. All 5 success criteria were resolvable from code + passing automated tests + the existing
03-UAT.md record (5/5 tests passed 2026-09-02, covering the visual/live-demo aspects — two-laptop race,
live char accents, grace banner, results ranking, rematch/no-repeat). No additional human verification
items are needed beyond the gaps already listed above, which are code-wiring facts, not matters of taste.

### Deferred Items

None. All later milestone phases (04 Reconnect, 05 Frontend Polish, 07 Split into N-tier, 07.1 fix) are
complete; only Phase 6 (Deploy + Hardening) remains, and its goal/success criteria (graceful shutdown,
CI, anti-cheat regression tests, deploy docs) do not mention char-state visualization or per-word
correctness display. Neither Gap A nor Gap B is addressed by any planned future phase — both are live
gaps for Phase 3.

## Gaps Summary

Phase 3 delivers a solid, well-tested race track: the WPM formula is exactly per spec and unit-tested
against the ROADMAP's own fixture, the results board is correctly ranked and server-authoritative, the
passage corpus is properly bundled and the no-repeat behavior is real and verified end-to-end (UAT),
and the rematch/countdown flow works with server-synced timing. 92 engine tests and 78 web tests all
pass; no debt markers or stub code found in the phase's key files.

The one success criterion that does not fully hold as written is SC1 (char-state visualization), which
splits into two distinct gaps:

- **Gap A** (documented, UAT-confirmed, override recommended): the char-state model is 2-tone by
  deliberate team decision (D-11/D-12), not the 3-tone "neutral for corrected" model the ROADMAP
  literally describes. This looks like an intentional, disclosed simplification rather than an
  oversight — an override is suggested for human sign-off rather than a rework.
- **Gap B** (real wiring gap, no override suggested): the per-word correctness aggregator
  (`aggregateWordCorrectness`) is implemented and unit-tested but never connected to any output any
  player can see — it doesn't feed the results board, doesn't feed any wire frame, and isn't rendered.
  This needs either wiring into `buildRaceEndFrame`/`PlayerFinalStats` or an explicit human decision to
  descope per-word correctness from v1.

---

_Verified: 2026-09-16_
_Verifier: Claude (gsd-verifier)_
