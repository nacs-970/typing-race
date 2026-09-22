---
phase: 05-frontend-polish
verified: 2026-09-16T15:40:00Z
status: gaps_found
score: 2/5 must-haves verified
covered_files:

  - ".planning/phases/05-frontend-polish/05-01-PLAN.md"
  - ".planning/phases/05-frontend-polish/05-01-SUMMARY.md"
  - ".planning/phases/05-frontend-polish/05-02-PLAN.md"
  - ".planning/phases/05-frontend-polish/05-02-SUMMARY.md"
  - ".planning/phases/05-frontend-polish/05-03-PLAN.md"
  - ".planning/phases/05-frontend-polish/05-03-SUMMARY.md"
  - ".planning/phases/05-frontend-polish/05-04-PLAN.md"
  - ".planning/phases/05-frontend-polish/05-04-SUMMARY.md"
  - ".planning/phases/05-frontend-polish/05-VALIDATION.md"
  - "apps/engine/src/engine.ts"
  - "apps/web/src/App.tsx"
  - "apps/web/src/components/CountdownView.tsx"
  - "apps/web/src/components/GraceBanner.tsx"
  - "apps/web/src/components/LobbyView.tsx"
  - "apps/web/src/components/RaceHud.tsx"
  - "apps/web/src/components/RaceView.tsx"
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

covered_digest: "v1:sha256:3e47ae3b52162eb5fa1038e3eeb91a818aeb1cc082734064f59ca92c928f4ea7"
behavior_unverified: 2
overrides_applied: 0
gaps:

  - truth: "Disconnect shows 'Reconnecting… (5s)' progress bar (Success Criterion 4, clause 1)"
    status: failed
    reason: >
      No component in apps/web/src renders a reconnect-in-progress UI keyed off the
      local client's own connection status. `useConnectionStore().status` transitions
      to "closed" on socket close (race-client.ts:98) and the client silently retries
      after a fixed 1s timeout (race-client.ts:100), but no component subscribes to
      `status === "closed"` to render any progress indicator, countdown text, or "Xs"
      label. The only "5s" countdown text in the codebase is GraceBanner, which is
      the race-finish grace-period banner (unrelated feature, built for a different
      purpose) and a hardcoded string inside ToastQueue.test.tsx that is never
      produced by production code (see missing item 2 below).
    artifacts:
      - path: "apps/web/src/App.tsx"
        issue: "Renders GraceBanner, disconnect toasts for OTHER players (Phase 4 feature), and ToastQueue, but nothing reads connectionStore.status to show own-client reconnect progress."
      - path: "apps/web/src/net/race-client.ts"
        issue: "Sets status to 'closed' and auto-reconnects after 1s, but exposes no remaining-time/attempt state for a progress bar to bind to."
    missing:
      - "A component (or App.tsx render branch) that shows 'Reconnecting… (Xs)' with a shrinking/filling progress bar while connectionStore.status === 'closed', wired to the real reconnect timer."
  - truth: "Distinct error toast for 'version mismatch' case (claimed by 05-04-SUMMARY.md: '4 cases: lost connection / server restart / rate limit / version mismatch')"
    status: failed
    reason: >
      No VERSION_MISMATCH (or equivalent) error code exists anywhere in the wire
      protocol (`packages/shared/src/messages.ts`) or is emitted by any server code
      in apps/engine or apps/gateway. App.tsx's error-code-to-toast switch (lines
      178-223) only handles ROOM_DOES_NOT_EXIST, ROOM_NOT_FOUND, ROOM_FULL,
      SESSION_INVALID, SERVER_SHUTTING_DOWN, and RATE_LIMITED — there is no
      version-mismatch branch and no version field is ever compared client- or
      server-side. ToastQueue.test.tsx asserts a "Version Mismatch" toast renders
      correctly, but the test calls `addToast()` directly with a hardcoded string —
      it exercises the toast card renderer, not any production error path. This is a
      SUMMARY.md claim not backed by the codebase (roadmap Success Criterion 4 itself
      only names two toast cases — "room lost" vs "server restarted" — both of which
      ARE correctly wired; the 4-case claim originates from the plan/SUMMARY text,
      not the roadmap contract).
    artifacts:
      - path: "apps/web/src/App.tsx"
        issue: "Error-code switch (lines 178-223) has no VERSION_MISMATCH branch."
      - path: "packages/shared/src/messages.ts"
        issue: "No version-mismatch error code defined in the error schema."
      - path: "apps/web/src/__tests__/ToastQueue.test.tsx"
        issue: "Test passes a hardcoded 'Version Mismatch' string directly to addToast() — proves the toast card can render arbitrary copy, not that production code ever produces this toast."
    missing:
      - "A version/protocol-mismatch detection mechanism server- or client-side, plus a matching error code and App.tsx toast branch — or, if genuinely out of scope, correct the 05-04-SUMMARY.md claim."

