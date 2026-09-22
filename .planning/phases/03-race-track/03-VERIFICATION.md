---
phase: 03-race-track
verified: 2026-09-23T00:00:00Z
resolved: 2026-09-23T01:00:00Z
status: closed_via_override
score: 5/5 must-haves verified (3 by accepted override: char-color model, word-correctness wiring, ranking formula); winnerTimeMs/deltaMs negative-delta bug fixed
covered_files:

  - .planning/PROJECT.md
  - .planning/ROADMAP.md
  - .planning/phases/03-race-track/03-01-PLAN.md
  - .planning/phases/03-race-track/03-01-SUMMARY.md
  - .planning/phases/03-race-track/03-02-PLAN.md
  - .planning/phases/03-race-track/03-02-SUMMARY.md
  - .planning/phases/03-race-track/03-03-PLAN.md
  - .planning/phases/03-race-track/03-03-SUMMARY.md
  - .planning/phases/03-race-track/03-04-PLAN.md
  - .planning/phases/03-race-track/03-04-SUMMARY.md
  - .planning/phases/03-race-track/03-CONTEXT.md
  - .planning/phases/03-race-track/03-UAT.md
  - .planning/phases/03-race-track/03-VALIDATION.md
  - apps/engine/src/__tests__/char-states.test.ts
  - apps/engine/src/__tests__/corpus.test.ts
  - apps/engine/src/__tests__/scoring.test.ts
  - apps/engine/src/engine.ts
  - apps/engine/src/race/controller.ts
  - apps/engine/src/race/corpus.ts
  - apps/engine/src/race/frames.ts
  - apps/engine/src/race/scoring.ts
  - apps/engine/src/race/types.ts
  - apps/engine/src/race/validate-keystroke.ts
  - apps/engine/src/rooms/manager.ts
  - apps/web/src/components/CountdownView.tsx
  - apps/web/src/components/GraceBanner.tsx
  - apps/web/src/components/LobbyView.tsx
  - apps/web/src/components/RaceHud.tsx
  - apps/web/src/components/RaceView.tsx
  - apps/web/src/components/ResultsBoard.tsx
  - apps/web/src/core/typing-engine.ts
  - apps/web/src/styles.css
  - packages/shared/src/__tests__/passages.test.ts
  - packages/shared/src/messages.ts
  - packages/shared/src/passages.ts

