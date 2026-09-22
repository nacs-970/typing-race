---
phase: 05-frontend-polish
verified: 2026-09-23T00:00:00Z
status: human_needed
score: 2/5 must-haves verified
covered_files:

  - ".planning/ROADMAP.md"
  - ".planning/phases/05-frontend-polish/05-01-PLAN.md"
  - ".planning/phases/05-frontend-polish/05-01-SUMMARY.md"
  - ".planning/phases/05-frontend-polish/05-02-PLAN.md"
  - ".planning/phases/05-frontend-polish/05-02-SUMMARY.md"
  - ".planning/phases/05-frontend-polish/05-03-PLAN.md"
  - ".planning/phases/05-frontend-polish/05-03-SUMMARY.md"
  - ".planning/phases/05-frontend-polish/05-04-PLAN.md"
  - ".planning/phases/05-frontend-polish/05-04-SUMMARY.md"
  - ".planning/phases/05-frontend-polish/05-VALIDATION.md"
  - ".planning/phases/05.1-add-reconnect-progress-bar-fix-version-mismatch-toast-wiring/05.1-01-SUMMARY.md"
  - ".planning/phases/05.1-add-reconnect-progress-bar-fix-version-mismatch-toast-wiring/05.1-CONTEXT.md"
  - "apps/engine/src/engine.ts"
  - "apps/web/src/App.tsx"
  - "apps/web/src/__tests__/ReconnectBanner.test.tsx"
  - "apps/web/src/__tests__/ToastQueue.test.tsx"
  - "apps/web/src/components/CountdownView.tsx"
  - "apps/web/src/components/GraceBanner.tsx"
  - "apps/web/src/components/LobbyView.tsx"
  - "apps/web/src/components/RaceHud.tsx"
  - "apps/web/src/components/RaceView.tsx"
  - "apps/web/src/components/ReconnectBanner.tsx"
  - "apps/web/src/components/ResultsBoard.tsx"
  - "apps/web/src/components/ToastQueue.tsx"
  - "apps/web/src/core/cursor-manager.ts"
  - "apps/web/src/core/layout.ts"
  - "apps/web/src/core/typing-engine.ts"
  - "apps/web/src/net/race-client.ts"
  - "apps/web/src/net/ws.ts"
  - "apps/web/src/store/connection.ts"
  - "apps/web/src/store/toast.ts"
  - "packages/shared/src/messages.ts"
  - "packages/shared/src/passages.ts"

covered_digest: "v1:sha256:881928cc7fc7965397e28cb4602ff567770f15e193eebf31850d5f13ae26f3b1"
behavior_unverified: 3
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 2/5
  gaps_closed:
    - "Disconnect shows 'Reconnecting… (5s)' progress bar (Success Criterion 4, clause 1)"
    - "Distinct error toast for 'version mismatch' case — fixture-only unreachable test removed"
  gaps_remaining: []
  regressions: []