deferred: []
behavior_unverified_items:

  - truth: "Two side-by-side browser windows show opponent cursor moving smoothly across the passage with no visible jitter at 60fps, verified under simulated 100ms RTT (Success Criterion 1)"
    test: "Open two browser tabs/windows joined to the same room, artificially delay one client's WebSocket messages by ~100ms (e.g. via browser devtools network throttling or a proxy), race, and visually confirm the opponent cursor advances smoothly without visible stutter/snapping."
    expected: "Opponent cursor motion appears continuous at 60fps with no visible jitter, snapping, or backward jumps, even with 100ms of added network latency."
    why_human: "This is a real-time rendering/perception judgment (jitter, smoothness) under simulated network conditions. The interpolation math (100ms BUFFER_MS ring buffer, linear lerp, 150ms clamped extrapolation, immediate rewind-snap on backspace) is implemented and unit-tested in cursor-manager.test.ts, but no automated test measures actual frame-to-frame visual smoothness under RTT — that requires a human eyeball or a real browser profiling session."
  - truth: "CSS transform: translate3d() used for cursor positioning outside the React tree — React DevTools profile shows no per-frame React renders for cursor motion (Success Criterion 2)"
    test: "Open React DevTools Profiler, start a race with an opponent cursor moving, record a profiling session for several seconds of active cursor motion, and inspect the commit list."
    expected: "Zero React commits are attributed to cursor-position changes during the recording window (the .cursor-overlay container and its children are mutated exclusively via CursorManager.renderFrame()'s direct DOM writes to `style.transform`, not via React state/props)."
    why_human: "RaceView.test.tsx test #5 ('mounts isolated cursor overlay without inline opponent cursor children') only asserts the React render tree has zero `.opponent-cursor` elements at mount time — it is a structural/DOM-shape assertion, not a runtime commit-count measurement. Code inspection of cursor-manager.ts confirms renderFrame() only calls `dom.root.style.transform = ...` (no setState, no React API) inside its rAF loop, which is strong static evidence, but the actual React DevTools Profiler run required by the success criterion's own wording has not been executed and produces no artifact a grep can verify."
human_verification:

  - test: "Open two browser tabs/windows joined to the same room, artificially delay one client's WebSocket messages by ~100ms, race, and visually confirm the opponent cursor advances smoothly without visible stutter/snapping."
    expected: "Opponent cursor motion appears continuous at 60fps with no visible jitter under 100ms simulated RTT."
    why_human: "Real-time visual smoothness judgment; no automated test measures this."
  - test: "Record a React DevTools Profiler session during active opponent cursor motion and inspect the commit list."
    expected: "Zero React commits attributed to cursor-position changes."
    why_human: "Requires an actual DevTools Profiler run; the only related test checks DOM structure, not runtime commit counts."
audit_acknowledged:
  milestone: v1.0
  at: 2026-09-22
  status: gaps_found
---

# Phase 5: Frontend Polish Verification Report

