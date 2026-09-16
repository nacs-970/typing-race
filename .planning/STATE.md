---
gsd_state_version: "1.0"
milestone: v1.0
current_phase: 06
current_phase_name: Deploy + Hardening
status: complete
stopped_at: Phase 07.1 context gathered
last_updated: "2026-09-16T06:52:14.245Z"
last_activity: 2026-09-08
last_activity_desc: Completed Phase 6 (06-02 bun-version pin, 06-04 client toast, 06-03 anti-cheat bypass tests + deploy docs + smoke test), committed 6a17b31
state_head: 45ff37f53224abf28d036080a991161eb982af7c
progress:
  total_phases: 8
  completed_phases: 2
  total_plans: 27
  completed_plans: 27
milestone_name: milestone
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-30)

**Core value:** Two connected clients see each other's cursor in real time and the race ends with a fair, identical WPM/accuracy score.
**Current focus:** All 7 phases complete — v1.0 milestone fully executed

## Current Position

Phase: 06 (Deploy + Hardening) — COMPLETE (all 7 phases now complete)
Plan: 4/4 complete
Status: Ready for milestone completion / PR review
Last activity: 2026-09-08 — Phase 6 finished (06-02, 06-04, 06-03), branch phase-06-deploy-hardening, HEAD 6a17b31

Progress: [████████████████████] 100% (7/7 phases)

## Performance Metrics

**Velocity:**

- Total plans completed: 3 (3 foundation + 4 race engine)
- Average duration: 21 min
- Total execution time: 2.5 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 — Foundation | 3/3 | 3 | 18 min |
| 2 — Race Engine | 4/4 | 4 | 21 min |
| 3 — Race Track + WPM | 4/4 | - | - |
| 4 — Reconnect | 5/5 | - | - |
| 5 — Frontend Polish | 4/4 | - | - |
| 6 — Deploy + Hardening | 4/4 | - | - |
| 7 — Split into N-tier architecture | 3/3 | - | - |

**Recent Trend:**

- Last 4 plans: 02-01 (18 min), 02-02 (22 min), 02-03 (17 min), 02-04 (20 min)
- Trend: stable execution time around 20 min/plan as patterns established

*Updated after each plan completion*

## Accumulated Context

### Decisions

Full log in PROJECT.md Key Decisions table. Recent decisions affecting current work:

- Phase 1: bun-workspace monorepo (root + `apps/server`, `apps/client`, `packages/shared`); Bun-native WebSocket (not Hono `upgradeWebSocket`) for typed `ws.data`; Zod 4 discriminated unions as single source of wire schema truth
- Phase 1 Plan 01 (executed): pinned bun@1.3.2 (per user), `@types/bun@1.4.0`; store-bridge pattern for non-React → Zustand updates; `allowImportingTsExtensions` enabled for Bun-native .ts imports
- Phase 2: server-authoritative keystroke counting with 4 anti-cheat checks (server-timestamp, pre-start reject, min-interval ≥20ms, char-match); two-phase NTP-style clock sync; 6-char room code, no `I/O/0/1`, collision retry once
- Phase 2 Plan 01 (executed): nanoid.customAlphabet for room codes; shared/PlayerSummary in race.ts (not messages.ts) to avoid dual-export; Zod 4 UUID v4 strictness required RFC4122-conformant test fixtures
- Phase 2 Plan 02 (executed): FSM whitelist as `Record<RaceState, ReadonlyArray<RaceState>>`; broadcast helpers swallow individual send errors; `asWs()` cast helper for tests
- Phase 2 Plan 03 (executed): single `Date.now()` in `recordSyncRequest` (t1===t2 OK); injectable fetch for syncClock tests; App.tsx dev "Simulate countdown" button for one-developer verification
- Phase 2 Plan 04 (executed): anti-cheat #1 implicit (frame.clientTs never read for timing); cursor_position throttle reuses `lastKeystrokeAt` (Phase 5 may split); `setCursorState` accepts Partial OR function form

- Phase 3 (executed): bundled passage corpus with no-repeat picker; per-character state model; server-only WPM/accuracy computation
- Phase 4 (executed): sessionToken reconnect handshake, 500ms grace period, room sweeper + heartbeat, dynamic host promotion, 60s uniform grace on disconnect
- Phase 5 (executed): isolated 30Hz cursorStore vs 1Hz roomStore, CSS transform3d cursor positioning outside React tree, reconnect progress bar + 4-case error toasts
- Post-milestone (not tracked as a phase, already shipped): corpus category randomization, green-accent white-background theme, distinguishing non-existent-room vs lost-room errors

