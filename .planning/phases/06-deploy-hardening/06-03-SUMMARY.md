---
phase: 06-deploy-hardening
plan: 03
status: complete
commit: TBD
completed: 2026-09-08T09:42:00.000Z
---

# 06-03: Anti-Cheat Bypass Tests, Deploy Docs, Local Smoke Test — Summary

## What shipped

- **`apps/engine/src/__tests__/validate-keystroke.test.ts`**: added a `D-07 bypass
  scenarios` describe block plus boundary cases — replay-attack (accept once,
  replay 3x spaced ≥20ms apart, WPM/progress does not inflate), replay sub-boundary
  (<20ms replay rejects RATE_LIMITED), claimed-impossible-WPM (spoofed clientTs
  10 minutes in the past does not affect `currentWpm`, verified against an
  independently-computed expected value), and exact min-interval boundary
  (19ms reject / 20ms accept / 21ms accept). All 22 pre-existing tests untouched.
  `apps/engine/src/race/validate-keystroke.ts` was NOT modified — regression
  coverage only.
- **`README.md`**: added `### Deploy Strategy` (`fly deploy --strategy immediate
  --remote-only`, rationale), `### Graceful Shutdown` (drain behavior from 06-01,
  flags `fly.toml`'s current `kill_timeout = "10s"` as needing a bump to ≥90s
  before any real deploy — not changed here), `### Local Smoke Test`, and a
  React Compiler skip note (D-08). `fly.toml` was NOT modified. No 250 WPM clamp
  was added — the ROADMAP-vs-implementation mismatch is documentation-only per
  the plan's explicit flag.
- **`scripts/smoke-test.sh`**: new local-only smoke test — builds, boots the
  unified server, polls `/health`, opens a WS connection and awaits `hello`,
  tears down via `trap EXIT`, prints `SMOKE OK`/exit 0 on success.

## How it was built

Delegated to agy (Gemini 3.1 Pro) on branch `phase-06-deploy-hardening`. The run
wrote all three deliverables to disk but timed out ("timeout waiting for
response") before running its own verification or committing — same failure
shape as 06-01's first pass. Verified and committed by Claude directly instead
of re-delegating, since the content was already present and just needed checking.

## Verification

All re-run independently by Claude (never trusted agy's unfiled self-report):

- `bun test apps/engine/src/__tests__/validate-keystroke.test.ts`: 26 pass, 0 fail
  (22 pre-existing + 4 new), output contains `D-07 bypass scenarios`.
- README: `grep -c '^### (Deploy Strategy|Graceful Shutdown|Local Smoke Test)$'` = 3;
  `--strategy immediate`, `kill_timeout`, `10s`, `react compiler` (case-insensitive)
  all present. `10s` cross-checked against `fly.toml`'s actual `kill_timeout` value.
- `git status`/`diff` on `fly.toml`, `apps/engine/src/race/validate-keystroke.ts`,
  `apps/engine/src/race/scoring.ts`: no changes. No `250` WPM clamp anywhere in the diff.
- `scripts/smoke-test.sh`: `bash -n` clean, then actually executed end-to-end
  (build → boot → health-check 200 → WS hello frame → teardown) — printed
  `SMOKE OK`, exit 0.
- `bun run --filter '*' typecheck`: all 4 workspaces, exit 0.
- `bun run --filter '*' test`: engine 90 pass, gateway 15 pass, web 77 pass, all 0 fail.

## Deviations from plan

None. The "250 WPM cap" ROADMAP/implementation mismatch and the CI-gate/live-deploy
deferral (criteria #2/#5) are surfaced in README per the plan's explicit instruction,
not silently resolved.

## Phase 6 status

All 4 plans (06-01, 06-02, 06-04, 06-03) complete. Phase 6 (Deploy + Hardening) done.