**Phase Goal:** The "two-laptop demo wow" moment. Smooth 60fps opponent cursors via 30Hz server broadcast + 100ms client interpolation buffer + rAF lerp, server-synced countdown UI, reconnect progress bar, distinct error toasts.
**Verified:** 2026-09-16
**Status:** gaps_found
**Re-verification:** No — initial verification (closing the documented "no post-execution verification" gap flagged by the v1.0 milestone audit; 05-VALIDATION.md was a pre-execution draft with all 12 per-task checkboxes unresolved and `wave_0_complete: false`)

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth (Roadmap SC) | Status | Evidence |
|---|---------|------------|-------------|
| 1 | Two side-by-side browser windows show opponent cursor moving smoothly at 60fps under simulated 100ms RTT | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `cursor-manager.ts` implements `BUFFER_MS=100`, `MAX_EXTRAPOLATE_MS=150`, linear lerp (`calculateInterpolatedIndex`), and immediate rewind-snap on backspace; 9 unit tests in `cursor-manager.test.ts` pass. No test/profiling artifact demonstrates actual jitter-free rendering under 100ms RTT — see human_verification. |
| 2 | `transform: translate3d()` used outside React tree; DevTools profile shows 0 per-frame React renders | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `cursor-manager.ts:215` mutates `dom.root.style.transform` directly inside a `requestAnimationFrame` loop (`renderFrame`) with no React state/setState calls — strong static evidence. `RaceView.test.tsx` test 5 only asserts the React tree has 0 `.opponent-cursor` DOM nodes at mount, not 0 commits during motion. No actual DevTools Profiler run recorded — see human_verification. |
| 3 | Lobby shows per-player "ready" indicator; countdown ticks down from `startAtServerMs - clockOffset`, not local clock | ✓ VERIFIED | `LobbyView.tsx`: guest ✓/Waiting… checkmarks (`p.isReady`), host "Start Race"/"Force Start Race" toggle (`allGuestsReady`), Ready Up button falls back to `ws.send({type:"set_ready"})` when no prop passed. `CountdownView.tsx:22-23`: `serverNow = Date.now() + offsetMs; left = startsAtServerMs - serverNow` — explicitly server-clock-anchored, re-evaluated every 16ms, never uses a bare local `Date.now()` countdown. Server side: `set_ready` handler in `apps/engine/src/engine.ts:218-224` mutates `player.isReady` and re-broadcasts `lobby_state`. `bun test apps/engine apps/gateway` → 111/111 pass. |
| 4 | Disconnect shows "Reconnecting… (5s)" progress bar; reconnect success restores prior view; reconnect failure shows distinct toast ("Lost connection — room lost" vs "Server restarted") | ✗ FAILED | See gaps below. Sub-clause breakdown: (a) "Reconnecting… (5s)" progress bar — **missing**, no component renders it; (b) reconnect success restores prior view — **verified**, `race-client.ts` `rejoined_room` branch (lines 262-307) restores `passageText`, `ownCharStates`, `ownWpm`, `countdownStartsAtServerMs`, `lobbyPlayers`, `graceBanner`, and opponent cursors; (c) distinct toasts for the two roadmap-named cases — **verified**, `App.tsx:181-201` maps `ROOM_NOT_FOUND`/`SESSION_INVALID` → "Room Lost" and `SERVER_SHUTTING_DOWN` → "Server Restarting" with distinct copy. Overall truth marked FAILED because clause (a), an explicit roadmap-level deliverable, does not exist in the codebase. |
| 5 | WPM rounded to integer with raw+net breakdown on hover; time-delta-to-winner shown on results | ✓ VERIFIED | `RaceHud.tsx:72-73`: `Math.round(stats.netWpm)` / `Math.round(stats.rawWpm)` displayed; hover/focus-triggered tooltip (lines 100-129) shows Net WPM, Raw WPM, Accuracy %, and uncorrected error count. `ResultsBoard.tsx:129-133`: `deltaText = i===0 ? "Winner" : "+${(deltaMs/1000).toFixed(1)}s"` rendered per row. 4/4 `RaceHud.test.tsx` and 6/6 `ResultsBoard.test.tsx` tests pass. |

**Score:** 2/5 truths verified (2 present-but-behavior-unverified, 1 failed)

### Plan-Level Must-Haves (Additional Detail)

All four plans' `must_haves.truths` were also individually cross-checked against the code (not merely re-stated from SUMMARY.md):

| Plan | Must-have | Status |
|------|-----------|--------|
| 05-01 | Headless `TypingEngine` (keystroke, backspace, scoring) | ✓ Verified — `apps/web/src/core/typing-engine.ts`, no DOM/React coupling |
| 05-01 | `CursorManager` 100ms buffer + lerp + 150ms extrapolation + rewind snap | ✓ Verified — `apps/web/src/core/cursor-manager.ts:3-4, 92-154` |
| 05-01 | `RaceClient` singleton, cookie sessionToken, store dispatch | ✓ Verified — `apps/web/src/net/race-client.ts` |
| 05-02 | Tailwind v4 botanical palette | ✓ Verified — `apps/web/src/styles.css`, production build compiles |
| 05-02 | `PassageLayout` via `@chenglou/pretext`, O(1) coordinate lookup | ✓ Verified — `apps/web/src/core/layout.ts` |
| 05-02 | translate3d overlay, 0 React commits | ⚠️ Present, behavior unverified (see SC2 above) |
| 05-03 | `set_ready` wire frame + server dispatch | ✓ Verified — `packages/shared/src/messages.ts:122`, `apps/engine/src/engine.ts:218-224` |
| 05-03 | Lobby readiness UI + passage filters | ✓ Verified — `LobbyView.tsx`, `packages/shared/src/passages.ts` (`filterPassages`) |
| 05-03 | Server-synced countdown overlay | ✓ Verified — `CountdownView.tsx` |
| 05-04 | Race HUD, Net WPM integer, tooltip | ✓ Verified — `RaceHud.tsx` |
| 05-04 | Stacked toast notifications, "concrete error descriptions... e.g. 'Server restarted — reconnecting in 5s'" | ✗ Gap — see finding below; production code never emits this exact toast, and no reconnect countdown exists |
| 05-04 | Results board podium medals + time deltas | ✓ Verified — `ResultsBoard.tsx` |