### Roadmap Evolution

- Phase 7 added: Split into N-tier architecture
- 2026-09-08: STATE.md/ROADMAP.md/state.json were stale (last synced 2026-09-04) — reconciled against actual git history. Phases 1, 3, 4 were marked pending/not-started but SUMMARY.md files + commits confirm they shipped 2026-08-30 through 2026-09-03. Only Phase 6 (Deploy + Hardening) is genuinely unstarted — no phase directory, no CI workflow, no `.bun-version`, no anti-cheat regression suite. Note: SIGTERM handling (a Phase 6 deliverable) already exists ad-hoc in `apps/engine/src/index.ts` and `apps/gateway/src/index.ts`, done alongside the Phase 7 N-tier split.
- Phase 07.1 inserted after Phase 7: Fix multi-tab session takeover regression — session_taken_over event dropped during Phase 7 N-tier split, found by v1.0 milestone audit (URGENT)

### Pending Todos

None yet.

### Blockers/Concerns

- Room-code collision math: ADDRESSED in Plan 01 (3 retries, 887M keyspace, birthday paradox ~0.006% at 10k rooms)
- React Compiler config: MEDIUM confidence, still deferred — no evidence it was revisited in Phase 5. Phase 6 D-08 formally decided: skip (no measured bottleneck).
- `.planning/debug/*.md` (host-promotion/solo-disconnect, lobby-rejoin-race-view, reconnect-cursor-reset) are marked "Diagnosed" but verified FIXED in current code (landed in Phase 4 Plan 05, commit `04-05`). Notes are stale history, not open work — safe to leave as record or archive.
- Phase 6 COMPLETE: `.bun-version` pinned + Dockerfile drift guard (06-02), App.tsx SERVER_SHUTTING_DOWN toast (06-04), anti-cheat bypass regression tests + deploy docs + local smoke test (06-03). `.github/` CI workflow and `fly deploy` execution remain explicitly out of scope (deferred to a future deploy-focused pass, per 06-CONTEXT.md) — the only genuinely open follow-up work.
- ROADMAP-vs-implementation mismatch surfaced (not silently resolved): ROADMAP's "WPM cap 250 enforced" criterion has no matching clamp in code — the real structural ceiling from the 20ms min-interval floor is ~600 WPM. Documented in README, not changed (no D-NN decision authorized adding a clamp).
- fly.toml's `kill_timeout = "10s"` is below the 90s drain window (D-02) — must be bumped to ≥90s before any real Fly.io deploy, or SIGKILL will cut drain short mid-shutdown. Flagged in README; fly.toml itself intentionally untouched this phase.
- agy-delegate reliability note (confirmed twice, 06-01 and 06-03): a single delegation covering multiple plans/tasks reliably times out ("timeout waiting for response") on the final response after already writing files to disk — never on the writes themselves. Always delegate one plan per call, and always verify + commit directly rather than trusting the run to finish its own report. See `.planning/phases/06-deploy-hardening/06-01-SUMMARY.md` and `06-03-SUMMARY.md`.

## Deferred Items

Items acknowledged and deferred, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| Feature | Live WPM/accuracy during race | Deferred | v1 planning | v2 polish |
| Feature | 2-3 themes / dark mode toggle | Deferred | v1 planning | v2 polish |
| Feature | Reaction emoji on race-end | Deferred | v1 planning | v2 polish |
| Feature | Sound effects | Deferred | v1 planning | v2 polish |
| Feature | Cursor interpolation polish | Deferred | Phase 5 | v1 |
| Feature | Per-char error highlighting | Deferred | Phase 3 | v1 |
| Feature | Persistent leaderboards | Out of scope | PROJECT.md | v1 |
| Feature | Accounts / login | Out of scope | PROJECT.md | v1 |

## Session Continuity

Last session: 2026-09-16T06:52:11.148Z
Stopped at: Phase 07.1 context gathered
Resume file: .planning/phases/07.1-fix-multi-tab-session-takeover-regression/07.1-CONTEXT.md
