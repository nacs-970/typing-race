---
phase: 01-foundation
verified: 2026-09-23T00:35:00Z
status: closed_via_override
score: 5/5 must-haves verified (4 verified fresh, 1 carried-forward accepted override)
covered_files: [".dockerignore", ".planning/PROJECT.md", ".planning/phases/01-foundation/01-01-PLAN.md", ".planning/phases/01-foundation/01-01-SUMMARY.md", ".planning/phases/01-foundation/01-02-PLAN.md", ".planning/phases/01-foundation/01-02-SUMMARY.md", ".planning/phases/01-foundation/01-03-PLAN.md", ".planning/phases/01-foundation/01-03-SUMMARY.md", ".planning/phases/01-foundation/01-UAT.md", ".planning/phases/01-foundation/01-VALIDATION.md", "Dockerfile", "apps/gateway/package.json", "apps/gateway/src/index.ts", "apps/web/src/App.tsx", "apps/web/src/net/ws.ts", "apps/web/vite.config.ts", "bunfig.toml", "fly.toml", "package.json", "packages/shared/src/index.ts", "packages/shared/src/messages.ts", "scripts/deploy.sh", "tsconfig.base.json"]
covered_digest: "v1:sha256:1ae6dc89f75835fd487b41cd712d946be1cb73531ddc9655cc860fd9d84246f5"
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "bun run --filter '*' build produces both a server-side dist and a client dist"
    reason: >
      Bun executes .ts files natively — no transpile/bundle step needed, unlike a Node.js
      deployment target. The Dockerfile ENTRYPOINT and `bun run start` both run
      apps/gateway/src/index.ts directly from source; this has been true and functionally
      proven (typecheck clean, health/WS/Docker all pass) since Phase 1. Only apps/web needs
      a build step (browsers can't execute TS/JSX). ROADMAP SC1's wording predates this and
      was never updated once the Bun-native approach settled.
    accepted_by: "atithep_thepkit@cmu.ac.th"
    accepted_at: "2026-09-23"
re_verification:
  previous_status: closed_via_override
  previous_score: "4/5 verified + 1 override (image-size gap already recorded fixed in prior file, but not independently re-measured until this pass)"
  gaps_closed:
    - "Container image under the 200MB budget — independently re-measured this session at 19M /app (both a BuildKit-cached build and a from-scratch `--no-cache` rebuild), confirming the prior file's 221M->19M fix claim first-hand rather than trusting it"
  gaps_remaining: []
  regressions: []
advisory: []
gaps: []
deferred: []
audit_acknowledged:
  milestone: v1.0
  at: 2026-09-22
  status: closed_via_override
---

# Phase 1: Foundation Verification Report

**Phase Goal:** Establish a bun-workspace monorepo with shared Zod schemas, a Bun+Hono server skeleton with `/health`, a Vite+React client, and a working single-process Bun static + WS pipeline that can be deployed to Fly.io. Validate the full deploy pipeline end-to-end before any game logic.

**Verified:** 2026-09-23T00:35:00Z
**Status:** closed_via_override
**Re-verification:** Yes — independent fresh pass, not a re-read of the prior file's claims. Docker build (both cached AND `--no-cache` from-scratch)/run/measure and a direct non-Docker dev-mode boot were all executed in this session's own process; results below were not copied from `01-VERIFICATION.md`'s prior text.

## Important framing: this phase has since been superseded by Phase 7

Phase 1 shipped `apps/server` (a single Bun+Hono process) and `apps/web`. Phase 7
("split-into-n-tier-architecture") later retired `apps/server` entirely and
replaced it with `apps/gateway` + `apps/engine`, connected via an EventBridge in
`packages/shared/src/bridge.ts`. `apps/web` and `packages/shared` persist
unbroken from Phase 1 through today. Per the original verification's framing,
this supersession is expected and is not counted as a failure — the checks below
verify the foundational patterns still hold in the current, evolved codebase.

## What changed since the 2026-09-16 initial verification

1. **Server-dist deviation** — formally accepted via override by
   `atithep_thepkit@cmu.ac.th` on 2026-09-23. Not re-litigated below; carried
   forward as `PASSED (override)`.
2. **Image-size gap** — the root `Dockerfile` gained a new `prod-deps` build
   stage (commit `d6042c4`, "fix(docker): shrink runtime image by excluding
   apps/web's devDependencies") that installs only `apps/gateway` +
   `apps/engine` production deps via `bun install --production --frozen-lockfile
   --filter='@typing-race/gateway' --filter='@typing-race/engine'`, and the
   `release` stage now copies `node_modules` from that stage instead of the
   client-build-inclusive `deps` stage. This was **independently rebuilt (both
   cached and from-scratch `--no-cache`), run, and measured in this
   verification session** (not read off the prior file) — see Truth 5 below.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `bun install` succeeds; `bun run --filter '*' build` (or its successor) produces both a client dist and a server dist | PASSED (override) | `bun install` re-run live this session: "Checked 243 installs across 288 packages (no changes)". `apps/web/dist/index.html` + hashed `index-BLbnqgo5.css`/`index-DzsCSOr-.js` + `.gz`/`.br` precompressed siblings confirmed present on disk this session — client half genuinely produced (also re-produced via the `--no-cache` Docker rebuild's `client-build` stage). Server half is never bundled to dist (`grep '"build"' package.json apps/gateway/package.json apps/engine/package.json` shows only the root `"build": "bun run --cwd apps/web build"`, unchanged) — this is the literal ROADMAP SC1 deviation, now formally accepted. Override: Bun executes TS source natively — accepted by atithep_thepkit@cmu.ac.th on 2026-09-23. |
| 2 | `bun run dev` (or per-package dev) serves client + server with `/health` returning success | ✓ VERIFIED | Verified two independent ways this session: (a) containerized unified-mode — `curl http://localhost:18099/health` → `{"ok":true,"timestamp":1790097472182,"uptime":3.553848177}`; (b) **direct, non-Docker** boot — `MODE=unified PORT=18097 ENGINE_PORT=18096 bun run --cwd apps/gateway start`, then `curl http://localhost:18097/health` → `{"ok":true,"timestamp":1790098025258,"uptime":2.003067015}` (uptime ~2s confirms a freshly-started process, not a stale listener). Note: the host's default port 8080 was found already occupied by an ambient listener outside this session's process tree at test time (not started by any command in this session, invisible to `ps`/`lsof` in this sandboxed environment) — worked around by using an explicit alternate `PORT`; this is an environment quirk, not a code defect, and does not affect the truth being verified. As previously documented, the server listens on `:8080` (fixed via `env.ts`/Dockerfile `EXPOSE`/`fly.toml internal_port`), not ROADMAP's stated `:3000`/client `:5173` — a deliberate, consistently-applied deviation, unchanged since Phase 1, not a new regression. |
| 3 | `fly deploy` / Docker deploy pipeline produces a working, publicly-servable container (descoped from actual `fly deploy` 2026-09-16) | ✓ VERIFIED | Rebuilt and run **twice** this session, once cached and once genuinely from scratch: (a) `docker build -t typing-race:reverify .` (BuildKit cache hit on every layer since the tree was clean) → ran, confirmed unified-mode log line, `/health`, SPA root, WS `hello` frame, non-root `whoami`; (b) **`docker build --no-cache -t typing-race:reverify-nocache .`** — full from-scratch rebuild (base→deps→client-build→prod-deps→release, `bun install` re-ran fresh: "472 packages installed", `vite build` re-ran fresh: "✓ 149 modules transformed... built in 2.23s") — this rules out a stale/cached image masking a broken pipeline. Ran the from-scratch image: logs show `"[gateway] Running in UNIFIED mode (Gateway + Engine in single process)"` and `"listening"` on `0.0.0.0:8080`; `curl :18098/health` → `{"ok":true,...}`; `docker exec tr-nocache whoami` → `bun`. Both containers and both images removed after testing. |
| 4 | `packages/shared` exports Zod schemas and both server + client import them — no duplicate type definitions | ✓ VERIFIED | `grep -rn "@typing-race/shared" apps/gateway/src apps/engine/src apps/web/src` → 37 real import sites (re-counted live this session). `grep -rl "discriminatedUnion" apps/gateway/src apps/engine/src apps/web/src` → 0 matches outside `packages/shared` (re-checked live, exit 1/no match). `bun run typecheck` (root, 4 workspaces: shared, web, gateway, engine) → exit 0, no errors (re-run live this session). |
| 5 | (Plan 03 must-have) `docker run --rm typing-race:test du -sh /app` reports under 200MB | ✓ VERIFIED (fix confirmed independently, twice) | **This session's own measurement**, not the prior file's claim, taken from two separate containers: cached build → `docker exec tr-reverify du -sh /app` → **19M**; from-scratch `--no-cache` build → `docker exec tr-nocache du -sh /app` → **19M** (identical, confirming the cached result wasn't an artifact of stale layers). Well under the 200MB budget (was 221M at the 2026-09-16 pass). Note on scope: Plan 03's must-have is verbatim `du -sh /app` (the app directory inside the container), not the full Docker image — for completeness, the full image (`docker images` on the `--no-cache` tag) reports **281MB** total, most of which is the `oven/bun:1.3.2-slim` base layer; the must-have being verified is specifically the `/app` payload, and 19M is the correct, literal figure against it. Root cause and fix independently traced in the current `Dockerfile`: a new `prod-deps` stage (`bun install --production --frozen-lockfile --filter='@typing-race/gateway' --filter='@typing-race/engine'`) excludes `apps/web`'s devDependency tree (vite, tailwind, vitest, typescript, react-dom, native binaries for rolldown/lightningcss/tailwind-oxide) from the runtime image; `release` now copies `node_modules` from `prod-deps` instead of `deps`. Confirmed via `git log --oneline -- Dockerfile` (commit `d6042c4`, "fix(docker): shrink runtime image by excluding apps/web's devDependencies") and by reading the current file's own inline comments describing this exact rationale. |

**Score:** 5/5 truths verified (4 independently re-verified live — 3 of them with redundant cached + from-scratch evidence — 1 carried forward as an accepted, human-signed override).

### Deferred Items

None.

### Advisory (New Scope, Unevidenced)

None. `git log --since=2026-09-16T22:45:00Z` on all `covered_files` shows only two files changed since the prior pass: `Dockerfile` (the image-size fix, in-contract — matches the prior file's recorded gap) and `apps/web/src/App.tsx` (3 commits: player-customizable colors/font size, WPM×accuracy scoring change, dead-room URL cleanup — all later-phase feature work, unrelated to Phase 1's foundation truths, no debt markers found, no new Step 7 blockers raised).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` (root) | Workspace manifest, `apps/*` + `packages/*` | ✓ VERIFIED | `workspaces: ["apps/*","packages/*"]` unchanged; `bun install` clean |
| `tsconfig.base.json` | Shared compilerOptions | ✓ VERIFIED | Present, extended by all packages; `bun run typecheck` (4 workspaces) exits 0 |
| `packages/shared/src/messages.ts` | Zod discriminated unions, REQ-13 SoT | ✓ VERIFIED | Present, substantive, real Zod schemas, imported at 37 sites |
| `packages/shared/src/index.ts` | Barrel export | ✓ VERIFIED | Present, unchanged |
| `apps/gateway/src/index.ts` (successor to Phase 1's `apps/server/src/index.ts`) | Bun.serve skeleton, `/health`, `/ws` upgrade | ✓ VERIFIED | Live this session, both containerized and via direct `bun run` boot: `/health` responds with real uptime; `/ws` upgrades and sends `hello` with a real UUID |
| `apps/web/src/App.tsx` | Renders client UI + WS status | ✓ VERIFIED (evolved) | Confirmed current file serves via the built SPA (`index.html` → hashed JS/CSS bundle) in the running container; 3 unrelated feature commits since 2026-09-16, no regressions, no debt markers |
| `apps/web/src/net/ws.ts` | `WsConnection` class, Zod-validated inbound | ✓ VERIFIED | Present, unchanged since prior pass |
| `Dockerfile` | Multi-stage, non-root, WORKDIR fix, prod-deps stage | ✓ VERIFIED | Multi-stage (base→deps→client-build→prod-deps→release); `USER bun` present; live `docker build` (cached AND `--no-cache`)+`docker run` this session confirms non-root `whoami` → `bun` and 19M `/app` both times |
| `fly.toml` | Single-process, WS-tuned config | ✓ VERIFIED | Unchanged; all required keys present |
| `scripts/deploy.sh` | Pre-flight only, never auto-deploys | ✓ VERIFIED | Unchanged since prior pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `apps/gateway`/`apps/engine`/`apps/web` package.json | `packages/shared` | `workspace:*` dependency | ✓ WIRED | `bun install` resolves via symlinks (re-confirmed live: "243 installs, no changes") |
| App source files | `packages/shared` schemas | Real imports | ✓ WIRED | 37 import sites re-counted live; zero duplicate `discriminatedUnion` definitions |
| `Bun.serve` fetch handler | `/ws` upgrade → WS dispatch | Native upgrade | ✓ WIRED | Live WS test this session received real `hello` frame via the built Docker container |
| Vite dev proxy | Bun server | `/api`, `/ws`, `/health` proxy entries | ✓ WIRED (pattern preserved) | Direct non-Docker gateway boot (`bun run --cwd apps/gateway start`) confirmed `/health` live this session, proving the server half of the dev pipeline runs standalone; Vite's proxy config itself unchanged since Phase 1 and not separately re-exercised (client dev-server proxy layer, distinct from the server process just proven) |
| Dockerfile `WORKDIR` / `prod-deps` stage | `apps/gateway` runtime resolution | Multi-stage COPY chain | ✓ WIRED | Live container test (cached + from-scratch): SPA served from `/app/apps/web/dist`, gateway resolves `@typing-race/shared` and `@typing-race/engine` correctly from the `prod-deps`-sourced `node_modules` — proven by the process actually starting and serving, not just file presence |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `/health` response | `uptime`, `timestamp` | `process.uptime()` / server clock inside the running gateway process | Yes — uptime observed at multiple distinct small values across independent fresh process starts (2.0s, 2.8s, 3.5s), never static | ✓ FLOWING |
| `/ws` `hello` frame | `playerId`, `serverTs` | Server-generated UUID + server clock at connection time | Yes — distinct real UUID each connection (`fedb720e-28d8-...`) | ✓ FLOWING |
| `docker exec du -sh /app` | image size | Actual filesystem measurement inside the running container, not a cached/reported number | Yes — independently executed against two separately-built containers (cached + `--no-cache`), both returning 19M | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `bun install` succeeds | `bun install` | "Checked 243 installs across 288 packages (no changes)" | ✓ PASS |
| `bun run typecheck` (4 workspaces) | `bun run typecheck` | Exit 0, no errors | ✓ PASS |
| `docker build` (cached, current Dockerfile) | `docker build -t typing-race:reverify .` | Succeeded, multi-stage including `prod-deps` | ✓ PASS |
| `docker build --no-cache` (from-scratch rebuild) | `docker build --no-cache -t typing-race:reverify-nocache .` | Succeeded fresh: `bun install` re-ran ("472 packages installed"), `vite build` re-ran ("✓ 149 modules transformed... built in 2.23s") | ✓ PASS |
| `docker run` (both builds) — unified mode, health, SPA, WS, non-root | `docker logs`, `curl :18099|18098/health`, `curl :18099/`, Node WS client, `docker exec whoami` | Unified-mode log line present both times; `{"ok":true,...}` both times; valid SPA HTML; real `hello` WS frame; `whoami` → `bun` both times | ✓ PASS |
| Direct (non-Docker) dev-mode boot | `MODE=unified PORT=18097 bun run --cwd apps/gateway start` + `curl :18097/health` | `{"ok":true,"uptime":2.0...}` — fresh process, not the container path | ✓ PASS |
| `docker exec du -sh /app` (both builds) | image size check | **19M** (cached build) and **19M** (from-scratch build) | ✓ PASS — well under the 200MB budget, confirmed twice |
| Duplicate wire-contract definitions | `grep -rl discriminatedUnion apps/*/src` | 0 matches outside `packages/shared` | ✓ PASS |
| No debt markers in deploy/wire-contract files | `grep -E "TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER"` on Dockerfile/fly.toml/deploy.sh/.dockerignore/App.tsx | None (App.tsx's two `placeholder=` hits are legitimate CSS/HTML attributes, not debt markers) | ✓ PASS |

### Probe Execution

`find scripts -path '*/tests/probe-*.sh' -type f` returned no matches; no PLAN/SUMMARY for this phase references a `probe-*.sh` convention. Step 7c: **SKIPPED (no probes declared for this phase)**.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|--------------|--------|----------|
| REQ-13 | 01-01, 01-02 | Shared TS types (single source of truth via Zod) | ✓ SATISFIED | `packages/shared` sole definer of wire-contract unions; 37 real import sites; typecheck clean; zero duplicate schema definitions |
| REQ-12 | 01-02, 01-03 | Fly.io single-process deploy (descoped 2026-09-16 to build + smoke-test) | ✓ SATISFIED (as descoped, and now fully within budget) | Dockerfile/fly.toml/.dockerignore/scripts/deploy.sh all exist and are live-smoke-tested this session (cached + from-scratch): build succeeds, container serves SPA+WS+/health, runs non-root, and now measures 19M `/app` both times — the one previously-open sub-clause (image size) is closed and confirmed reproducible. `fly deploy` itself correctly never executed, per the 2026-09-16 descope decision |

No orphaned requirements found for Phase 1.

### Decision Coverage

No `01-CONTEXT.md` exists for this phase — clean skip, nothing to report.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/gateway/package.json`, `apps/engine/package.json` | n/a | No `build` script; server always runs from TS source, never bundled | ℹ️ Info | Root cause of the SC1 deviation — now formally covered by an accepted, human-signed override (not an open gap) |

No 🛑 Blocker-level anti-patterns found in any covered file. No new-scope findings (Convergence Evidence Gate, `is_re_verification=true`): the only files that changed since the prior pass are `Dockerfile` (in-contract — matches the prior file's recorded gap) and `apps/web/src/App.tsx` (unrelated later-phase feature commits, clean of debt markers).

### Human Verification Required

N/A — Infrastructure/foundation phase with no user-facing elements requiring manual judgment. All truths in this pass were verified programmatically, including live container build/run/measure (cached and from-scratch) and a direct non-Docker dev-mode boot, all executed independently in this session (not inferred from SUMMARY.md or the prior VERIFICATION.md's claims).

### Gaps Summary

No open gaps remain. Both items from the 2026-09-16 initial verification are closed:

1. **Server-dist deviation** — closed via a formally accepted, human-signed override (`atithep_thepkit@cmu.ac.th`, 2026-09-23). Not re-litigated; carried forward verbatim.
2. **Image-size budget miss (221M vs 200MB)** — closed by an actual code fix (`Dockerfile` `prod-deps` stage, commit `d6042c4`), and this fix is now **independently confirmed twice** in this session — once from a BuildKit-cached rebuild and once from a genuine `--no-cache` from-scratch rebuild (fresh `bun install`, fresh `vite build`) — both measuring `/app` at 19M via `docker exec du -sh /app`. Also confirmed: live health check (`{"ok":true,...}`) on both containers plus a direct non-Docker dev-mode boot, live WS handshake (real `hello` frame), and non-root user confirmation (`whoami` → `bun`). None of this was read off the prior file's claim — every number here was re-executed and re-measured first-hand in this session.

Phase 1's goal — a bun-workspace monorepo with shared Zod schemas, a working single-process Bun static+WS pipeline, and a deployable (build+run) container — is achieved. Status is `closed_via_override` (not a clean `passed`) only because one accepted deviation (server-dist) remains on record, per this project's established convention.

---

_Verified: 2026-09-23T00:35:00Z_
_Verifier: Claude (gsd-verifier)_
