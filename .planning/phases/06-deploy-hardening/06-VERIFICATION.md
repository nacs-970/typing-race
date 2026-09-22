---
phase: 06-deploy-hardening
verified: 2026-09-16T00:00:00Z
status: gaps_found
score: 3/5 must-haves verified
covered_files: [".bun-version", ".planning/PROJECT.md", ".planning/STATE.md", ".planning/phases/06-deploy-hardening/06-01-PLAN.md", ".planning/phases/06-deploy-hardening/06-01-SUMMARY.md", ".planning/phases/06-deploy-hardening/06-02-PLAN.md", ".planning/phases/06-deploy-hardening/06-02-SUMMARY.md", ".planning/phases/06-deploy-hardening/06-03-PLAN.md", ".planning/phases/06-deploy-hardening/06-03-SUMMARY.md", ".planning/phases/06-deploy-hardening/06-04-PLAN.md", ".planning/phases/06-deploy-hardening/06-04-SUMMARY.md", ".planning/phases/06-deploy-hardening/06-CONTEXT.md", ".planning/phases/06-deploy-hardening/06-REVIEW-FIX.md", ".planning/phases/06-deploy-hardening/06-REVIEW.md", ".planning/phases/06-deploy-hardening/06-SECURITY.md", ".planning/phases/06-deploy-hardening/06-UAT.md", ".planning/phases/06-deploy-hardening/06-VALIDATION.md", "Dockerfile", "README.md", "apps/engine/Dockerfile", "apps/engine/src/__tests__/drain.test.ts", "apps/engine/src/__tests__/validate-keystroke.test.ts", "apps/engine/src/engine.ts", "apps/engine/src/index.ts", "apps/engine/src/race/validate-keystroke.ts", "apps/gateway/Dockerfile", "apps/gateway/src/__tests__/drain.test.ts", "apps/gateway/src/index.ts", "apps/gateway/src/ws/client-manager.ts", "apps/gateway/src/ws/dispatch.ts", "apps/gateway/src/ws/handlers.ts", "apps/web/Dockerfile", "apps/web/src/App.tsx", "packages/shared/src/__tests__/bun-version-pin.test.ts", "scripts/smoke-test.sh"]
covered_digest: "v1:sha256:918362df070379a4c9c3586fbee89f63a1ab3fa4a2a3a7fe01581377ce2e4dd1"
behavior_unverified: 0
overrides_applied: 0
gaps:

  - truth: "Gateway rejects new room joins/creation ONLY during an actual drain, not permanently after unrelated events"
    status: failed
    reason: "ClientManager.isDraining() has no cycle-scoped reset. setDraining(true) fires from bindBridgeToGateway's \"draining\" bridge-event handler AND from drain(); the only setDraining(false) in the codebase is inside ClientManager.clear(), which only runs from GatewayInstance.stop() (i.e. after the gateway itself has fully shut down). In split/Redis mode — the topology docker-compose.yml actually uses, with restart: unless-stopped on the engine — any single engine-side SIGTERM (crash-restart, independent engine redeploy) causes EngineWorker.drain() to publish a \"draining\" event that the long-lived gateway process latches forever. From that point on, dispatch.ts permanently rejects create_room/join_room/start_race with SERVER_SHUTTING_DOWN for the rest of the gateway's uptime, even though the gateway itself never received a shutdown signal and is otherwise healthy. This is not a hypothetical: it was explicitly identified in 06-REVIEW.md's CR-B1 finding (the parenthetical at lines 124-131) as 'a pre-existing... issue in the same code path' with 'the identical staleness problem' as the drained-latch bug that WAS fixed. 06-REVIEW-FIX.md declares findings_in_scope: 2 and fixes only the isDrained()/setDrained() latch (CR-B1) and the duplicate-broadcast bug (WR-A1) — the isDraining()/setDraining() latch was left unaddressed, is not covered by any regression test (drain.test.ts only asserts isDraining() flips to true, never that it resets), and is not recorded anywhere as an accepted risk or deferred item (06-SECURITY.md's T-06-01 covers a different threat — the async-forwarding race during an active, legitimate drain — not this permanent-latch defect)."
    artifacts:
      - path: "apps/gateway/src/ws/client-manager.ts"
        issue: "setDraining(v) has no cycle-scoped counterpart to isDrainedSince()/setDrained(false); only clear() resets it, and clear() only runs on full gateway shutdown"
      - path: "apps/gateway/src/ws/handlers.ts"
        issue: "bindBridgeToGateway's \"draining\" case calls manager.setDraining(true) unconditionally on every bridge \"draining\" event, with no correlation to whether this gateway process is itself shutting down"
    missing:
      - "Scope the draining latch to a shutdown cycle the same way CR-B1 scoped the drained latch (e.g. reset via instance.clientManager.setDraining(false) before this gateway's own onShutdown runs its actual drain, or track a freshness timestamp), so an engine-only restart in split mode cannot permanently disable room creation on a healthy gateway."
      - "A regression test that publishes a \"draining\" bridge event from a simulated independent engine restart (no corresponding SIGTERM on the gateway itself) and asserts the gateway's own dispatch.ts still accepts create_room once that unrelated engine cycle completes."