covered_digest: "v1:sha256:00a087c563fe1443ade8c066e2925dffc038bb84bc447540f9ddaecdb29fc228"
behavior_unverified: 0
overrides_applied: 2
overrides:

  - must_have: "Errored-then-corrected chars render in a visually distinct 'neutral' state, separate from first-try-correct chars (ROADMAP SC1, clause 1)"
    reason: >
      Deliberate, disclosed simplification captured in 03-CONTEXT.md decisions D-11 ("char color,
      correct accent, wrong accent") and D-12 ("2-tone only... Simpler to read") — made during
      phase discussion, before planning. Carried consistently through 03-02-PLAN.md must_haves,
      03-02-SUMMARY.md, and confirmed as expected/working behavior in 03-UAT.md Test 2 (result: pass).
      No hidden regression — the team chose this on purpose and verified it visually. Carried
      forward verbatim from the 2026-09-16 verification; re-checked against current code
      (apps/engine/src/race/types.ts, apps/web/src/styles.css) and unchanged.
    accepted_by: "atithep_thepkit@cmu.ac.th"
    accepted_at: "2026-09-21"
  - must_have: "aggregateWordCorrectness/isWordCorrect are consumed by a real feature (UI or server stats)"
    reason: >
      D-13 (03-CONTEXT.md) is explicit and two-part: "Word-correctness aggregation in server data
      model (not UI)... Used by server-side correctness stats; UI just renders per-char accents."
      The "not UI" clause directly forecloses wiring this into RaceView or any client-visible
      rendering — a gap-closure phase (03.1) built exactly that before this decision was found,
      and it was reverted once D-13 surfaced (commit 3faf66e, then reverted in f74b721; see
      .planning/phases/03.1-wire-word-correctness-into-output-frame/03.1-VERIFICATION.md). The
      remaining "used by server-side correctness stats" clause has no concrete deliverable anywhere
      in ROADMAP.md or PROJECT.md: REQ-05 itself reads "Per-word correctness + backspace handling for
      accurate WPM calculation" — per-word aggregation was always in service of WPM/accuracy, not a
      separate stats feature — and WPM/accuracy are already fully implemented and verified (Truth #2
      below) via countCorrectChars/countUncorrectedErrors, not aggregateWordCorrectness. Unused-but-
      intentional is the correct closure. Carried forward verbatim from the 2026-09-16 verification;
      re-checked against current code (apps/engine/src/race/scoring.ts, frames.ts, engine.ts) —
      aggregateWordCorrectness/isWordCorrect are still referenced nowhere outside their own test
      file. Unchanged.
    accepted_by: "atithep_thepkit@cmu.ac.th"
    accepted_at: "2026-09-21"
  - must_have: "Results board ranks players with finish time as the primary key and WPM as the tiebreaker (ROADMAP SC3, clause 2)"
    reason: >
      User-requested change, made explicitly in this same session (2026-09-23): "change win
      condition into calculation of wpm, time to finished, and accuracy" → "Score = WPM × accuracy"
      + "add a bonus score of finishing player" — so any finisher always outranks a DNF regardless
      of partial wpm/accuracy at grace-timeout. commit 428090c implemented
      score = wpm*accuracy + (finished ? 1000 : 0), sorted descending; finishTimeMs is no longer a
      sort key. ROADMAP.md SC3 and PROJECT.md's Active requirement have been updated to describe
      this formula (2026-09-23). The negative-delta display bug this change introduced
      (winnerTimeMs read the top-score player instead of the fastest finisher) has been fixed:
      ResultsBoard.tsx now computes a separate fastestFinishMs anchor for the Delta column,
      independent of score rank, with a regression test covering the score-winner-is-slower case.
    accepted_by: "atithep_thepkit@cmu.ac.th"
    accepted_at: "2026-09-23"
re_verification:
  previous_status: closed_via_override
  previous_score: "4/5"
  gaps_closed: []
  gaps_remaining:
    - "Gap A (2-tone char-state model) — remains an accepted override, unchanged, re-verified against current code"
    - "Gap B (word-correctness aggregator unwired) — remains an accepted override, unchanged, re-verified against current code"
  regressions:
    - "SC3 ranking clause: results board no longer ranks by finish-time-primary/WPM-tiebreak. Introduced by commit 428090c (2026-09-22, one day AFTER the 2026-09-21 override sign-off), unrelated to either accepted override. Not previously flagged, not covered by any override, and ROADMAP.md/PROJECT.md were not updated to match."

gaps:

  - truth: "Results board ranks players with finish time as the primary key and WPM as the tiebreaker (ROADMAP SC3, clause 2 / PROJECT.md REQ: \"ranked by finish time then WPM\")"
    status: fixed
    reason: >
      Commit 428090c ("change win condition to wpm*accuracy score with finish bonus", 2026-09-22)
      replaced the finish-time-primary/WPM-tiebreak sort in ResultsBoard.tsx with
      `score = wpm * accuracy + (finished ? 1000 : 0)`, sorted descending. Finish time (`finishTimeMs`)
      is no longer part of the sort key at all — every finisher gets the identical +1000 bonus
      regardless of how long they took, so it is not even a true tiebreaker; ranking is now
      wpm*accuracy only, among finishers. The test suite documents this is intentional and
      self-aware: apps/web/src/__tests__/RaceView.test.tsx line ~114 has the comment "Note
      finishTimeMs (30000/20000/25000) deliberately does NOT match this order, proving ranking no
      longer sorts by finish time." Neither ROADMAP.md (Phase 3 SC3: "ranking (finish time primary,
      WPM tiebreaker)") nor PROJECT.md (`## Requirements` > Active: "Race-end screen: WPM + accuracy
      board, ranked by finish time then WPM") was updated to reflect this — both still state the old
      contract as of this verification. `git log -- .planning/ROADMAP.md` shows the roadmap's last
      touch (f74b721) predates the ranking-formula commit (428090c), confirming the roadmap text is
      stale relative to the code, not the other way around. This was a later, separate feature
      request per the task framing for this re-verification — but it was never reconciled with the
      still-standing written success criterion, and it does not fuzzy-match (80% token overlap)
      either of the two accepted overrides for this phase, which are scoped to the char-color model
      and word-correctness wiring, not ranking. This is therefore a new, unevidenced-by-override
      regression against a live roadmap contract, not a carryover of Gap A/B. A second, related
      display artifact stems from the same commit: `winnerTimeMs = ranked[0]?.finishTimeMs` (line 67)
      now reads the *top-score* player, not the earliest finisher, and `deltaMs = r.finishTimeMs -
      winnerTimeMs` (line 140) is computed unconditionally from it — so a player who finished earlier
      than the top-score player renders a negative delta (e.g. "+-40.0s") in the Delta column.
      Reproduced by hand: results [{finishTimeMs:10000, wpm:10, accuracy:.5}, {finishTimeMs:50000,
      wpm:100, accuracy:1.0}] → score-sort ranks the second (wpm 100) player first even though they
      finished 40s later, making winnerTimeMs=50000 and the first player's delta = 10000-50000 =
      -40000. Same root cause as the ranking-clause failure; not filed as a separate gap.
    artifacts:
      - path: apps/web/src/components/ResultsBoard.tsx
        issue: "ranked = [...results].sort by score(b) - score(a) where score = wpm*accuracy + finishBonus; finishTimeMs is read only for display (Time/Delta columns), never used as a sort key"
      - path: apps/web/src/components/ResultsBoard.tsx
        issue: "winnerTimeMs (line 67, derived from ranked[0], the top-score player) feeds deltaMs (line 140) unconditionally, so a player who finished before the top-score player can render a negative Delta value (\"+-Ns\") — a display artifact of the same ranking change, not a separate defect"
    missing: []
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

**Verified:** 2026-09-23 (re-verification)
**Status:** gaps_found
**Re-verification:** Yes — after the 2026-09-16 initial verification's two gaps (Gap A, Gap B) were
formally accepted as overrides by the human (atithep_thepkit@cmu.ac.th, 2026-09-21). This pass
independently re-checks the ROADMAP.md Phase 3 success criteria against the current codebase, re-runs
the test suites, and specifically scrutinizes the ranking-formula change (commit 428090c) that landed
after the override sign-off.

## Note on the prior VERIFICATION.md's internal inconsistency

The 2026-09-16 `03-VERIFICATION.md` had `status: closed_via_override` and an `audit_acknowledged`
block claiming the phase was closed via override, but its frontmatter `overrides:` array was **absent**
(`overrides_applied: 0`) and its `gaps:` entries still read `status: failed`. The actual accepted-override
text (with `accepted_by`/`accepted_at` filled in) existed only as markdown-body YAML snippets under
"This looks intentional — override suggestion for Gap A/B" headings, never promoted into frontmatter.
Cross-referenced against `.planning/ROADMAP.md`'s Phase 03.1 entry ("CLOSED VIA OVERRIDE... `03-
VERIFICATION.md`'s original Gap B is recorded as an accepted override, not a defect requiring a fix"),
the human sign-off is corroborated at the roadmap level, so this pass treats both Gap A and Gap B as
genuinely accepted (content preserved verbatim, per instruction not to re-litigate) and normalizes them
into a proper frontmatter `overrides:` array above. This is a formatting fix, not a re-opening of the
decision. **Convention used in this file, and recommended for future passes:** an override YAML block
inside a fenced code block in the markdown *body* is a *proposed/suggested* override awaiting human
sign-off; only an entry in the frontmatter `overrides:` array counts as *accepted*. This report's own
new SC3 finding (below) follows that convention — its suggested override is body-fenced with placeholder
`accepted_by`/`accepted_at`, and is NOT counted in `overrides_applied` or the passing score.

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP Success Criterion) | Status | Evidence |
|---|---|---|---|
| 1 | SC1: Backspace-aware char states — correct=green, errored-then-corrected=neutral, errored=red; word correct iff ALL chars correct | PASSED (override) | Gap A accepted override (2-tone model, D-11/D-12) still holds — re-checked `apps/engine/src/race/types.ts` (`CharState = "pending" \| "correct" \| "error"`, 3 values) and `apps/web/src/styles.css` (`.char-pending`/`.char-correct`/`.char-error` only, no 4th state) — unchanged since 2026-09-16 |
| 2 | SC2: Server WPM = `correctChars/5/minutesElapsed`, fixture 30 chars/30s → 12 WPM, unit-tested | ✓ VERIFIED | `apps/engine/src/race/scoring.ts` `computeNetWpm()` unchanged; fixture test still present at `apps/engine/src/__tests__/scoring.test.ts:5-7` (`computeNetWpm({correctChars:30, uncorrectedErrors:0, elapsedMs:30_000}) === 12`). Re-ran `bun test apps/engine` → 94 pass / 0 fail (includes this file) |
| 3 | SC3: Results board within 1s of first finish, all players see finish time/WPM/accuracy/ranking (time primary, WPM tiebreak) | ✗ FAILED (partial — see gap) | "Within 1s" delivery and finish time/WPM/accuracy display all still hold (`controller.tick()` synchronous on finish keystroke, unchanged). **But the ranking clause is broken**: `ResultsBoard.tsx` now ranks by `wpm * accuracy + finishBonus`, not finish-time-primary/WPM-tiebreak, and the Delta column can render a negative value as a side effect. See `gaps:` for full evidence |
| 4 | SC4: Bundled corpus, no network call, 30-60 words/passage, no two consecutive races in same room repeat a passage | ✓ VERIFIED | `packages/shared/src/passages.ts` — 67 passages (TS const, no fetch), all 67 word-counted programmatically: 0 out of the 30-60 range. Passage-length bucketing was rewritten in commit a63a9ac (character-count based, not word-count) since the prior pass — re-verified the no-repeat guarantee still holds under the new bucketing: computed bucket sizes are short=20, mid=24, long=23 (all ≥2), so the `excludeId` guard (`PASSAGES.length > 1` check applied per-category) can never empty a category's candidate pool down to the excluded passage and silently fall back to the full corpus. No-repeat mechanism (`getRandomPassage(category, room.lastPassageId)`, `room.lastPassageId` set every `start_race`, never reset) unchanged |
| 5 | SC5: Rematch button starts new race, same room, new passage; server-synced "Starting in Ns…" countdown | ✓ VERIFIED | `ResultsBoard.handleRematch()` → `start_race` (no `passageId`) unchanged; `controller.ts` server-clock countdown (`startsAtServerMs`) and `CountdownView.tsx` rendering from it unchanged. No commits touched this path since 2026-09-16 |

**Score:** 4/5 truths verified (2 by accepted override, 0 present-but-behavior-unverified), 1 failed (new regression)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `packages/shared/src/passages.ts` | 50-100 public-domain passages, 30-60 words each | ✓ VERIFIED | 67 entries, 0 out-of-range on word count (re-measured programmatically this pass) |
| `apps/engine/src/race/corpus.ts` | Fisher-Yates `dealNextPassage()` deck | ⚠️ ORPHANED (unchanged) | Still imported in `engine.ts` and never called; not a blocker for SC4, which is satisfied by the `excludeId` mechanism instead |
| `apps/engine/src/race/scoring.ts` | 4 pure aggregation helpers | ⚠️ PARTIAL (Gap B, override) | `countCorrectChars`/`countUncorrectedErrors`/`computeNetWpm`/`computeAccuracy` wired; `aggregateWordCorrectness`/`isWordCorrect` orphaned, accepted override |
| `apps/engine/src/race/controller.ts` / `frames.ts` | Race-end detection + results frame, ranked | ⚠️ PARTIAL | Race-end detection/frame construction correct and tested; the *ranking* consumer (`ResultsBoard.tsx`) no longer sorts by the frame's `finishTimeMs` — see gap |
| `apps/web/src/components/ResultsBoard.tsx` | Ranked board: rank/time/WPM/accuracy, rematch button | ⚠️ PARTIAL | Renders rank/time/WPM/accuracy/rematch correctly; ranking algorithm itself contradicts the still-standing written success criterion, and the Delta column can go negative as a side effect — see gap |
| `apps/web/src/components/RaceView.tsx` | Per-char accent rendering | ✓ VERIFIED (2-tone only, Gap A override) | `char-${state}` class from 3-value `CharState`, unchanged |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `LobbyView.handleStartRace` | `apps/engine/src/engine.ts` `start_race` handler | `ws.send({type:"start_race", ...})` (no passageId) | ✓ WIRED | Unchanged |
| `engine.ts` `start_race` handler | `getRandomPassage(category, room.lastPassageId)` | direct call, `passages.ts` | ✓ WIRED | Re-verified against new character-count bucketing; no-repeat still holds (bucket sizes ≥2) |
| `validate-keystroke.ts` → `player.currentWpm` | `buildRaceEndFrame` → `race_end.results[].wpm`/`finishTimeMs` | `frames.ts` | ✓ WIRED | Server-authoritative WPM/finish time reaches the results frame unchanged |
| `race_end.results[].finishTimeMs` | `ResultsBoard` ranking sort | *(none — sort key is now `wpm*accuracy+bonus`)* | ✗ NOT WIRED (regression) | `finishTimeMs` is read for the Time/Delta display columns only; it is no longer consulted by the sort comparator. See gap |
| `apps/engine/src/race/scoring.ts` `aggregateWordCorrectness` | *(none)* | *(none found)* | ✗ NOT WIRED (Gap B, override) | Unchanged — accepted override |
| `apps/engine/src/race/corpus.ts` `dealNextPassage` | *(none)* | *(none found)* | ✗ NOT WIRED | Unchanged, not a blocker for SC4 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `ResultsBoard.tsx` `results` prop | `race_end.results` | `buildRaceEndFrame(room, now)` — live server state | Yes | ✓ FLOWING |
| `ResultsBoard.tsx` `ranked` (sort order) | `score(r) = r.wpm * r.accuracy + (finished ? 1000 : 0)` | Computed client-side from `results` + `finishedPlayerIds`; does not read `finishTimeMs` | Yes (real data, but not the data the roadmap contract specifies as the primary sort key) | ⚠️ HOLLOW relative to SC3's literal contract — flows real data, but not the data SC3 requires to drive ranking |
| `ResultsBoard.tsx` `deltaMs` (Delta column) | `r.finishTimeMs - winnerTimeMs` where `winnerTimeMs = ranked[0].finishTimeMs` | Live server data, but `ranked[0]` is the top-score player, not the earliest finisher | Yes | ⚠️ HOLLOW — can produce a negative value that renders as "+-Ns" |
| Word-correctness (`aggregateWordCorrectness`) | *(no consumer)* | — | No live consumer | ✗ DISCONNECTED — accepted override (Gap B) |

### Behavioral Spot-Checks / Test Runs

| Behavior | Command | Result | Status |
|---|---|---|---|
| WPM fixture (30 chars/30s → 12 WPM) | `bun test apps/engine` (includes `scoring.test.ts`) | 94 pass / 0 fail across 13 files | ✓ PASS |
| Full engine suite (regression check) | `bun test apps/engine` | 94 pass / 0 fail | ✓ PASS |
| Full shared+gateway suite (regression check) | `bun test packages/shared apps/gateway` | 59 pass / 0 fail | ✓ PASS |
| Full web suite (regression check, vitest) | `bun run --cwd apps/web test` | 89 pass / 0 fail across 13 files | ✓ PASS |
| Passage word-count re-check (SC4) | `node` inline script over `passages.ts` | 67/67 passages in 30-60 word range | ✓ PASS |
| Passage length-bucket re-check (SC4 no-repeat, post a63a9ac) | `node` inline script, `classifyPassageLength` re-implemented | short=20, mid=24, long=23 — all ≥2, no single-passage-bucket edge case | ✓ PASS |
| Ranking sort key (SC3 clause) | Read `ResultsBoard.tsx` `ranked` memo + `apps/web/src/__tests__/RaceView.test.tsx` test 7/8 | `score = wpm*accuracy + finishBonus`; test's own comment: "finishTimeMs... deliberately does NOT match this order, proving ranking no longer sorts by finish time" | ✗ FAIL against ROADMAP SC3 text |
| Delta column sign (manual trace) | Hand-traced `winnerTimeMs`/`deltaMs` with a constructed fixture (early-finish/low-score vs. late-finish/high-score) | `deltaMs` computed as -40000 for the earlier finisher | ✗ FAIL — negative delta possible, same root cause as ranking gap |

All test suites pass; there is no failing automated test anywhere in the repo. The SC3 gap is a
**contract-vs-implementation mismatch** (the code's own tests correctly describe the code's new,
intentional behavior — they just don't match the still-written roadmap/requirements text), not a bug
or a failing assertion. The negative-delta finding is a genuine, reproducible display defect but is a
side effect of the same root cause and is not filed as a second gap.

### Probe Execution

No `scripts/*/tests/probe-*.sh` files exist in the repository. Step 7c is not applicable.

| Probe | Command | Result | Status |
|---|---|---|---|
| — | — | — | N/A — no probes declared or found |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| REQ-05 | 03-02, 03-03 | Per-word correctness + backspace handling for accurate WPM | ⚠️ PARTIAL (unchanged, override) | Backspace-aware char-state model correct and tested (2-tone, Gap A override); WPM formula correctly uses char-level `correctChars`/`uncorrectedErrors`, independent of word aggregation. Per-word correctness half remains orphaned (Gap B, override) |
| REQ-08 | 03-04 | Race-end board: WPM + accuracy, ranked by finish time then WPM | ✗ BLOCKED (new regression) | Board correctly shows WPM + accuracy, but is no longer ranked by finish time then WPM — see gap. `.planning/PROJECT.md` `## Requirements` > Active still lists this literal text, unchecked (`[ ]`), as of this verification |
| REQ-10 | 03-01 | Bundled passage corpus, ~50-100 public-domain, no-repeat | ✓ SATISFIED | 67 passages, no-network, no-consecutive-repeat re-confirmed against the new character-count length bucketing |

No orphaned requirements found — REQUIREMENTS.md does not exist in this project; cross-referenced
against `.planning/PROJECT.md` `## Requirements` and `.planning/ROADMAP.md` Phase 3 section.

### Anti-Patterns Found

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in any of the Phase 3 key source files
re-scanned this pass (`passages.ts`, `corpus.ts`, `scoring.ts`, `controller.ts`, `validate-keystroke.ts`,
`RaceView.tsx`, `ResultsBoard.tsx`, `types.ts`, `typing-engine.ts`).

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `apps/web/src/components/ResultsBoard.tsx` | ~48-53 | Ranking sort key changed from `finishTimeMs` to `wpm*accuracy+bonus` | 🛑 Blocker (carried into `gaps:`) | Contradicts still-standing ROADMAP SC3 / PROJECT.md REQ-08 text — see gap above. This is a Step 3 truth failure (roadmap success criterion), not a Step 7 free-form judgment call, so the re-verification evidence gate (#3304, which bounds Step 7 findings) does not shield it; it is reported directly as a gap regardless |
| `apps/web/src/components/ResultsBoard.tsx` | 67, 140 | `winnerTimeMs`/`deltaMs` derived from `ranked[0]` (top score), can go negative | ⚠️ Warning (carried into same gap, not double-counted) | Same root cause as the ranking-sort blocker above; reported as an additional artifact issue on that gap, not a separate gap |
| `apps/web/src/core/typing-engine.ts` | — | New backspace-lock behavior (`isCharDeletable`, commit 73db8da): a completed error-free word can no longer be backspaced into | ℹ️ Info | Client-side UX restriction on backspace navigation; does not change the char-state model (still 2-tone) or SC1's "word correct iff all chars correct" semantics. Not a new gap |
| `apps/engine/src/engine.ts` | 8 | `dealNextPassage`/`shuffle` imported, never called | ℹ️ Info (unchanged) | Dead deck machinery, not a functional gap given SC4 is satisfied via the `excludeId` mechanism |

### Human Verification Required

None. The SC3 ranking regression and the negative-delta side effect are both fully resolvable from
code + the test suite's own explicit self-documentation ("proving ranking no longer sorts by finish
time") + a hand-traced fixture — no visual/live-demo judgment call is needed to confirm either. Gap A
and Gap B remain resolved via the existing accepted overrides (no new human verification needed for
those).

### Deferred Items

None. Checked all later milestone phases (04 Reconnect, 04.1, 05 Frontend Polish, 06 Deploy +
Hardening, 07 Split into N-tier, 07.1) — none address results-board ranking. This is a live gap for
Phase 3, not deferred work.

### Advisory (New Scope, Unevidenced)

None — this section is included per the re-verification evidence gate (#3304) even though empty. The
one new-scope Step 7 finding this pass (the ranking regression, plus its negative-delta side effect) is
not advisory: it is a direct Step 3 truth failure against a still-standing ROADMAP.md success criterion
and PROJECT.md requirement, backed by deterministic evidence (the diff in commit 428090c, the test
file's own comment documenting the behavior change, a hand-traced fixture showing a negative delta, and
a clean re-run of the full test suite showing no test currently asserts the old finish-time-primary
ordering). It is therefore reported as a `gaps:` item, not downgraded to advisory.

## This looks intentional — override suggestion for the new SC3 gap

```yaml
overrides:

  - must_have: "Results board ranks by finish time primary, WPM tiebreak (ROADMAP SC3 / PROJECT.md REQ-08)"
    reason: >
      Commit 428090c deliberately replaced finish-time ranking with a wpm*accuracy+finish-bonus score,
      reasoning that a fast-but-sloppy typist unfairly beat a slower-but-more-accurate one under pure
      finish-time ranking. This is a considered design change, not an oversight — but it was made a day
      after the Gap A/B override sign-off, without updating ROADMAP.md SC3 or PROJECT.md's requirement
      text to match, and without a corresponding override entry. If this ranking change is intentional
      and final, accept it here AND update ROADMAP.md Phase 3 SC3 + PROJECT.md's requirement line to
      describe the new formula, so the written contract and the code agree. Also fix winnerTimeMs/
      deltaMs (ResultsBoard.tsx lines 67, 140) to derive from the earliest finishTimeMs among finishers,
      not ranked[0], so the Delta column cannot render a negative value.
    accepted_by: "{pending human decision}"
    accepted_at: "{pending}"
```

This override is **suggested, not applied** (body-fenced, per the convention noted above) —
`accepted_by`/`accepted_at` are placeholders and this block is NOT present in this file's frontmatter
`overrides:` array and does NOT count toward `overrides_applied` or the passing score. Until a human
fills these in (or the ranking code is reverted/fixed to match the standing SC3 text), this phase's
status remains `gaps_found`.

## Gaps Summary

Phase 3 remains, in substance, a solid and well-tested race track: 94 engine tests, 59 shared/gateway
tests, and 89 web tests all pass with no regressions; the WPM formula, passage corpus, no-repeat
mechanism, "within 1s" results delivery, and rematch/countdown flow all independently re-verify clean
against the current codebase. The two previously-accepted overrides (Gap A: 2-tone char-color model;
Gap B: orphaned word-correctness aggregator) were re-checked against the current code and remain
correctly resolved — neither has regressed, and both are carried forward verbatim per instruction, now
correctly recorded in frontmatter `overrides:` (the prior VERIFICATION.md had the accepted text only in
the markdown body, never promoted to frontmatter — a formatting defect fixed in this pass, not a
re-litigation of the decision).

However, this re-verification is **not** a clean `closed_via_override` pass. A separate feature commit
(428090c, landed 2026-09-22, one day after the override sign-off) changed the results-board ranking
formula from finish-time-primary/WPM-tiebreak to `wpm*accuracy + finish-bonus`, and as a side effect the
Delta column can now render a negative value for a player who finished earlier than the (new) top-ranked
player. This directly contradicts ROADMAP.md's Phase 3 SC3 text ("ranking (finish time primary, WPM
tiebreaker)") and PROJECT.md's Active requirements list ("Race-end screen: WPM + accuracy board, ranked
by finish time then WPM"), neither of which has been updated to match. The change is well-reasoned and
appears intentional (documented in the commit message and self-acknowledged in the test suite's own
comments), but it was never reconciled with the standing written contract, and it does not match either
existing accepted override under fuzzy matching. Per the Escalation Gate this agent implements: this is
surfaced to the developer as a new gap with a suggested override, rather than silently accepted or
silently reverted. Status is `gaps_found` until a human either (a) accepts the new ranking formula as an
override, updates ROADMAP.md/PROJECT.md, and fixes the negative-delta side effect, or (b) restores
finish-time-primary ranking.

---

_Verified: 2026-09-23_
_Verifier: Claude (gsd-verifier)_