advisory: []
behavior_unverified_items:

  - truth: "Two side-by-side browser windows show opponent cursor moving smoothly across the passage with no visible jitter at 60fps, verified under simulated 100ms RTT (Success Criterion 1)"
    test: "Open two browser tabs/windows joined to the same room, artificially delay one client's WebSocket messages by ~100ms (e.g. via browser devtools network throttling or a proxy), race, and visually confirm the opponent cursor advances smoothly without visible stutter/snapping."
    expected: "Opponent cursor motion appears continuous at 60fps with no visible jitter, snapping, or backward jumps, even with 100ms of added network latency."
    why_human: "Unchanged since the 2026-09-16 pass. The interpolation math (100ms BUFFER_MS ring buffer, linear lerp, 150ms clamped extrapolation, immediate rewind-snap on backspace) is still implemented and unit-tested in cursor-manager.test.ts (12 tests), but no automated test measures actual frame-to-frame visual smoothness under RTT — that requires a human eyeball or a real browser profiling session. 05.1 did not touch this."
  - truth: "CSS transform: translate3d() used for cursor positioning outside the React tree — React DevTools profile shows no per-frame React renders for cursor motion (Success Criterion 2)"
    test: "Open React DevTools Profiler, start a race with an opponent cursor moving, record a profiling session for several seconds of active cursor motion, and inspect the commit list."
    expected: "Zero React commits are attributed to cursor-position changes during the recording window (the .cursor-overlay container and its children are mutated exclusively via CursorManager.renderFrame()'s direct DOM writes to `style.transform`, not via React state/props)."
    why_human: "Unchanged since the 2026-09-16 pass. `cursor-manager.ts:221` still mutates `dom.root.style.transform` directly inside a requestAnimationFrame loop with no React state/setState calls. RaceView.test.tsx test 5 ('mounts isolated cursor overlay without inline opponent cursor children') still only asserts DOM shape at mount, not a runtime commit count. No React DevTools Profiler run has been recorded. 05.1 did not touch this."
  - truth: "Reconnect success restores the prior in-progress race view (passage, own char states, WPM, countdown, lobby roster, grace banner, opponent cursors) after a `rejoined_room` frame (Success Criterion 4, clause 2)"
    test: "Disconnect a client mid-race (kill the WebSocket), let it auto-reconnect, and confirm the UI resumes showing the correct in-progress passage state, per-char correctness, own WPM, and opponent cursor positions with no visible reset/flash."
    expected: "After a `rejoined_room` frame is dispatched, RaceView/CountdownView/LobbyView render exactly the restored state with no incorrect flash frame or dropped opponent cursor."
    why_human: "New finding on this re-verification pass (the previous pass never reached this level of scrutiny on clause 2 because clause 1 was an outright FAILED/missing feature). `race-client.ts`'s `rejoined_room` branch (lines 263-308) does perform a real multi-field state restoration by direct code inspection — this is not stub code — but grep of every test file under `apps/web/src/__tests__/` (`race-client.test.ts`, `App.test.tsx`) shows no test dispatches a `rejoined_room` frame; the restoration is a state-transition truth with code present and wired but behaviorally unexercised."
human_verification:

  - test: "Open two browser tabs/windows joined to the same room, artificially delay one client's WebSocket messages by ~100ms, race, and visually confirm the opponent cursor advances smoothly without visible stutter/snapping."
    expected: "Opponent cursor motion appears continuous at 60fps with no visible jitter under 100ms simulated RTT."
    why_human: "Real-time visual smoothness judgment; no automated test measures this."
  - test: "Record a React DevTools Profiler session during active opponent cursor motion and inspect the commit list."
    expected: "Zero React commits attributed to cursor-position changes."
    why_human: "Requires an actual DevTools Profiler run; the only related test checks DOM structure, not runtime commit counts."
  - test: "Disconnect a client mid-race and confirm reconnect restores the exact in-progress view (passage, char states, WPM, opponent cursors) with no visible reset/flash."
    expected: "UI resumes exactly where it left off after `rejoined_room`, no incorrect flash frame."
    why_human: "No automated test dispatches a `rejoined_room` frame through race-client.ts to assert the resulting restored state; only static code inspection backs this today."
audit_acknowledged:
  milestone: v1.0
  at: 2026-09-22
  status: human_needed
---

# Phase 5: Frontend Polish Verification Report