deferred:

  - truth: "CI workflow (bun test + lint + typecheck + production build + smoke bun run start against pinned Bun 1.3.x) passes on every PR; deploy blocked on CI failure"
    addressed_in: "future deploy-focused phase (not yet scheduled)"
    evidence: "06-CONTEXT.md Phase Boundary: 'the CI/deploy-gate item ... is explicitly OUT of scope for this pass, per user direction' and Deferred Ideas: 'CI gate ... explicitly deferred out of this phase per user direction.' STATE.md: '.github/ CI workflow and fly deploy execution remain explicitly out of scope (deferred to a future deploy-focused pass).'"
  - truth: "Live deploy URL serves the full game end-to-end (two browsers join, race, results show, rematch works) verified by manual smoke test before shipping"
    addressed_in: "N/A — explicitly descoped from v1.0, not deferred to a later phase"
    evidence: "PROJECT.md Out of Scope: 'Public deployment to Fly.io — infra built and smoke-tested (Dockerfile, fly.toml, scripts/deploy.sh, graceful shutdown/drain), but fly deploy never run. Removed from v1.0 scope 2026-09-16 per user decision; local-run demo is sufficient for the resume/demo goal.' Verified instead via scripts/smoke-test.sh, executed live during this verification: exit 0, 'SMOKE OK'."
advisory:

  - finding: "ROADMAP.md still shows Phase 6 and its 4 plan checkboxes as unchecked ([ ]) at lines 14, 171, 172, 176, 180, despite all 4 plans being complete, reviewed, security-verified, and validated per SUMMARY/REVIEW/SECURITY/VALIDATION/STATE.md ('Phase 6 COMPLETE')."
    category: other
    reason: "Documentation bookkeeping drift, not a functional gap — does not affect phase-goal achievement, but could mislead other tooling/agents reading ROADMAP.md as the source of truth for phase status."
    evidence_status: "observed directly in .planning/ROADMAP.md; no fix applied"
human_verification:

  - test: "Decide whether Success Criterion 1's '30s' orphaned-connection bound (ROADMAP.md) is formally overridden by D-02's deliberate 90s drain timeout, or whether the roadmap wording itself should be updated to 90s."
    expected: "An explicit decision recorded (either a VERIFICATION.md override entry with accepted_by/accepted_at, or a ROADMAP.md edit) rather than the deviation persisting only as a prose note in 06-CONTEXT.md's D-02 decision block."
    why_human: "06-CONTEXT.md documents D-02 as a deliberate, reversible decision made by the user directly ('the user typed this value directly as a deliberate choice'), but no VERIFICATION.md override block or roadmap update has formally reconciled it against the original Success Criterion text. The functional behavior itself (drain-to-completion, no orphaned connections once drain completes) is verified via UAT and drain.test.ts — only the specific '30s' bound in the roadmap's wording is unreconciled."
  - test: "Confirm fly.toml's kill_timeout (\"10s\") is bumped to >= 90s before any actual fly deploy is ever run, given no phase or roadmap entry currently owns this follow-up."
    expected: "Either a tracked follow-up item (backlog/roadmap phase) or an explicit acceptance that this is moot because live Fly.io deploy is out of v1.0 scope entirely."
    why_human: "README.md, STATE.md, and 06-SECURITY.md (R-06-04 accepted-risk entry) all flag this three times as something 'whoever performs the actual deploy work must' fix, but no phase in the current ROADMAP.md owns it, and it doesn't qualify as Step 9b 'deferred' since no later milestone phase's goal/success-criteria text covers it. Low practical urgency since fly deploy itself is descoped from v1.0, but it is an unowned loose end."
