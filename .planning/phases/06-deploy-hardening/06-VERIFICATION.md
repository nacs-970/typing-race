---
phase: 06-deploy-hardening
verified: 2026-09-22T17:33:50Z
status: human_needed
score: 6/9 truths verified (2 pending human decision: 1b, 8; 1 deferred: 4; 0 present-behavior-unverified)
covered_files: [".bun-version", ".planning/PROJECT.md", ".planning/STATE.md", ".planning/ROADMAP.md", ".planning/phases/06-deploy-hardening/06-01-PLAN.md", ".planning/phases/06-deploy-hardening/06-01-SUMMARY.md", ".planning/phases/06-deploy-hardening/06-02-PLAN.md", ".planning/phases/06-deploy-hardening/06-02-SUMMARY.md", ".planning/phases/06-deploy-hardening/06-03-PLAN.md", ".planning/phases/06-deploy-hardening/06-03-SUMMARY.md", ".planning/phases/06-deploy-hardening/06-04-PLAN.md", ".planning/phases/06-deploy-hardening/06-04-SUMMARY.md", ".planning/phases/06-deploy-hardening/06-CONTEXT.md", ".planning/phases/06-deploy-hardening/06-REVIEW-FIX.md", ".planning/phases/06-deploy-hardening/06-REVIEW.md", ".planning/phases/06-deploy-hardening/06-SECURITY.md", ".planning/phases/06-deploy-hardening/06-UAT.md", ".planning/phases/06-deploy-hardening/06-VALIDATION.md", ".planning/phases/06.1-fix-draining-latch-reset-in-split-mode-topology/06.1-01-SUMMARY.md", ".planning/phases/06.1-fix-draining-latch-reset-in-split-mode-topology/06.1-CONTEXT.md", ".planning/phases/06.1-fix-draining-latch-reset-in-split-mode-topology/06.1-VERIFICATION.md", "Dockerfile", "README.md", "render.yaml", "fly.toml", "docker-compose.yml", "apps/engine/Dockerfile", "apps/engine/src/__tests__/drain.test.ts", "apps/engine/src/__tests__/validate-keystroke.test.ts", "apps/engine/src/engine.ts", "apps/engine/src/index.ts", "apps/engine/src/race/validate-keystroke.ts", "apps/gateway/Dockerfile", "apps/gateway/src/__tests__/drain.test.ts", "apps/gateway/src/index.ts", "apps/gateway/src/ws/client-manager.ts", "apps/gateway/src/ws/dispatch.ts", "apps/gateway/src/ws/handlers.ts", "apps/web/Dockerfile", "apps/web/src/App.tsx", "apps/web/src/__tests__/App.test.tsx", "packages/shared/src/__tests__/bun-version-pin.test.ts", "scripts/smoke-test.sh"]
covered_digest: "v1:sha256:3882a07e428c40a2a71554ee5ad107066fd2a612a82d98797ab6c08e16882569"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/5
  gaps_closed:
    - "Gateway rejects new room joins/creation ONLY during an actual drain, not permanently after unrelated events — closed by Phase 06.1 (ClientManager.ownDrainStarted / markOwnDrainStarted() / hasOwnDrainStarted(), gating the 'drained' handler's setDraining(false) reset)"
  gaps_remaining: []
  regressions: []