**Finding on the 05-04 toast must-have:** the plan's own example copy ("Server restarted — reconnecting in 5s") describes exactly the missing reconnect-progress feature from roadmap SC4. This is the same underlying gap surfacing at both the roadmap and plan level — not two independent issues.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/core/typing-engine.ts` | Headless TypingEngine | ✓ VERIFIED | Exists, substantive, wired into RaceView/RaceHud |
| `apps/web/src/core/cursor-manager.ts` | CursorManager w/ interpolation | ✓ VERIFIED | Exists, substantive, wired into RaceView |
| `apps/web/src/net/race-client.ts` | RaceClient singleton | ✓ VERIFIED | Exists, substantive, wired via `ws.ts` re-export, used by App.tsx |
| `apps/web/src/core/layout.ts` | PassageLayout (pretext) | ✓ VERIFIED | Exists, substantive, wired into RaceView |
| `apps/web/src/components/RaceView.tsx` | Decoupled presentational track | ✓ VERIFIED | translate3d overlay confirmed by inspection |
| `apps/web/src/components/LobbyView.tsx` | Ready indicators, filters, host controls | ✓ VERIFIED | All sub-features present and wired |
| `apps/web/src/components/CountdownView.tsx` | Server-synced countdown | ✓ VERIFIED | Server-clock math confirmed |
| `apps/web/src/components/RaceHud.tsx` | WPM display + tooltip | ✓ VERIFIED | Rounding + tooltip confirmed |
| `apps/web/src/components/ToastQueue.tsx` | Stacked toast queue | ✓ VERIFIED (component) / ⚠️ orphaned data | Component itself works; but 2 of the copy variants its own test asserts are never produced by any production caller (see gaps) |
| `apps/web/src/components/ResultsBoard.tsx` | Podium medals, time deltas | ✓ VERIFIED | Confirmed |
| `apps/web/src/components/GraceBanner.tsx` | Grace countdown banner | ✓ VERIFIED (different feature) | This is the race-finish grace period banner, not a connection-reconnect progress bar; do not conflate with SC4 |
| Reconnect progress bar component | "Reconnecting… (5s)" UI | ✗ MISSING | No such component/render-branch exists anywhere in `apps/web/src` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `App.tsx` error handler | `ToastQueue` | `addToast()` with code-mapped title/body | ✓ WIRED (2/2 roadmap cases; 1 SUMMARY-claimed case unwired) | ROOM_NOT_FOUND/SESSION_INVALID → "Room Lost"; SERVER_SHUTTING_DOWN → "Server Restarting"; RATE_LIMITED → 2 variants. No VERSION_MISMATCH path exists. |
| `useConnectionStore.status` | Any UI component | Subscribe/render | ✗ NOT WIRED | `status` is set to `"connecting" \| "open" \| "closed"` but only ever read for `status === "open"` (clock sync gating); never rendered as reconnect progress. |
| `race-client.ts` `rejoined_room` | React stores (`race`, `cursor`, `clock`) | `setRaceState`/`setCursorState`/`setClockState` | ✓ WIRED | Full state restoration confirmed on reconnect. |
| `CountdownView` | `useClockStore.offsetMs` | server-synced clock offset | ✓ WIRED | Not a bare local-clock countdown. |
| `LobbyView` Ready toggle | server `set_ready` dispatch | `ws.send({type:"set_ready"})` → `apps/engine/src/engine.ts` | ✓ WIRED | Confirmed both directions. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Web test suite (Vitest) | `bun run --cwd apps/web test -- --run` | 78/78 pass, 12/12 files | ✓ PASS |
| Shared package tests | `bun test packages/shared` (the documented `apps/server` path no longer exists post-Phase-07 N-tier split; silently matched 0 files there) | 39/39 pass | ✓ PASS |
| Engine + gateway tests (current server-side location) | `bun test apps/engine apps/gateway` | 111/111 pass, 18 files | ✓ PASS |
| Reconnect progress bar text search | `grep -rn "Reconnecting" apps/web/src` | 0 hits (outside test file) | ✗ FAIL — confirms gap |
| Version-mismatch error code search | `grep -rn "VERSION_MISMATCH" apps/ packages/ --include=*.ts --include=*.tsx` (excluding tests) | 0 hits | ✗ FAIL — confirms gap |