audit_acknowledged:
  milestone: v1.0
  at: 2026-09-22
  status: gaps_found
---

# Phase 6: Deploy + Hardening Verification Report

**Phase Goal:** Final hardening before the public resume URL. Graceful shutdown drains in-flight rooms on SIGTERM, Bun version pinned in `package.json` + Dockerfile, CI runs `bun run start` against pinned Bun before every deploy, anti-cheat regression tests, optional React Compiler opt-in if profiling shows cursor render as bottleneck.
**Verified:** 2026-09-16
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1a | SIGTERM during active race triggers graceful drain: error frame delivered, distinct client toast, race runs to completion | ✓ VERIFIED | `apps/engine/src/index.ts:36`, `apps/gateway/src/index.ts:125-162,193-211` implement drain; `apps/web/src/App.tsx:198-201` renders a distinct "Server Restarting" title/body (not generic "Error") for `SERVER_SHUTTING_DOWN`; 06-UAT.md Test 2 — live automated probe, 2/2 clean runs, race ran to completion server-side, both clients received `race_end` ~400-800ms before process exit; `bun test apps/engine/src/__tests__/drain.test.ts apps/gateway/src/__tests__/drain.test.ts` = 18 pass, 0 fail (re-run live during this verification) |
| 1b | "No orphaned WS connections after 30s" (literal roadmap bound) | ⚠️ see Human Verification #1 | D-02 (06-CONTEXT.md) deliberately extends the drain hard-cap to 90s, exceeding the roadmap's literal 30s bound; behavior itself (drain completes, no orphaned connections once drained) is verified, but the specific bound was never formally reconciled via an accepted override |
| 2 | Gateway rejects new room joins/creation ONLY during an actual drain cycle, not permanently after unrelated events | ✗ FAILED | See Gaps — `ClientManager.isDraining()` has no cycle-scoped reset; a lone engine restart in split/Redis mode permanently latches reject-new-rooms mode on an otherwise-healthy gateway. Confirmed directly in `apps/gateway/src/ws/client-manager.ts` (only `clear()` resets it) and `apps/gateway/src/ws/handlers.ts:93` (unconditional `setDraining(true)` on every bridge "draining" event) |
| 3 | Bun version pinned in `package.json` + Dockerfile, with drift protection | ✓ VERIFIED | `.bun-version` = `1.3.2`; all 4 Dockerfiles (`Dockerfile`, `apps/web/Dockerfile`, `apps/gateway/Dockerfile`, `apps/engine/Dockerfile`) contain `ARG BUN_VERSION=1.3.2`; `bun test packages/shared/src/__tests__/bun-version-pin.test.ts` re-run live = 6 pass, 0 fail |
| 4 | CI runs `bun run start` against pinned Bun before every deploy | (deferred) | Explicitly out of scope for this phase per 06-CONTEXT.md and user direction — see Deferred Items, not a gap |
| 5 | Anti-cheat regression tests confirm: future-timestamped `clientTs` rejected, sub-20ms intervals rejected, pre-start keystrokes rejected, WPM cap 250 enforced | ✓ VERIFIED (documented deviation on the WPM-250 clause) | `apps/engine/src/race/validate-keystroke.ts` uses server `now`, never `frame.clientTs` (test 7, line 201); `MIN_INTERVAL_MS = 20` enforced (tests 3, 3.1); `room.state === "lobby" \| "countdown"` rejected pre-start (test 1, check 2 in validate-keystroke.ts); D-07 bypass block adds replay-attack, sub-boundary-replay, and claimed-impossible-WPM tests. `bun test apps/engine/src/__tests__/validate-keystroke.test.ts` re-run live = 26 pass, 0 fail. The literal "WPM cap 250" clamp does not exist in code — this is a deliberate, transparently documented ROADMAP-vs-implementation mismatch (STATE.md Blockers/Concerns: "the real structural ceiling from the 20ms min-interval floor is ~600 WPM... Documented in README, not changed"), not a silently-missed gap |
| 6 | React Compiler opt-in if profiling shows cursor render as bottleneck | ✓ VERIFIED (skip, per decision) | D-08 (06-CONTEXT.md): explicitly skipped, no measured bottleneck; Phase 5 already isolated cursor rendering via CSS `transform3d`; README.md line 16 documents the skip rationale |
| 7 | README documents deploy strategy, restart behavior, graceful shutdown, local dev workflow | ✓ VERIFIED | `README.md` `### Deploy Strategy` (line 79, `fly deploy --strategy immediate --remote-only`), `### Graceful Shutdown` (line 83, documents drain + flags `fly.toml`'s `kill_timeout = "10s"` gap), `### Local Smoke Test` (line 88), `### Environment Variables` (line 92) all present and content-accurate against source (`fly.toml`, `env.ts` files) |
| 8 | Live deploy URL serves the full game end-to-end | (deferred / N/A) | Explicitly descoped from v1.0 per PROJECT.md Out of Scope (2026-09-16). Verified local equivalent instead: `bash scripts/smoke-test.sh` executed live during this verification — build → boot → `/health` 200 → WS `hello` frame → teardown, exit 0, "SMOKE OK" |

**Score:** 3/5 roadmap success criteria fully verified without qualification (SC3 wording, SC4, SC5 have documented deviations/deferrals); SC1's core drain mechanism has a real correctness gap (item #2 above); SC2 deferred.

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | CI workflow gate before every deploy (SC2) | Future deploy-focused phase (unscheduled) | 06-CONTEXT.md Phase Boundary + Deferred Ideas; STATE.md |
| 2 | Live Fly.io deploy end-to-end (SC5) | N/A — permanently descoped from v1.0 | PROJECT.md Out of Scope, 2026-09-16 |

### Advisory (New Scope, Unevidenced)

| # | Finding | Category | Why Advisory |
|---|---------|----------|--------------|
| 1 | ROADMAP.md phase/plan checkboxes for Phase 6 still show `[ ]` unchecked despite completion | other | Documentation drift, no functional impact; not fixed as part of this verification |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/engine/src/index.ts` | SIGTERM handler calls `worker.drain(90_000)` | ✓ VERIFIED | Line 36, idempotent via `shuttingDown` flag |
| `apps/gateway/src/index.ts` | SIGTERM handler calls `instance.drain(90_000)`, clears stale `drained` latch first | ✓ VERIFIED | Lines 193-211; `setDrained(false)` at line 206 before `drain()` (CR-B1 fix) |
| `apps/gateway/src/ws/client-manager.ts` | Drain/drained/shutdown-announce state with cycle-scoped resets | ⚠️ PARTIAL | `drained` and `shuttingDownAnnounced` are correctly cycle-scoped (via `setDrained(false)` call site + `announceShuttingDownOnce`); `draining` is NOT cycle-scoped — see Gaps |
| `.bun-version` | Pins `1.3.2` | ✓ VERIFIED | Present, correct value |
| `Dockerfile`, `apps/{web,gateway,engine}/Dockerfile` | `ARG BUN_VERSION=1.3.2` | ✓ VERIFIED | All 4 confirmed |
| `packages/shared/src/__tests__/bun-version-pin.test.ts` | Drift-guard test | ✓ VERIFIED | 6/6 passing live |
| `apps/engine/src/__tests__/validate-keystroke.test.ts` | D-07 bypass scenarios | ✓ VERIFIED | 26/26 passing live, includes `D-07 bypass scenarios` describe block |
| `apps/web/src/App.tsx` | `SERVER_SHUTTING_DOWN` → distinct toast | ✓ VERIFIED | Line 198-201, title "Server Restarting", distinct body copy |
| `README.md` | Deploy strategy / shutdown / smoke test docs | ✓ VERIFIED | All 4 sections present, content-accurate |
| `scripts/smoke-test.sh` | Local production smoke test | ✓ VERIFIED | Executed live, exit 0, "SMOKE OK" |
| `fly.toml`, `scripts/deploy.sh`, all 4 Dockerfiles | Deploy infra built (not run) | ✓ VERIFIED | All present; `fly deploy` correctly never invoked per descope decision |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `EngineWorker.drain()` | Gateway `ClientManager` | EventBridge `draining`/`drained` events → `bindBridgeToGateway` | ⚠️ PARTIAL | `drained` path correctly wired and cycle-scoped; `draining` path wired but NOT cycle-scoped (see Gaps) |
| `apps/gateway/src/ws/dispatch.ts` | `ClientManager.isDraining()` | Guards `create_room`/`join_room`/`start_race` | ✓ WIRED | Confirmed at `dispatch.ts:72`; functions correctly during a real drain, but also incorrectly stays latched after an unrelated engine restart (Gap #1) |
| SIGTERM handler | `App.tsx` toast | `SERVER_SHUTTING_DOWN` error frame → `RaceClient.dispatch` → `App.tsx` msg.code branch | ✓ WIRED | Confirmed via code read + `App.test.tsx` (78/78 web suite passing) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Engine + Gateway drain tests | `bun test apps/engine/src/__tests__/drain.test.ts apps/gateway/src/__tests__/drain.test.ts packages/shared/src/__tests__/bun-version-pin.test.ts` | 18 pass, 0 fail | ✓ PASS |
| Anti-cheat regression tests | `bun test apps/engine/src/__tests__/validate-keystroke.test.ts` | 26 pass, 0 fail | ✓ PASS |
| Full monorepo suite | `bun run --filter '*' test` | engine 92 pass, gateway 19 pass, web 78 pass, shared included — all 0 fail | ✓ PASS |
| Full monorepo typecheck | `bun run --filter '*' typecheck` | 4/4 workspaces exit 0 | ✓ PASS |
| Local production smoke test | `bash scripts/smoke-test.sh` | build → boot → health 200 → WS hello → teardown, "SMOKE OK", exit 0 | ✓ PASS |
| Debt-marker scan on phase-touched files | `grep -E "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` across 9 key files | no matches | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention in this project; no probes declared in phase PLAN/SUMMARY files. Skipped — behavioral spot-checks above (live test runs + live smoke-test execution) cover the equivalent ground.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| REQ-12 | 06-01, 06-02, 06-03, 06-04 | Fly.io deploy finalized | ⚠️ PARTIAL — SATISFIED for the "infra built + smoke-tested locally" scope actually contracted (per PROJECT.md's 2026-09-16 descope decision); the "live deploy" clause of the original REQ-12 language is explicitly out of scope | Deploy infra (Dockerfile ×4, fly.toml, scripts/deploy.sh) present; graceful shutdown/drain implemented (with the Gap #1 defect noted above); Bun pinned; local smoke test passes live |

No orphaned requirements found — REQ-12 is the only requirement ID mapped to Phase 6 across all 4 plans, and it matches PROJECT.md's Requirements section framing.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/gateway/src/ws/client-manager.ts` | 7, 11-17 | Unbounded latch (`draining` boolean set-only outside `clear()`) | 🛑 Blocker | Causes Gap #1 — permanent reject-new-rooms state after an unrelated engine restart in split/Redis mode |
| `.planning/ROADMAP.md` | 14, 171-180 | Stale `[ ]` checkboxes for a completed phase | 📋 Advisory | Documentation drift only, no code impact |

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in any of the 9 phase-touched implementation/doc files scanned.

### Human Verification Required

#### 1. SC1's literal "30s" bound vs D-02's deliberate 90s drain timeout

**Test:** Review D-02 in 06-CONTEXT.md and decide whether to formally override SC1's "no orphaned WS connections after 30s" wording, or update ROADMAP.md's success-criteria text to 90s.
**Expected:** An explicit decision recorded as either a VERIFICATION.md `overrides:` entry or a ROADMAP.md text update.
**Why human:** This is a deliberate, user-authored decision (per 06-CONTEXT.md's Specifics section: "the user typed this directly as free text"), but it was never run through this verifier's formal override mechanism — it only exists as a decision-log note. The underlying drain *behavior* is verified; only the specific numeric bound in the roadmap's original wording is unreconciled.

#### 2. `fly.toml` `kill_timeout = "10s"` vs the 90s drain window — ownership

**Test:** Confirm whether this needs a tracked follow-up (backlog item / future phase) or is moot given live Fly.io deploy is fully descoped from v1.0.
**Expected:** Either an owning phase/backlog entry, or an explicit "moot, deploy is out of scope" acknowledgment.
**Why human:** Flagged in three places (README.md, STATE.md, 06-SECURITY.md's R-06-04) as something "whoever performs the actual deploy work must" fix, but no phase currently owns it and it doesn't qualify as a Step-9b "deferred" item (no later milestone phase's goal covers it).

### Gaps Summary

One genuine functional gap blocks a clean pass: **the gateway's `draining` state (as opposed to the already-fixed `drained` state) has no cycle-scoped reset.** `ClientManager.setDraining(true)` fires unconditionally whenever the EventBridge relays a `"draining"` event — which happens on *any* `EngineWorker.drain()` call, including one triggered by an engine-only SIGTERM completely unrelated to the gateway's own lifecycle. The only code path that ever calls `setDraining(false)` is `ClientManager.clear()`, invoked solely from `GatewayInstance.stop()` after the gateway itself has fully shut down. In the project's own primary production topology (`docker-compose.yml`'s split mode, with `restart: unless-stopped` on the engine service), this means a single engine crash-restart permanently and irrecoverably disables `create_room`/`join_room`/`start_race` on an otherwise healthy, long-running gateway process — for the rest of that gateway's uptime.

This is not a new or hypothetical concern: `06-REVIEW.md`'s CR-B1 finding explicitly named this exact code path ("`manager.setDraining(true)` in `bindBridgeToGateway`'s `\"draining\"` case has the identical staleness problem" as the `drained`-latch bug) but scoped it out as "pre-existing, out-of-diff-scope." `06-REVIEW-FIX.md` then declared only 2 findings in scope (CR-B1's `drained` latch and WR-A1's duplicate broadcast) and fixed exactly those two — leaving the parenthetically-flagged `draining`-latch twin defect unfixed, untested, and unrecorded as an accepted risk anywhere in `06-SECURITY.md`, `06-VALIDATION.md`, or `STATE.md`.

Because this defect sits directly in the core mechanism Plan 06-01 was chartered to build (SIGTERM-triggered drain that correctly gates new room creation), and because it produces an incorrect, silent, permanent service-degradation outcome in the project's actual deployment topology with zero test coverage, it does not meet the bar for "documented, deliberate deviation" the way the WPM-250 mismatch or the CI/live-deploy deferrals do. It is recorded as a blocking gap rather than an advisory note.

All other phase deliverables — graceful drain-to-completion behavior, Bun version pinning + drift guard, anti-cheat regression coverage (including the documented WPM-250 deviation), README documentation, and the local smoke-test substitute for live deploy — are verified working in the current codebase, not merely claimed in SUMMARY.md.

---

_Verified: 2026-09-16_
_Verifier: Claude (gsd-verifier)_