advisory:
  - finding: "README.md's Render.com section (line 93) claims render.yaml's maxShutdownDelaySeconds is set to 95 as the shutdown-grace equivalent of fly.toml's kill_timeout. render.yaml no longer contains that key — commit f775c80 ('fix(render): drop maxShutdownDelaySeconds, unsupported on free tier') removed it, replacing it with a code comment explaining Render's free tier rejects the Blueprint if it's set and that free-tier shutdown grace is a shorter, fixed value than the 90s drain cap. README.md was modified in the same window (adding the Render section, commit 708e3f8) but was never updated to match the later removal."
    category: other
    reason: "Documentation drift in a section that documents a deploy target (Render) added after Phase 6 closed, not part of Phase 6's own contracted SC4 clause ('fly deploy --strategy immediate', restart behavior, graceful shutdown, local dev workflow) — which remains accurate. Concrete, reproducible evidence: `grep maxShutdownDelaySeconds render.yaml` returns nothing; `git show f775c80` shows the removal; README.md:93 still asserts the old value."
    evidence_status: "Directly reproduced: render.yaml (current) has no maxShutdownDelaySeconds key; README.md:93 still describes '95'. Not a Phase-6 regression per the task's own framing (later, separate deploy-hardening work) — reported for awareness/cleanup, not blocking."
  - finding: "ClientManager.shuttingDownAnnounced remains a clear()-only latch — same defect class 06.1 fixed for `draining`, but left unaddressed for the SERVER_SHUTTING_DOWN broadcast-once gate. An independent engine-only restart's 'draining' event now correctly stops wedging create_room (06.1's fix), but it still burns announceShuttingDownOnce()'s one-shot gate, so a subsequent REAL gateway shutdown may silently skip broadcasting SERVER_SHUTTING_DOWN to connected clients."
    category: architectural
    reason: "Already surfaced and adjudicated non-blocking in 06.1-VERIFICATION.md's own advisory list (status: passed, 2/2) as a recommended follow-up ('06.2'), not in 06.1-CONTEXT.md's stated success criteria, and not regressed by anything in this pass. No failing test exists for it; carrying forward the existing adjudication rather than re-litigating it into a blocker."
    evidence_status: "Traced by direct code re-read (client-manager.ts, handlers.ts) confirming the condition still exists as 06.1-VERIFICATION.md described it. No test constructs this scenario in either direction."
  - finding: "ROADMAP.md still shows Phase 6's own row ('6. Deploy + Hardening | 0/4 | Not started | -', line 225) and its 4 plan checkboxes (lines 199-203) as unchecked/not-started, despite Phase 6 and its 06.1 gap-closure phase both being complete, reviewed, security-verified, validated, and now re-verified passing in substance."
    category: other
    reason: "Pure documentation bookkeeping drift, carried forward unresolved from the prior verification pass (2026-09-16); no functional impact. ROADMAP.md was touched by other commits in the interim (docs/roadmap fills for 03.1/04.1, unrelated phases) but none touched Phase 6's own row/checkboxes."
    evidence_status: "Observed directly in .planning/ROADMAP.md lines 199-203 and 225."
human_verification:
  - test: "Decide whether Success Criterion 1's literal '30s' orphaned-connection bound (ROADMAP.md line 191) is formally overridden by D-02's deliberate 90s drain timeout, or whether the roadmap wording itself should be updated to 90s."
    expected: "An explicit decision recorded (either a VERIFICATION.md `overrides:` entry with accepted_by/accepted_at, or a ROADMAP.md text edit) rather than the deviation persisting only as a prose note in 06-CONTEXT.md's D-02 decision block."
    why_human: "Carried forward from the 2026-09-16 verification, unresolved: ROADMAP.md:191 still reads '30s' verbatim; no override block exists anywhere in this phase's VERIFICATION.md history. The functional behavior (drain-to-completion, no orphaned connections once drained) is verified — only the specific numeric bound in the roadmap's wording is unreconciled."
  - test: "Confirm fly.toml's kill_timeout (\"10s\") is bumped to >= 90s before any actual `fly deploy` is run, or explicitly accept this is moot because the project's live deployment target is now Render (render.yaml), not Fly.io."
    expected: "Either a tracked follow-up item, or an explicit 'moot, Fly.io deploy is not the live path' acknowledgment alongside the existing Render-side tradeoff already documented in render.yaml's comments (free tier's fixed, shorter shutdown grace vs. the 90s drain cap — already accepted there)."
    why_human: "Carried forward from the 2026-09-16 verification: fly.toml:12 still reads `kill_timeout = \"10s\"`, unchanged. Since 2026-09-16, the project's actual live deployment shifted to Render.com (render.yaml added, referenced live in 07.1-VERIFICATION.md against https://typing-race-krhc.onrender.com/), which makes this specific Fly.io loose end lower-urgency but still formally unowned and un-acknowledged as moot."
  - test: "Run the full round-trip flow (two browsers join the same room, race to completion, results board shows, rematch works) against the live Render URL (https://typing-race-krhc.onrender.com/, confirmed reachable per 07.1-VERIFICATION.md)."
    expected: "Either a recorded PASS (mirroring how 07.1's live two-tab session-takeover test was confirmed and recorded), or an explicit decision that SC5 remains formally out of v1.0 scope even though a live public URL now exists and has been partially exercised."
    why_human: "SC5 ('Live deploy URL serves the full game end-to-end... verified by manual smoke test before shipping') was recorded as 'N/A — descoped from v1.0' in the 2026-09-16 verification, when the only live target under discussion was Fly.io and no deploy had actually been run. Since then, a real Render deployment exists and has been exercised live (07.1's two-tab session-takeover test, and this pass's own container-level smoke checks), but the specific end-to-end race→results→rematch flow SC5 describes has not been confirmed against that live URL by anyone — only the local `scripts/smoke-test.sh` substitute (health check + WS hello) and a narrower two-tab reconnect scenario. This is a real-time, cross-browser flow no automated check in this repo can exercise."