### Requirements Coverage

There is no REQUIREMENTS.md in this project. Cross-referenced against `.planning/PROJECT.md` `## Requirements` and `ROADMAP.md`'s phase-level requirement mapping instead.

| Requirement | Source | Description | Status | Evidence |
|-------------|--------|-------------|--------|----------|
| REQ-06 | ROADMAP.md Phase 5 | Live opponent cursors — interpolation polish | ⚠️ Partially satisfied | Interpolation math (buffer, lerp, extrapolation, rewind-snap) is implemented and unit-tested; the "smooth 60fps... no visible jitter" outcome itself is unverified by any automated or recorded human check (SC1/SC2 above). Not blocked, but not proven either. |

### Anti-Patterns Found

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` debt markers found in any phase-modified file. No stub `return null`/empty-handler patterns found in the reviewed components. The one notable anti-pattern is architectural rather than lexical: `ToastQueue.test.tsx`'s "distinct error states matching copywriting contract" test calls `addToast()` directly with hand-typed strings instead of driving the test through `App.tsx`'s actual `msg.type === "error"` switch — this is a **fixture-only test**: it proves the presentation component works, not that production code ever produces 2 of the 4 asserted strings ("Server restarted — reconnecting automatically in 5s...", "Game version outdated..."). This is the same class of issue the milestone audit was concerned about: a green test suite that does not, on inspection, cover the feature the roadmap actually names.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/src/__tests__/ToastQueue.test.tsx` | 63-107 | Fixture-only test — hardcoded toast strings never produced by production error-handling code | ⚠️ Warning | Test suite green (78/78) masks 2 unimplemented/miscopied toast cases |

### Human Verification Required

See `human_verification` in frontmatter — 2 items (SC1 jitter-under-RTT visual check, SC2 React DevTools Profiler commit-count check). Both require an actual browser session; neither can be settled by static analysis.

### Gaps Summary

Phase 5 delivers the large majority of its scope well: the headless engine/cursor-manager architecture (05-01), the Tailwind/pretext/translate3d visual layer (05-02), lobby readiness + server-synced countdown (05-03), and the WPM/results polish (05-04) are all genuinely implemented, unit-tested, and wired — this is not a case of stub components. The milestone audit's underlying concern ("no post-execution verification, only a pending pre-execution draft") is now closed: 78/78 web tests + 39/39 shared tests + 111/111 current-location engine/gateway tests all pass, and the implementation was read (not just summary-trusted) across every named artifact.

However, two concrete pieces of Success Criterion 4 do not exist in the codebase despite being explicitly named in both the roadmap goal prose and the 05-04 plan's own must-haves/example copy:

1. **No "Reconnecting… (5s)" progress bar** for the local client's own disconnected state. `GraceBanner` (race-finish grace period) and the Phase-4 "other player disconnected" toast are both different, pre-existing features that were likely mistaken for satisfying this criterion when the plan was scoped or summarized.
2. **No version-mismatch detection or toast**, despite the 05-04-SUMMARY.md explicitly claiming "4 cases: lost connection / server restart / rate limit / version mismatch" were delivered. Only 3 of those 4 error families have any production wiring, and even the ones that exist use different copy than the copy asserted in `ToastQueue.test.tsx`.

Both gaps are additive (new UI/logic needed), not regressions — nothing needs to be torn out. A follow-up plan can add: (a) a connection-status-driven reconnect countdown component subscribing to `useConnectionStore().status === "closed"`, reusing `race-client.ts`'s existing 1s retry loop or introducing an explicit 5s-grace timer to match the copy; and (b) either a real protocol-version check (server sends a build/version id at `hello`, client compares and shows the toast on mismatch) or, if intentionally out of scope for v1.0, a correction to 05-04-SUMMARY.md's claim.

Two additional items are not gaps but were downgraded from VERIFIED to PRESENT_BEHAVIOR_UNVERIFIED because the roadmap's own success-criteria wording demands a runtime/profiling check ("verified under simulated 100ms RTT", "React DevTools profile shows...") that no automated test performs — these route to human verification rather than blocking the phase.

Also worth noting for hygiene, not as a gap: `05-VALIDATION.md` frontmatter is stale (`status: draft`, `wave_0_complete: false`, all 12 per-task rows `⬜ pending`) even though every Wave-0 test file it lists now exists and passes, and its documented "Quick run command" (`bun test packages/shared apps/server`) silently tests nothing server-side since Phase 7's N-tier split relocated the server into `apps/engine` + `apps/gateway`.

---

_Verified: 2026-09-16_
_Verifier: Claude (gsd-verifier)_