**Phase Goal:** The "two-laptop demo wow" moment. Smooth 60fps opponent cursors via 30Hz server broadcast + 100ms client interpolation buffer + rAF lerp, server-synced countdown UI, reconnect progress bar, distinct error toasts.
**Verified:** 2026-09-23
**Status:** human_needed
**Re-verification:** Yes — after Phase 05.1's gap-closure work (`ReconnectBanner.tsx` + version-mismatch toast cleanup), re-checking against the current codebase and current test suite (not trusting 05.1-SUMMARY.md's or 05.1-VERIFICATION.md's claims — code and tests read directly).

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth (Roadmap SC) | Status | Evidence |
|---|---------|------------|-------------|
| 1 | Two side-by-side browser windows show opponent cursor moving smoothly at 60fps under simulated 100ms RTT | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Unchanged since original pass. `cursor-manager.ts` still implements `BUFFER_MS=100`, `MAX_EXTRAPOLATE_MS=150`, `calculateInterpolatedIndex` linear lerp, rewind-snap on backspace; 12 unit tests pass. No profiling/visual artifact demonstrates jitter-free rendering under 100ms RTT. |
| 2 | `transform: translate3d()` used outside React tree; DevTools profile shows 0 per-frame React renders | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Unchanged since original pass. `cursor-manager.ts:221` still mutates `dom.root.style.transform` directly inside its rAF loop, no React state involved. No actual DevTools Profiler run recorded. |
| 3 | Lobby shows per-player "ready" indicator; countdown ticks down from `startAtServerMs - clockOffset`, not local clock | ✓ VERIFIED | Re-confirmed by direct read: `LobbyView.tsx` still has guest ✓Ready checkmarks (`p.isReady`), host toggle (`allGuestsReady`), `handleToggleReady` → `set_ready`. `CountdownView.tsx:22-23` still computes `serverNow = Date.now() + offsetMs; left = startsAtServerMs - serverNow` — server-clock-anchored. `apps/engine/src/engine.ts` still handles `set_ready`. No regressions from the later, unrelated UI work (settings panel, cursor scaling, win-condition scoring) — none of it touches this code path. |
| 4 | Disconnect shows "Reconnecting… (5s)" progress bar; reconnect success restores prior view; reconnect failure shows distinct toast ("Lost connection — room lost" vs "Server restarted") | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | **Both original FAILED gaps are closed.** Clause (a) "Reconnecting… (Ns)" progress bar: `ReconnectBanner.tsx` now exists, is imported (`App.tsx:12`) and unconditionally mounted (`App.tsx:367`) inside the render tree, reads the real `useConnectionStore().status` (via `store-bridge.ts` ← real WS lifecycle events in `race-client.ts`), and is exercised by 6 passing behavioral tests in `ReconnectBanner.test.tsx` (not-shown-before-first-open, drop-after-open, elapsed-second counting, hide-on-reopen, session-takeover suppression) — genuinely ✓ VERIFIED. Clause (c) distinct toasts: `App.tsx`'s error switch (lines 187-229) maps `ROOM_NOT_FOUND`/`SESSION_INVALID` → "Room Lost" and `SERVER_SHUTTING_DOWN` → "Server Restarting"; `App.test.tsx` now drives the `SERVER_SHUTTING_DOWN` case through the real `ws.dispatch()` → App error switch → rendered toast text, a genuine behavioral test (not fixture-only) — ✓ VERIFIED. Clause (b) reconnect-success state restoration: `race-client.ts`'s `rejoined_room` branch (lines 263-308) does restore `passageText`, `ownCharStates`, `ownWpm`, `countdownStartsAtServerMs`, `lobbyPlayers`, `graceBanner`, and opponent cursors by direct code inspection — present and wired — but no test in `race-client.test.ts` or `App.test.tsx` dispatches a `rejoined_room` frame to prove the restoration behaviorally. This is a state-transition truth (Step 3's behavior-dependence rule) with no behavioral evidence, so the composite truth stays PRESENT_BEHAVIOR_UNVERIFIED overall — see human_verification. |
| 5 | WPM rounded to integer with raw+net breakdown on hover; time-delta-to-winner shown on results | ✓ VERIFIED | Re-confirmed: `RaceHud.tsx:72-73` still computes `Math.round(stats.netWpm)`/`Math.round(stats.rawWpm)`. `ResultsBoard.tsx:141-144` still computes `deltaText = i===0 ? "Winner" : "+${(deltaMs/1000).toFixed(1)}s"`. The later win-condition scoring change (`wpm*accuracy` + finish bonus, commit `428090c`) changed ranking order only — it did not remove or alter the WPM-rounding or time-delta display logic; `RaceHud.test.tsx` and `ResultsBoard.test.tsx` still pass (see spot-checks). |

**Score:** 2/5 truths fully verified (3 present-but-behavior-unverified, 0 failed)

**Change from the 2026-09-16 pass:** score is still "2/5" numerically, but the composition changed for the better — both previously FAILED truths (missing reconnect progress bar; unreachable version-mismatch toast test) are now closed with real, wired, behaviorally-tested code. SC4 did not simply flip to VERIFIED, though: closer scrutiny of its "reconnect success restores prior view" clause (only reachable once the progress-bar clause stopped masking it as an outright FAILED item) surfaced that this specific restoration path has no behavioral test — a genuine, narrower finding, not a regression introduced by 05.1.

### Plan-Level Must-Haves (Additional Detail)

| Plan | Must-have | Status |
|------|-----------|--------|
| 05-01 | Headless `TypingEngine` (keystroke, backspace, scoring) | ✓ Verified — unchanged |
| 05-01 | `CursorManager` 100ms buffer + lerp + 150ms extrapolation + rewind snap | ✓ Verified — unchanged |
| 05-01 | `RaceClient` singleton, cookie sessionToken, store dispatch | ✓ Verified — unchanged |
| 05-02 | Tailwind v4 botanical palette | ✓ Verified — unchanged (later settings-panel theme presets are additive, do not remove the base palette) |
| 05-02 | `PassageLayout` via `@chenglou/pretext`, O(1) coordinate lookup | ✓ Verified — unchanged |
| 05-02 | translate3d overlay, 0 React commits | ⚠️ Present, behavior unverified (see SC2) |
| 05-03 | `set_ready` wire frame + server dispatch | ✓ Verified — unchanged |
| 05-03 | Lobby readiness UI + passage filters | ✓ Verified — unchanged |
| 05-03 | Server-synced countdown overlay | ✓ Verified — unchanged |
| 05-04 | Race HUD, Net WPM integer, tooltip | ✓ Verified — unchanged |
| 05-04 | Stacked toast notifications | ✓ Verified — version-mismatch overclaim removed by 05.1, remaining cases correctly wired |
| 05-04 | Results board podium medals + time deltas | ✓ Verified — unchanged despite later win-condition/scoring-formula change |
| 05.1 | `ReconnectBanner` component, mounted, driven by real connection state | ✓ Verified — see SC4 clause (a) |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/core/typing-engine.ts` | Headless TypingEngine | ✓ VERIFIED | Unchanged |
| `apps/web/src/core/cursor-manager.ts` | CursorManager w/ interpolation | ✓ VERIFIED | Unchanged |
| `apps/web/src/net/race-client.ts` | RaceClient singleton | ✓ VERIFIED | Unchanged core reconnect/rejoin logic |
| `apps/web/src/core/layout.ts` | PassageLayout (pretext) | ✓ VERIFIED | Unchanged |
| `apps/web/src/components/RaceView.tsx` | Decoupled presentational track | ✓ VERIFIED | translate3d overlay confirmed; 2 new tests (7, 8) added for later win-condition scoring, unrelated to Phase 5 scope |
| `apps/web/src/components/LobbyView.tsx` | Ready indicators, filters, host controls | ✓ VERIFIED | Unchanged |
| `apps/web/src/components/CountdownView.tsx` | Server-synced countdown | ✓ VERIFIED | Unchanged |
| `apps/web/src/components/RaceHud.tsx` | WPM display + tooltip | ✓ VERIFIED | Unchanged |
| `apps/web/src/components/ToastQueue.tsx` | Stacked toast queue | ✓ VERIFIED | Unchanged; fixture-only version-mismatch assertion removed from its test file by 05.1 |
| `apps/web/src/components/ResultsBoard.tsx` | Podium medals, time deltas | ✓ VERIFIED | Unchanged despite scoring-formula change |
| `apps/web/src/components/GraceBanner.tsx` | Grace countdown banner | ✓ VERIFIED (different feature) | Race-finish grace banner, distinct from `ReconnectBanner`; both coexist in `App.tsx` without conflict |
| `apps/web/src/components/ReconnectBanner.tsx` | "Reconnecting… (Ns)" progress bar | ✓ VERIFIED (new since 05.1) | 75 lines, substantive state machine + progress-bar render, imported `App.tsx:12`, mounted unconditionally `App.tsx:367`, real `useConnectionStore` subscription, 6 passing behavioral tests |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `App.tsx` error handler | `ToastQueue` | `addToast()` with code-mapped title/body | ✓ WIRED | ROOM_NOT_FOUND/SESSION_INVALID → "Room Lost"; SERVER_SHUTTING_DOWN → "Server Restarting" (behaviorally tested by `App.test.tsx`); ROOM_FULL/ROOM_CLOSED/RATE_LIMITED also present. No `VERSION_MISMATCH` branch — confirmed intentional (grep for `VERSION_MISMATCH`/"Version Mismatch" across `apps/` and `packages/` returns 0 hits). |
| `useConnectionStore.status` | `ReconnectBanner` | `useConnectionStore((s) => s.status)` hook | ✓ WIRED | Was NOT WIRED at the original pass; now genuinely wired and behaviorally tested. |
| `race-client.ts` WS lifecycle (`connecting`/`open`/`closed`) | `useConnectionStore` | `setConnectionStore()` via `store-bridge.ts` | ✓ WIRED | Confirmed by direct code read: `race-client.ts:72,78,98` call `setConnectionStore`, which calls `useConnectionStore.setState()` — real store, not a mock. |
| `race-client.ts` `rejoined_room` | React stores (`race`, `cursor`, `clock`) | `setRaceState`/`setCursorState`/`setClockState` | ✓ WIRED (code) / ⚠️ behavior unverified | State restoration confirmed present by inspection; no test drives a `rejoined_room` frame — see SC4 clause (b) above. |
| `CountdownView` | `useClockStore.offsetMs` | server-synced clock offset | ✓ WIRED | Unchanged |
| `LobbyView` Ready toggle | server `set_ready` dispatch | `ws.send({type:"set_ready"})` → `apps/engine/src/engine.ts` | ✓ WIRED | Unchanged |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `ReconnectBanner` | `status` | `useConnectionStore` ← real WS `open`/`close` events via `store-bridge.ts` | Yes | ✓ FLOWING |
| `ReconnectBanner` | `elapsedMs`/`seconds`/`percent` | `Date.now()` delta since drop, ticked by real `setInterval` | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Typecheck (all 4 workspaces) | `bun run typecheck` | 0 errors, packages/shared + apps/web + apps/gateway + apps/engine all clean | ✓ PASS |
| Backend test suite | `bun test packages/shared apps/gateway apps/engine` | 153 pass, 0 fail, 121426 expect() calls, 23 files | ✓ PASS |
| Web test suite | `bun run --cwd apps/web test -- --run` | 89 passed, 13 files | ✓ PASS |
| Version-mismatch dangling reference search | `grep -rn -i "version_mismatch\|version mismatch" apps packages` | 0 hits | ✓ PASS — confirms gap 2 stays closed |
| Reconnect progress bar text search | `grep -n "Reconnecting" apps/web/src/components/ReconnectBanner.tsx` | present, wired, tested | ✓ PASS — confirms gap 1 is closed |
| `rejoined_room` behavioral coverage search | `grep -rn "rejoined_room" apps/web/src/__tests__/` | 0 hits | ✗ FAIL — confirms new behavior_unverified_items[2] finding |

**Test count note:** the previous pass (05.1-VERIFICATION.md) recorded 154 backend tests and 85 web tests; this pass sees 153 backend and 89 web. Both counts differ from the prior pass, and every delta traces to commits outside Phase 5's own scope: `git log --since=2026-09-16 -- packages/shared apps/gateway apps/engine` shows only later gap-closure commits from Phases 03.1/04.1/06.1/07.1 (session-takeover fixes, draining-latch fix, passage-bucketing fix, word-correctness revert); web test file changes trace to Phase 03.1's word-correctness UI being added then reverted, two chart features (`PerformanceChart`/`WpmTimelineChart`) being added then reverted, new `RaceView.test.tsx` tests 7/8 for the later win-condition scoring change, and the new `ReconnectBanner.test.tsx` (6 tests) and `App.test.tsx` files from Phase 05.1. None of these touch a Phase 5 artifact's behavior. All 153 backend and 89 web tests currently pass — no regression.

### Requirements Coverage

There is no REQUIREMENTS.md in this project. Cross-referenced against `.planning/PROJECT.md` and `ROADMAP.md`'s phase-level requirement mapping.

| Requirement | Source | Description | Status | Evidence |
|-------------|--------|-------------|--------|----------|
| REQ-06 | ROADMAP.md Phase 5 + Phase 05.1 | Live opponent cursors — interpolation polish; reconnect UX | ⚠️ Partially satisfied | Interpolation math is implemented and unit-tested but the "smooth 60fps... no jitter" outcome remains behaviorally unverified (SC1/SC2, unchanged). Reconnect UX (progress bar, restored view, distinct toasts) is now implemented and mostly behaviorally tested — one sub-clause (state restoration on rejoin) still lacks a behavioral test. |

### Decision Coverage

`gsd_run query check.decision-coverage-verify` against `05-CONTEXT.md`: 20/20 trackable decisions honored by shipped artifacts, 0 not honored. Non-blocking gate; recorded here for drift visibility only.

### Anti-Patterns Found

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` debt markers in `App.tsx`, `ReconnectBanner.tsx`, `race-client.ts`, `connection.ts`, or `store-bridge.ts`. No stub `return null`-only components, no empty handlers, no hardcoded-empty props flowing to render. No new-scope Step 7 findings on this pass (re-verification evidence gate, #3304): nothing was flagged that lacked deterministic evidence.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | none found | — | — |

### Advisory (New Scope, Unevidenced)

None. This re-verification pass raised no new-scope Step 7 findings without deterministic evidence.

### Human Verification Required

See `human_verification` in frontmatter — 3 items:

1. Opponent-cursor jitter-under-100ms-RTT visual check (SC1, unchanged since 2026-09-16).
2. React DevTools Profiler zero-commit check (SC2, unchanged since 2026-09-16).
3. Reconnect-mid-race state-restoration check (SC4 clause 2) — new finding this pass: the restoration code is present and wired but has no behavioral test exercising `rejoined_room`.

All three require an actual browser/DevTools session; none can be settled by static analysis alone.

**This looks like it may already be resolved by a human, unrecorded.** If someone has actually run the two-browser 100ms-RTT visual check (SC1) and/or an actual React DevTools Profiler session during opponent cursor motion (SC2), those two items can be closed via override rather than by re-running them here:

```yaml
overrides:

  - must_have: "Two side-by-side browser windows show opponent cursor moving smoothly at 60fps under simulated 100ms RTT"
    reason: "<who ran the two-browser RTT check, when, what they observed>"
    accepted_by: "<name>"
    accepted_at: "<ISO timestamp>"
  - must_have: "transform: translate3d() used outside React tree; DevTools profile shows 0 per-frame React renders"
    reason: "<who ran the DevTools Profiler session, when, commit count observed>"
    accepted_by: "<name>"
    accepted_at: "<ISO timestamp>"
```

Note the arithmetic: accepting both overrides moves the score to 4/5, but overall status **stays `human_needed`** — item 3 (SC4 clause 2, reconnect state restoration) is a newly-surfaced gap with no override requested and no test yet, so it still emits its own human-verification item regardless of SC1/SC2's disposition. The cheapest legitimate way to close item 3 is a test, not an override: `App.test.tsx` already has the exact harness needed (MockWebSocket stub + `ws.dispatch()`) — one test dispatching a `rejoined_room` frame and asserting the resulting restored store/UI state would close it with real behavioral evidence. Only `passed` (all three items resolved, whether by override or by evidence) allows the phase to close cleanly.

### Gaps Summary

**Zero gaps remain.** Both FAILED truths from the 2026-09-16 verification are closed, confirmed by direct code and test inspection (not by trusting 05.1-SUMMARY.md's or 05.1-VERIFICATION.md's claims):

1. **Reconnect progress bar** — `ReconnectBanner.tsx` now exists, is mounted reachably in `App.tsx`, is driven by the real `useConnectionStore` (itself driven by real WebSocket lifecycle events through `race-client.ts` → `store-bridge.ts`), and has 6 passing behavioral tests covering the exact state-transition truths (first-connect suppression, drop-after-open trigger, elapsed-time counting, reopen-hides, session-takeover-suppression).
2. **Version-mismatch toast overclaim** — the fixture-only test asserting an unreachable string is removed; zero `VERSION_MISMATCH` references remain anywhere in source or tests; the correctly-judged decision (no independently-versioned client/server deploy in this monorepo, so no real version-skew scenario exists) still holds.

The status is `human_needed`, not `passed`, because two pre-existing, unchanged human-verification items (SC1 jitter-under-RTT, SC2 DevTools Profiler commit count) remain open exactly as they were on 2026-09-16 — 05.1 never touched these, and no evidence (test or otherwise) has appeared to close them. Additionally, this pass's closer read of the now-real SC4 implementation surfaced one further behavior-unverified sub-clause: `race-client.ts`'s `rejoined_room` state-restoration logic is present and wired but has no dispatched-frame test proving the restoration behaviorally — this is a genuine finding, not a regression, and does not revert the two closed gaps.

The large amount of later, unrelated UI/feature work since Phase 5 (player-settings panel with theme presets, cursor opacity/scaling changes, win-condition scoring formula change, chart features added then reverted, multi-phase reconnect/session-takeover hardening) was checked for collateral damage to Phase 5's own success criteria and found clean: typecheck is 0-error across all 4 workspaces, 153/153 backend tests and 89/89 web tests pass, and every Phase-5-owned code path (cursor interpolation constants, countdown server-clock math, lobby ready toggling, WPM rounding/tooltip, results time-delta display) was re-read directly and confirmed unchanged in substance.

---

_Verified: 2026-09-23T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