audit_acknowledged:
  milestone: v1.0
  at: 2026-09-22
  status: gaps_found
  note: "This block acknowledges the SUPERSEDED 2026-09-16 gaps_found pass (recorded before Phase 06.1's fix landed and before this fresh re-verification ran). The current, authoritative status of this document is the top-level `status: human_needed` above — the previously-acknowledged draining-latch gap is now closed (see re_verification.gaps_closed). Left in place for audit-trail continuity rather than deleted."
---

# Phase 6: Deploy + Hardening Verification Report

**Phase Goal:** Final hardening before the public resume URL. Graceful shutdown drains in-flight rooms on SIGTERM, Bun version pinned in `package.json` + Dockerfile, CI runs `bun run start` against pinned Bun before every deploy, anti-cheat regression tests, optional React Compiler opt-in if profiling shows cursor render as bottleneck.
**Verified:** 2026-09-22T17:33:50Z
**Status:** human_needed
**Re-verification:** Yes — after Phase 06.1's gap-closure fix for the previously-FAILED draining-latch truth.

## Headline

The single genuine functional gap from the 2026-09-16 pass — `ClientManager.isDraining()` permanently latching after an unrelated engine-only restart in split-mode topology — is confirmed **fixed** in the current codebase and independently re-proven, not taken on SUMMARY.md's word. No new functional regressions were found. Status is `human_needed` rather than `passed` solely because two carried-forward bookkeeping/ownership decisions (the roadmap's literal "30s" wording vs. the deliberate 90s drain timeout, and `fly.toml`'s un-bumped `kill_timeout`) remain unresolved from the prior pass, plus one new item surfaced by this pass's own discovery that the project now has a real live Render deployment whose full end-to-end race flow has never actually been confirmed against it.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1a | SIGTERM during active race triggers graceful shutdown: in-flight rooms get `error` frame "server shutting down", client shows graceful toast, race runs to completion | ✓ VERIFIED | Code path: `apps/engine/src/index.ts:36` / `apps/gateway/src/index.ts:125-162,193-211` implement drain; `apps/web/src/App.tsx:210-212` renders "Server Restarting" title + distinct body for `SERVER_SHUTTING_DOWN` (not the generic "Error" fallback). Behavioral proof for the *active-race* clause specifically comes from `06-UAT.md` Test 2 (unchanged, live automated probe previously recorded: race ran to completion server-side, both clients received `race_end` before process exit) plus re-running `bun test apps/engine/src/__tests__/drain.test.ts apps/gateway/src/__tests__/drain.test.ts packages/shared/src/__tests__/bun-version-pin.test.ts` live = 19 pass, 0 fail. Separately, this pass **built and ran the actual current Dockerfile** end-to-end (`docker build` → `docker run` → `docker stop -t 15`) to confirm the container-level SIGTERM mechanics still work after the two later, unrelated Dockerfile edits: completed in 0.456s wall time with exit code 0 (not the 15s SIGKILL ceiling), and raw container logs show `{"pid":1,...,"sig":"SIGTERM","msg":"[gateway] shutting down..."}` → `{"msg":"[engine] worker stopped"}` — confirming `bun` is PID 1 (exec-form ENTRYPOINT, no shell wrapper) and receives SIGTERM directly. That specific run was against an idle container (no active race), so it proves the container/signal-delivery mechanics, not the active-race drain-to-completion behavior — that clause rests on the drain.test.ts suite and 06-UAT.md as stated above. See spot-check note below on one intermittent full-suite timeout in the web client toast test — reproduced, root-caused, does not change this verdict. |
| 1b | "No orphaned WS connections after 30s" (literal roadmap bound) | ⚠️ see Human Verification #1 | Unchanged since 2026-09-16: D-02 deliberately extends the drain hard-cap to 90s; behavior itself (drain completes, no orphaned connections once drained) is verified, but the literal "30s" wording (`ROADMAP.md:191`, confirmed still present) has never been formally reconciled via an accepted override or a roadmap text edit. |
| 2 | Gateway rejects new room joins/creation ONLY during an actual drain cycle, not permanently after unrelated events (the phase's one previously-FAILED truth) | ✓ VERIFIED (fixed by Phase 06.1) | **Re-derived independently, not trusted from 06.1-SUMMARY.md.** Read `apps/gateway/src/ws/client-manager.ts` directly: `ownDrainStarted` flag + `markOwnDrainStarted()`/`hasOwnDrainStarted()` accessors exist, reset in `clear()`. Read `apps/gateway/src/index.ts:128-133`: `drain()` calls `manager.setDraining(true)` then `manager.markOwnDrainStarted()` synchronously, before any `await` — no interleaving window. Read `apps/gateway/src/ws/handlers.ts:100-116`: the `"drained"` bridge-event case now reads `if (!manager.hasOwnDrainStarted()) { manager.setDraining(false); }` — i.e. an unrelated cycle's `"drained"` event (this gateway never called its own `drain()`) resets the latch; the gateway's own real shutdown cycle (which does call `drain()`, setting the flag first) does not get reset early. Ran the specific named regression test live: `bun test apps/gateway/src/__tests__/drain.test.ts -t "06.1"` = **1 pass, 0 fail, 4 expect() calls** (the exact test simulating an independent engine-only restart, asserting `create_room` still works afterward). This is a state-transition/cancellation invariant (Step 3 "behavior-dependent truth") — VERIFIED here because a named passing test exercises the transition directly, not inferred from presence alone. |
| 3 | Bun version pinned in `package.json` + Dockerfile, with drift protection | ✓ VERIFIED | `.bun-version` = `1.3.2`; all 4 Dockerfiles (`Dockerfile`, `apps/web/Dockerfile`, `apps/gateway/Dockerfile`, `apps/engine/Dockerfile`) still contain `ARG BUN_VERSION=1.3.2` (re-grepped live, unchanged since 09-16 despite the two later, unrelated Dockerfile edits — symlink-race fix and image-size fix — neither touched the version pin). `bun test packages/shared/src/__tests__/bun-version-pin.test.ts` re-run live = included in the 19-pass run above. |
| 4 | CI runs `bun run start` against pinned Bun before every deploy | (deferred) | Unchanged — still explicitly out of scope per 06-CONTEXT.md and no `.github/` workflow exists in the current tree. Not a gap. |
| 5 | Anti-cheat regression tests confirm: future-timestamped `clientTs` rejected, sub-20ms intervals rejected, pre-start keystrokes rejected, WPM cap 250 enforced | ✓ VERIFIED (documented deviation on the WPM-250 clause, unchanged) | `bun test apps/engine/src/__tests__/validate-keystroke.test.ts` re-run live = **26 pass, 0 fail, 86 expect() calls**, including the `D-07 bypass scenarios` block. Re-confirmed the literal WPM-250 clamp still does not exist in `validate-keystroke.ts` (same documented ROADMAP-vs-implementation deviation as the 09-16 pass — the ~20ms floor structurally caps WPM around 600, transparently documented, not silently missed). |
| 6 | React Compiler opt-in if profiling shows cursor render as bottleneck | ✓ VERIFIED (skip, per decision) | Unchanged — D-08 skip decision still stands; no new profiling data contradicts it. |
| 7 | README documents deploy strategy, restart behavior, graceful shutdown, local dev workflow | ✓ VERIFIED | `README.md`'s `### Deploy Strategy` (`fly deploy --strategy immediate --remote-only`), `### Graceful Shutdown` (drain + `kill_timeout` gap flagged), `### Local Smoke Test`, `### Environment Variables` sections all still present and accurate against current source. **New finding, not a Phase-6 regression:** README's later-added `### Render.com` section (line 93) now contains a stale claim about `render.yaml`'s `maxShutdownDelaySeconds` (removed by a later, separate commit) — see Advisory section below. Does not affect this truth, which is scoped to the Fly.io/restart/shutdown/local-dev content SC4 actually names. |
| 8 | Live deploy URL serves the full game end-to-end | ⚠️ see Human Verification #3 | Changed since 2026-09-16: a real live Render deployment now exists (`render.yaml`, confirmed reachable and exercised in `07.1-VERIFICATION.md` against `https://typing-race-krhc.onrender.com/`), but the specific two-browser race→results→rematch flow this truth describes has never been confirmed against it — only a narrower two-tab session-takeover scenario (07.1) and this pass's own local container smoke checks. No longer a clean "N/A, permanently descoped" — see Human Verification #3. |

**Score:** 6/9 truths verified (1a, 2, 3, 5, 6, 7). 0 present-but-behavior-unverified. Truths 1b and 8 require a human decision/action (not failures). Truth 4 remains an explicitly out-of-scope deferral (unchanged).

### Advisory (New Scope, Unevidenced)

New-scope findings surfaced during this re-verification pass, reported for awareness — none block the phase and none revert the closed draining-latch gap.

| # | Finding | Category | Why Advisory |
|---|---------|----------|---------------|
| 1 | README.md's Render.com section (line 93) still claims `render.yaml`'s `maxShutdownDelaySeconds: 95` exists; that key was removed by a later, separate commit (f775c80) as unsupported on Render's free tier | other | Documentation drift in a post-Phase-6-added section (Render wasn't part of Phase 6's contracted scope); the Fly.io-scoped content SC4 actually names remains accurate. Deterministic evidence exists (grep + `git show`) but this is later, unrelated deploy-hardening work per the task's own framing, not a Phase 6 regression to score against |
| 2 | `ClientManager.shuttingDownAnnounced` is still a `clear()`-only latch — same defect class 06.1 fixed for `draining`, left unaddressed for the `SERVER_SHUTTING_DOWN` broadcast-once gate | architectural | Already surfaced and adjudicated non-blocking in 06.1-VERIFICATION.md (status: passed, 2/2) as a recommended future "06.2" follow-up; not in 06.1's own stated success criteria; no failing test exists for it. Carrying forward the existing adjudication, not re-litigating it into a blocker |
| 3 | `.planning/ROADMAP.md` still shows Phase 6's row ("0/4, Not started") and its 4 plan checkboxes as unchecked despite Phase 6 + 06.1 being complete and now re-verified passing in substance | other | Pure documentation bookkeeping drift, carried forward unresolved from the 2026-09-16 pass; no functional impact; no evidence it was touched by any commit since |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `.planning/ROADMAP.md` | 199-203, 225 | Stale `[ ]`/"Not started" markers for a completed, now-passing phase | 📋 Advisory | Documentation drift only, carried forward unresolved from 09-16, no code impact |
| `README.md` | 93 | Stale `maxShutdownDelaySeconds: 95` claim; key was removed from `render.yaml` by a later commit | 📋 Advisory | Doc-accuracy drift in a post-Phase-6-added section; the Fly.io-scoped content SC4 actually names remains accurate |

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in any of the gateway drain-lifecycle files, the Dockerfile, `render.yaml`, or `README.md` (re-scanned live).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/gateway/src/ws/client-manager.ts` | `ownDrainStarted`/`markOwnDrainStarted()`/`hasOwnDrainStarted()`, cycle-scoped `draining` reset | ✓ VERIFIED | Present, substantive, wired — confirmed by direct read (lines 10-24, 132) |
| `apps/gateway/src/ws/handlers.ts` | `"drained"` handler conditionally resets `draining` latch via `hasOwnDrainStarted()` | ✓ VERIFIED | Lines 100-116, confirmed by direct read |
| `apps/gateway/src/index.ts` | `drain()` marks `ownDrainStarted` synchronously before any await; SIGTERM handler clears stale `drained` latch first | ✓ VERIFIED | Lines 128-133 (mark), 193-211 (SIGTERM handler + `setDrained(false)` before `drain()`) |
| `apps/gateway/src/__tests__/drain.test.ts` | 06.1 regression test proving independent-restart scenario | ✓ VERIFIED | Named test re-run live: 1 pass, 0 fail |
| `Dockerfile` (root) | Graceful SIGTERM (exec-form ENTRYPOINT, no shell), non-root user, HEALTHCHECK | ✓ VERIFIED | Built and ran the actual image (see Behavioral Spot-Checks) — `USER bun` (uid 1000, confirmed via `docker exec ... id`), `HEALTHCHECK` reports `"healthy"` after `/health` returns 200, `docker stop` exits gracefully in <1s |
| `.bun-version`, all 4 Dockerfiles | `BUN_VERSION=1.3.2` pin | ✓ VERIFIED | Unchanged since 09-16, re-confirmed live |
| `apps/web/src/App.tsx` | `SERVER_SHUTTING_DOWN` → distinct toast | ✓ VERIFIED | Lines 210-212, confirmed by direct read; behavioral test passes in isolation (see spot-checks) |
| `README.md` | Deploy strategy / shutdown / smoke test docs | ✓ VERIFIED (with one stale later-added clause, see advisory) | Fly.io-scoped SC4 content accurate; Render section has one stale line |
| `scripts/smoke-test.sh` | Local production smoke test | ✓ VERIFIED (present; not re-executed this pass — superseded by the actual Docker build+run+stop cycle performed directly against the real Dockerfile) | |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `EngineWorker.drain()` / independent engine restart | Gateway `ClientManager` | EventBridge `"draining"`/`"drained"` events → `bindBridgeToGateway` | ✓ WIRED, cycle-scoped | Both the `drained` latch (CR-B1, fixed pre-09-16) and the `draining` latch (06.1, fixed post-09-16) are now correctly cycle-scoped. Confirmed by direct code read plus the passing 06.1 regression test. |
| `apps/gateway/src/ws/dispatch.ts` | `ClientManager.isDraining()` | Guards `create_room`/`join_room`/`start_race` | ✓ WIRED | Confirmed at `dispatch.ts:72`, unchanged; now correctly transient rather than permanently latching. |
| SIGTERM (container PID 1) | `apps/gateway/src/index.ts` `onShutdown` | Direct `process.on("SIGTERM", ...)`, exec-form Docker ENTRYPOINT (no shell wrapper) | ✓ WIRED | Directly observed in the live container run: log line `{"pid":1,...,"sig":"SIGTERM","msg":"[gateway] shutting down..."}` — `bun` is PID 1 and receives the signal without a `docker-entrypoint.sh`/shell intermediary that could swallow it. |
| SIGTERM handler | `App.tsx` toast | `SERVER_SHUTTING_DOWN` error frame → `RaceClient.dispatch` → `App.tsx` msg.code branch | ✓ WIRED | Confirmed via code read; behavioral test passes standalone (see spot-checks for the one full-suite-load flake). |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Gateway + Engine drain tests + Bun-pin drift guard | `bun test apps/engine/src/__tests__/drain.test.ts apps/gateway/src/__tests__/drain.test.ts packages/shared/src/__tests__/bun-version-pin.test.ts` | 19 pass, 0 fail | ✓ PASS |
| 06.1's specific independent-restart regression test | `bun test apps/gateway/src/__tests__/drain.test.ts -t "06.1"` | 1 pass, 0 fail, 4 expect() calls | ✓ PASS |
| Anti-cheat regression tests | `bun test apps/engine/src/__tests__/validate-keystroke.test.ts` | 26 pass, 0 fail | ✓ PASS |
| Full monorepo typecheck | `bun run --filter '*' typecheck` | 4/4 workspaces exit 0 | ✓ PASS |
| Full monorepo test suite (run 1) | `bun run --filter '*' test` | gateway 20 pass; web **1 failed, 88 passed** (`App — SERVER_SHUTTING_DOWN error frame > renders a distinct 'Server Restarting' toast...`, timed out at 5000ms default vitest timeout) | ⚠️ FLAKY — investigated below |
| App.test.tsx toast test, isolated (3 separate runs) | `cd apps/web && bunx vitest run -t "Server Restarting"` ×3 | 1 pass / 1 pass / 1 pass, each ~1.3-1.8s actual test time | ✓ PASS ×3 |
| App.test.tsx toast test, extended timeout | `bunx vitest run -t "Server Restarting" --testTimeout=20000` | 1 pass | ✓ PASS |
| Full monorepo test suite (run 2, immediately after) | `bun run --filter '*' test` | gateway 20 pass; web **89/89 pass** | ✓ PASS |
| Docker image build (actual current root Dockerfile) | `docker build -t typing-race-verify:phase6 .` | Success, no errors; final image 281MB (259MB `oven/bun:1.3.2-slim` base + ~22MB app layers, `/app` itself ≈19MB per the later size-fix commit's own claim) | ✓ PASS |
| Non-root runtime user | `docker exec ... whoami` / `id` | `bun` / `uid=1000(bun) gid=1000(bun)` | ✓ PASS |
| Health endpoint + Docker HEALTHCHECK | `curl .../health` → 200; `docker inspect --format '{{json .State.Health}}'` | `200`; `{"Status":"healthy","FailingStreak":0,...}` | ✓ PASS |
| Graceful SIGTERM via `docker stop` | `time docker stop -t 15 ...` + raw `docker logs` | Returned in 0.456s (not the 15s grace-period ceiling), exit code 0; logs show `sig":"SIGTERM"` → `shutting down...` → `worker stopped` → clean exit | ✓ PASS |

**Flaky test root-cause note:** The one failure in the first full-suite run was investigated directly, not dismissed. `apps/web`'s vitest config has no `testTimeout` override (default 5000ms). Running the full 13-file/89-test suite concurrently pushed this one test's actual execution past the 5000ms wall-clock boundary (observed failure at ~5271-5401ms elapsed) purely from parallel resource contention — the same test passes reliably (3/3) when run in isolation, and the entire suite passed 89/89 on an immediate re-run with no code changes in between. This is a timing-margin/CI-environment flakiness risk (the suite's cold-import cost has grown to 18-22s as more features were added since 09-16), not a functional defect in the `SERVER_SHUTTING_DOWN` toast logic — the assertions themselves (`getByText("Server Restarting")`, exact body copy, `queryByText("Error")` is null) passed every time the test actually got to run. Recorded for awareness (a `testTimeout` bump for this file, or for the suite, would remove the risk); does not change truth 1a's VERIFIED status, which also has independent evidence from `06-UAT.md` Test 2 and the Docker-level SIGTERM confirmation.

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention in this project; no probes declared in phase PLAN/SUMMARY files. Skipped — the live Docker build/run/stop cycle above and the direct test runs cover the equivalent ground more thoroughly than a probe script would.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| REQ-12 | 06-01, 06-02, 06-03, 06-04, 06.1-01 | Fly.io deploy finalized (infra built + smoke-tested; live Fly deploy descoped, project deployed to Render instead) | ✓ SATISFIED for the contracted scope, with the caveat in Human Verification #3 | Deploy infra present and correct (Dockerfile ×4, fly.toml, render.yaml, scripts/deploy.sh); graceful shutdown/drain now correctly cycle-scoped end-to-end (06.1 fix confirmed); Bun pinned; local Docker smoke-run passes live; a real Render deployment exists and is partially exercised live (07.1) but not for SC5's full flow |

No orphaned requirements — REQ-12 remains the only requirement ID mapped to Phase 6 (+06.1) across all plans.

### Decision Coverage

06-CONTEXT.md's decisions (D-01 through D-08) all still show up in the current codebase and/or README exactly as in the 09-16 pass — re-checked D-02 (90s drain, still in `index.ts`/`engine.ts`), D-07 (bypass test block, still present and passing), D-08 (React Compiler skip, still documented). No regression.

### Human Verification Required

#### 1. SC1's literal "30s" bound vs. D-02's deliberate 90s drain timeout (carried forward, unresolved)

**Test:** Review D-02 in `06-CONTEXT.md` and decide whether to formally override SC1's "no orphaned WS connections after 30s" wording, or update `ROADMAP.md:191` to 90s.
**Expected:** An explicit decision recorded as either a VERIFICATION.md `overrides:` entry or a `ROADMAP.md` text update.
**Why human:** Still unreconciled since 2026-09-16 — no override block or roadmap edit has been made in the interim. The underlying drain behavior is verified; only the numeric bound in the roadmap's original wording is unreconciled.

#### 2. `fly.toml`'s `kill_timeout = "10s"` vs. the 90s drain window — ownership (carried forward, unresolved)

**Test:** Confirm whether this needs a tracked follow-up, or is moot now that the project's actual live deployment target is Render (`render.yaml`), not Fly.io.
**Expected:** Either an owning phase/backlog entry, or an explicit "moot — Fly.io is not the live deploy path" acknowledgment.
**Why human:** `fly.toml:12` still reads `"10s"`, unchanged since 09-16. Lower practical urgency now that Render is the actual live target (whose own equivalent tradeoff is already documented and accepted in `render.yaml`'s comments), but this specific Fly.io loose end is still formally unowned.

#### 3. Confirm the full live-deploy race flow against the real Render URL (new this pass)

**Test:** Two browsers join the same room on `https://typing-race-krhc.onrender.com/` (or the current live Render URL), race to completion, confirm results board renders, confirm rematch works.
**Expected:** A recorded PASS (same pattern as 07.1's live two-tab test result), or an explicit decision that SC5 remains formally descoped from v1.0 despite a live URL now existing.
**Why human:** A real, reachable Render deployment now exists (confirmed in `07.1-VERIFICATION.md`, live-tested for a narrower two-tab session-takeover scenario), which changes the calculus from the 09-16 pass's "no live deploy exists at all, moot" position. The specific end-to-end flow SC5 names (join → race → results → rematch, two browsers) has not been confirmed against it by anyone, and this is real-time, cross-browser behavior no automated check in this repo can exercise.

### Gaps Summary

No functional gaps. The one genuine defect from the prior pass — the gateway's `draining` state permanently latching after an unrelated engine-only restart in split-mode topology — is confirmed fixed by Phase 06.1, independently re-verified here via direct code reading of `client-manager.ts`/`index.ts`/`handlers.ts` and a live re-run of the specific named regression test (1 pass, 0 fail). The actual root `Dockerfile`, rebuilt and run fresh for this verification (not assumed from a prior report), still satisfies all three of Phase 6's infrastructure guarantees after the two later, unrelated Dockerfile fixes (workspace-symlink race, image-size shrink): graceful SIGTERM drain (confirmed via `docker stop` exiting cleanly in under half a second, with log evidence PID 1 received the signal directly), non-root runtime user (`bun`, uid 1000), and a working `HEALTHCHECK` (reports `"healthy"`).

Status is `human_needed` rather than `passed` purely because of three items requiring a human decision, none of which reflect broken or unverified code: two are carried-forward bookkeeping/ownership decisions unchanged since the prior pass (the roadmap's literal "30s" wording, and `fly.toml`'s un-bumped `kill_timeout`), and one is newly surfaced by this pass's own discovery that the project now has a real live Render deployment whose full end-to-end race flow has never actually been confirmed against it — a materially different situation from the 09-16 pass's "no live deploy exists" framing that justified treating SC5 as flatly N/A.

Three advisory items are carried forward or newly noted (see Advisory section above) — none are blocking, per the task's own framing that later, unrelated deploy-hardening work should not be scored as a Phase 6 regression.

---

_Verified: 2026-09-22T17:33:50Z_
_Verifier: Claude (gsd-verifier)_
