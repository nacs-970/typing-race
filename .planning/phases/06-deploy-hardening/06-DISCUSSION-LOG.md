# Phase 6: Deploy + Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-08
**Phase:** 06-deploy-hardening
**Areas discussed:** Graceful shutdown drain semantics, Bun version pin strictness, Anti-cheat regression test scope, React Compiler opt-in

**Scope note:** User explicitly excluded the CI-gate item ("CI runs `bun run start` against pinned Bun before every deploy") before this discussion began — "everything except CI gate." Kept: graceful shutdown, Bun pinning, anti-cheat tests, React Compiler opt-in.

---

## Graceful Shutdown Drain Semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Drain: wait for active races, then exit | Reject new joins, let races finish or hit a max timeout, then broadcast + exit | |
| Notify + fast exit | Broadcast shutdown notice immediately, short grace window, exit — relies on Phase 4 reconnect | |
| Both: notify immediately, then drain | Broadcast right away AND wait for active races (bounded timeout) before exiting | ✓ |

**User's choice:** Both: notify immediately, then drain.

| Option | Description | Selected |
|--------|-------------|----------|
| 30s | Matches Fly.io's default SIGTERM→SIGKILL grace | |
| 60s | Covers longest race, needs fly.toml kill_timeout bump | |
| No timeout | Wait for all rooms to empty naturally — risky for a deploy hook | |

**User's choice:** Other (free text) — 90s.
**Notes:** User deliberately chose 90s over the recommended 30s, prioritizing full race coverage over matching Fly.io's default grace window. Flagged in CONTEXT.md that `fly.toml`'s `kill_timeout` will need bumping to match whenever deploy work resumes.

| Option | Description | Selected |
|--------|-------------|----------|
| Engine signals Gateway via event bridge | Engine publishes a 'draining' event over the existing EventBridge; Gateway subscribes | ✓ |
| Gateway gets its own SIGTERM independently | Uncoordinated, no single source of truth | |
| Health check flag | Gateway polls Engine's health endpoint for a draining flag | |

**User's choice:** Engine signals Gateway via event bridge.

---

## Bun Version Pin Strictness

| Option | Description | Selected |
|--------|-------------|----------|
| Exact pin everywhere | .bun-version + tightened engines.bun + all Dockerfiles exact | |
| Keep engines range, add .bun-version as dev default | Range stays for compatibility; .bun-version pins local dev; Dockerfiles pin exact for prod | ✓ |
| Range only, no exact pin | Current state as-is | |

**User's choice:** Keep engines range, add .bun-version as dev default.

| Option | Description | Selected |
|--------|-------------|----------|
| All 4, same exact version | Root, web, gateway, engine Dockerfiles all pin bun:1.3.2 | ✓ |
| Only gateway + engine | web could use plain Node for its build stage instead | |

**User's choice:** All 4, same exact version.

---

## Anti-Cheat Regression Test Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Unit tests directly on validator | Isolated tests per check, fast, precise localization | ✓ |
| Integration tests through the engine | Drives fake gateway events through EngineWorker | |
| Both: unit + one integration smoke test | More coverage, more time | |

**User's choice:** Unit tests directly on validator.

| Option | Description | Selected |
|--------|-------------|----------|
| Plain regression suite | One valid + one violation test per check (8 tests) | |
| Regression + documented bypass scenarios | Adds named bypass-attempt tests (replay, spoofing, impossible WPM) | ✓ |

**User's choice:** Regression + documented bypass scenarios.

---

## React Compiler Opt-In

| Option | Description | Selected |
|--------|-------------|----------|
| Skip entirely | Phase 5's transform3d cursor rendering already avoids the perf concern; no measured bottleneck | ✓ |
| Quick profiling pass first | Measure with React DevTools Profiler before deciding | |

**User's choice:** Skip entirely.

---

## Claude's Discretion

- Dockerfile base-image tag styling (alpine/slim variant) — pin the version, styling open.
- Anti-cheat test file location — co-locate `validator.test.ts` next to `validator.ts`, matching existing conventions.

## Deferred Ideas

- CI gate (`.github/workflows` running `bun run start` against pinned Bun) — deferred per user's explicit pre-discussion scope decision.
- `fly.toml` `kill_timeout` bump to match the 90s drain window — deferred alongside CI/deploy work, flagged so it isn't forgotten.
