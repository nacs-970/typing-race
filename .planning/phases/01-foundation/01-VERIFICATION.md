---
phase: 01-foundation
verified: 2026-09-16T22:45:00Z
resolved: 2026-09-23T00:00:00Z
status: closed_via_override
score: 4/5 must-haves verified, remaining must-have closed via accepted override (server-dist, see below); image-size gap fixed 2026-09-23
covered_files: [".dockerignore", ".planning/PROJECT.md", ".planning/phases/01-foundation/01-01-PLAN.md", ".planning/phases/01-foundation/01-01-SUMMARY.md", ".planning/phases/01-foundation/01-02-PLAN.md", ".planning/phases/01-foundation/01-02-SUMMARY.md", ".planning/phases/01-foundation/01-03-PLAN.md", ".planning/phases/01-foundation/01-03-SUMMARY.md", ".planning/phases/01-foundation/01-UAT.md", ".planning/phases/01-foundation/01-VALIDATION.md", "Dockerfile", "apps/gateway/package.json", "apps/gateway/src/index.ts", "apps/web/src/App.tsx", "apps/web/src/net/ws.ts", "apps/web/vite.config.ts", "bunfig.toml", "fly.toml", "package.json", "packages/shared/src/index.ts", "packages/shared/src/messages.ts", "scripts/deploy.sh", "tsconfig.base.json"]
covered_digest: "v1:sha256:23391379fa89322baf2a66d74d45cca34ccdadabc2805f68ce5582d310d88aa9"
behavior_unverified: 0
overrides_applied: 0
gaps:

  - truth: "`bun run --filter '*' build` produces both a server-side `dist` (originally `apps/server/dist`, now the successor `apps/gateway`) and `apps/client`/`apps/web/dist`"
    status: failed
    reason: "The web half is real and verified (`apps/web/dist/index.html` + hashed, precompressed assets). The server half was never produced at any point in the project's life. apps/server/package.json (Phase 1) declared a `build` script (`bun build src/index.ts --target=bun --outdir=dist`) but the root `package.json` build script never called it (`\"build\": \"bun run --cwd apps/web build\"` at Phase 1 completion, unchanged in spirit today). 01-03-SUMMARY.md self-admits this under 'Symbols referenced but NOT created (owned by later phases): apps/server/dist/'. No later phase (through Phase 7's gateway/engine split) ever added a server build step or produced apps/gateway/dist or apps/engine/dist — grep for a \"build\" script in apps/gateway/package.json and apps/engine/package.json returns nothing. In production (Dockerfile ENTRYPOINT and local `bun run start`), the server always runs directly from TypeScript source via Bun's native TS execution — never from a bundled dist. This is architecturally consistent and functionally proven (typecheck clean, health/WS/Docker all pass — see truths 2-4), but it is a literal, never-closed deviation from ROADMAP SC1's wording, and no override was ever recorded for it."
    artifacts:
      - path: "apps/gateway/package.json"
        issue: "No `build` script; server runs from source (`bun run apps/gateway/src/index.ts`), never bundled to dist"
      - path: "package.json"
        issue: "Root `build` script only builds `apps/web` (`bun run --cwd apps/web build`); never builds a server/gateway artifact"
    missing: []
    overrides:
      - must_have: "`bun run --filter '*' build` produces both a server-side dist and a client dist"
        reason: >
          Bun executes .ts files natively — no transpile/bundle step needed, unlike a Node.js
          deployment target. The Dockerfile ENTRYPOINT and `bun run start` both run
          apps/gateway/src/index.ts directly from source; this has been true and functionally
          proven (typecheck clean, health/WS/Docker all pass) since Phase 1. Only apps/web needs
          a build step (browsers can't execute TS/JSX). ROADMAP SC1's wording predates this and
          was never updated once the Bun-native approach settled.
        accepted_by: "atithep_thepkit@cmu.ac.th"
        accepted_at: "2026-09-23"
  - truth: "`docker run --rm typing-race:test du -sh /app` reports under 200MB (Plan 03 must-have, verbatim)"
    status: fixed
    reason: "FIXED 2026-09-23: root cause was the release stage copying node_modules wholesale from a build stage that also installs apps/web's entire devDependency tree (vite, tailwind, vitest, typescript, react-dom, plus native binaries for every target — rolldown, lightningcss, tailwindcss/oxide — ~110MB alone). Added a separate `prod-deps` build stage that installs only gateway+engine (+ shared workspace dep) via `bun install --production --frozen-lockfile --filter='@typing-race/gateway' --filter='@typing-race/engine'`, and the release stage now copies node_modules from that stage instead. Verified live: `docker exec ... du -sh /app` now reports 19M, well under the 200MB budget. Full container smoke test (build, run, /health, unified-mode log line) re-confirmed green after the change."
    artifacts:
      - path: "Dockerfile"
        issue: "RESOLVED — added `prod-deps` stage; release now copies node_modules from it instead of the client-build-inclusive `deps` stage"
    missing: []
audit_acknowledged:
  milestone: v1.0
  at: 2026-09-22
  status: closed_via_override
---

# Phase 1: Foundation Verification Report

**Phase Goal:** Establish a bun-workspace monorepo with shared Zod schemas, a Bun+Hono server skeleton with `/health`, a Vite+React client, and a working single-process Bun static + WS pipeline that can be deployed to Fly.io. Validate the full deploy pipeline end-to-end before any game logic.

**Verified:** 2026-09-16T22:45:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification (no prior `01-VERIFICATION.md` existed)

## Important framing: this phase has since been superseded by Phase 7

Phase 1 shipped `apps/server` (a single Bun+Hono process) and `apps/web`. Phase 7
("split-into-n-tier-architecture", per `.planning/v1.0-MILESTONE-AUDIT.md`) later
retired `apps/server` entirely (commit `802ba24`, "monorepo orchestration scripts
and legacy cutover") and replaced it with `apps/gateway` + `apps/engine`, connected
via an EventBridge in `packages/shared/src/bridge.ts`. `apps/web` and
`packages/shared` persist unbroken from Phase 1 through today.

Per the task brief, **this supersession is expected and is not counted as a
failure.** Verification below checks two things: (1) what Phase 1 itself actually
delivered at completion (commit `80fa149`, "Phase 1 complete, Phase 2 plans
ready"), verified against the historical git tree, and (2) whether the
foundational patterns Phase 1 established (shared Zod schemas as single source of
truth, single-process static+WS serving, non-root Docker, fly.toml shape) still
hold in the current, evolved codebase — since that is the actual state a reader
of "is Phase 1 goal achieved" cares about.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `bun install` succeeds; `bun run --filter '*' build` (or its successor) produces both a client dist and a server dist | ✗ FAILED | `bun install` exits 0 today (243 installs, no changes). `bun run --cwd apps/web build` produces `apps/web/dist/index.html` + hashed `.js`/`.css` + `.gz`/`.br` siblings (reproduced live during this verification) — client half verified. **The server half was never produced, at any point in the project's history** — see `gaps` in frontmatter. |
| 2 | `bun run dev` (or per-package dev) serves client + server with `/health` returning success | ✓ VERIFIED | Live smoke test this session: `MODE=unified bun run --cwd apps/gateway start` → `curl http://localhost:8080/health` → `{"ok":true,"timestamp":...,"uptime":...}`. Historically (Phase 1, `apps/server/src/routes.ts`) `/health` returned bare text `ok`, not `{ok:true}` — a minor SC2 wording deviation at the time, since closed by later phases which now literally return `{ok:true}`. Port is `:8080` (both then and now), not ROADMAP's stated `:3000` — a deliberate, consistently-applied deviation baked into `env.ts`/Dockerfile `EXPOSE`/`fly.toml internal_port` triple-match, never `:3000` at any point in the project. |
| 3 | `fly deploy` produces a public URL... (NOTE: descoped 2026-09-16, verify Dockerfile/fly.toml exist + are smoke-tested instead) | ✓ VERIFIED | `Dockerfile`, `fly.toml`, `.dockerignore`, `scripts/deploy.sh` all exist at repo root today. **Live re-verification this session** (against the *current* Dockerfile — COPY `apps/gateway`+`apps/engine`, not the Phase-1-era COPY `apps/server` variant, which no longer exists to rebuild): `docker build -t typing-race:verify .` succeeded end-to-end (multi-stage: base → deps → client-build → release). `docker run` → `curl :8081/health` → `{"ok":true,...}`; `curl :8081/` → contains `id="root"` (SPA served); Node WS client → `ws://localhost:8081/ws` → received `{"type":"hello","playerId":"<uuid>","serverTs":...}`; `docker exec ... whoami` → `bun` (non-root, UID 1000). This proves the deploy pipeline builds and serves correctly **today**; the Phase-1-era Dockerfile's own build was never confirmed on its original host (01-03-SUMMARY.md reported a Docker bridge-networking failure at that time) and cannot be retroactively re-tested since that file no longer exists. `fly deploy` itself intentionally never runs — confirmed descoped 2026-09-16 per `.planning/PROJECT.md` Out of Scope and `.planning/v1.0-MILESTONE-AUDIT.md`. |
| 4 | `packages/shared` exports Zod schemas and both server + client import them — no duplicate type definitions | ✓ VERIFIED | `packages/shared/src/messages.ts` (13.7K today, grown from Phase 1's smaller version) exports `clientToServerSchema` / `serverToClientSchema` Zod discriminated unions; `packages/shared/src/index.ts` barrels `messages`, `race`, `codes`, `passages`. All three current apps (`apps/gateway`, `apps/engine`, `apps/web`) declare `"@typing-race/shared": "workspace:*"` and — critically — actually **import** it: `grep -rn "@typing-race/shared" apps/gateway/src apps/engine/src apps/web/src` returns 37 real import sites. `grep -rl "discriminatedUnion" apps/gateway/src apps/engine/src apps/web/src` returns **zero matches** — no app defines its own competing wire-contract union; `packages/shared` is the sole source. `bun run typecheck` (root, all 4 workspaces) exits 0 with no output — clean. |
| 5 | (Plan 03 must-have) `docker run --rm typing-race:test du -sh /app` reports under 200MB | ✗ FAILED | Live measurement this session: `docker exec typing-race-verify du -sh /app` → **221M**. Over the declared budget by ~10%. Non-root user, multi-stage build, and functional serving are all otherwise fine — this is purely a size-threshold miss. See `gaps` in frontmatter. |

**Score:** 3/5 truths cleanly verified (2 genuine gaps: server build artifact never produced; container image over the declared 200MB budget).

### Deferred Items

None — neither gap was ever scheduled for a later phase; both are either an
architectural non-requirement (server dist, under Bun's native-TS execution
model) or an unaddressed numeric threshold (image size) that no phase revisited.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` (root) | Workspace manifest, `apps/*` + `packages/*` | ✓ VERIFIED | `workspaces: ["apps/*","packages/*"]`; scripts evolved (now orchestrates web/gateway/engine) but pattern intact |
| `tsconfig.base.json` | Shared compilerOptions | ✓ VERIFIED | Present, extended by all packages; `bun run typecheck` (4 workspaces) exits 0 |
| `packages/shared/src/messages.ts` | Zod discriminated unions, REQ-13 SoT | ✓ VERIFIED | Present, substantive (13.7K), real Zod schemas, imported everywhere |
| `packages/shared/src/index.ts` | Barrel export | ✓ VERIFIED | `export * from "./messages/race/codes/passages.ts"` |
| `apps/server/src/index.ts` (Phase 1) → superseded by `apps/gateway/src/index.ts` | Bun.serve skeleton, `/health`, `/ws` upgrade | ✓ VERIFIED (via supersession) | Historical `apps/server/src/index.ts` at commit `80fa149` was substantive (native `Bun.serve<WsData>`, WS knobs, SIGTERM handler) — not a stub. Current `apps/gateway/src/index.ts` continues the exact same pattern (verified live: `/health` responds, `/ws` upgrades and sends `hello`) |
| `apps/web/src/App.tsx` | Renders "Hello Typing Race" + WS status | ✓ VERIFIED (evolved) | Historical version had the literal string + status pill (confirmed via `01-01-SUMMARY.md` D4/D7 coverage + UAT test 2 "pass"). Current `App.tsx` has evolved far beyond hello-world (full lobby/race UI) — expected evolution, not a stub regression |
| `apps/web/src/net/ws.ts` | `WsConnection` class, Zod-validated inbound | ✓ VERIFIED | Present at Phase 1 and today; dev/prod URL branch (`import.meta.env.DEV`) confirmed in source |
| `Dockerfile` | Multi-stage, non-root, WORKDIR fix | ✓ VERIFIED | Multi-stage (base→deps→client-build→release) at Phase 1 and today (updated to COPY `apps/gateway`+`apps/engine` instead of `apps/server`); `USER bun` present; live `docker build` + `docker run` this session confirms non-root `whoami` → `bun` |
| `fly.toml` | Single-process, WS-tuned config | ✓ VERIFIED | All required keys present: `internal_port = 8080`, `auto_stop_machines = "stop"`, `concurrency.type = "connections"`, `path = "/health"`, `kill_signal = "SIGTERM"`, `memory = "256mb"` |
| `scripts/deploy.sh` | Pre-flight only, never auto-deploys | ✓ VERIFIED | Executable, 5-step pre-flight, prints would-be `fly deploy --strategy immediate --remote-only` but never executes it (`! grep -q "^fly deploy"` holds). **Process note:** this file existed on disk since Phase 1 execution but was not `git add`ed until a much later backfill commit (`8fe46d7`, 2026-09-16) — a repo-hygiene gap, not a functional one; content matches the Plan 03 must-have verbatim. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `apps/gateway`/`apps/engine`/`apps/web` package.json | `packages/shared` | `workspace:*` dependency | ✓ WIRED | All 3 declared; `bun install` resolves via symlinks (verified: `bun install` completed with 243 installs, no unresolved workspace errors) |
| App source files | `packages/shared` schemas | Real imports | ✓ WIRED | 37 import sites across `apps/gateway/src`, `apps/engine/src`, `apps/web/src`; zero duplicate `discriminatedUnion` definitions found outside `packages/shared` |
| `Bun.serve` fetch handler | `/ws` upgrade → WS dispatch | Native upgrade, not Hono's `upgradeWebSocket` | ✓ WIRED | Live test: WS client received `hello` frame with real UUID `playerId` + `serverTs` both via direct dev server and via the built Docker container |
| Vite dev proxy | Bun server | `/api`, `/ws`, `/health` proxy entries | ✓ WIRED (historical + pattern preserved) | Phase 1 `vite.config.ts` proxy config confirmed present in PLAN/SUMMARY diffs; UAT test 2 (dev proxy + WS handshake) recorded `pass` |
| Dockerfile `WORKDIR` | `static.ts`'s `import.meta.dir` math | Path resolution (Pitfall 4 fix) | ✓ WIRED | Live container test: SPA served correctly from `/app/apps/web/dist` via the WORKDIR-relative path, both then (`apps/server`) and now (`apps/gateway`) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `bun install` succeeds | `bun install` | "Checked 243 installs across 288 packages (no changes)" | ✓ PASS |
| `bun run typecheck` (4 workspaces) | `bun run typecheck` | Exit 0, no errors, all 4 `tsc --noEmit` runs clean | ✓ PASS |
| Unified server `/health` | `curl http://localhost:8080/health` (live `bun run --cwd apps/gateway start`, MODE=unified) | `{"ok":true,"timestamp":...,"uptime":...}` | ✓ PASS |
| `docker build` (full pipeline, current Dockerfile) | `docker build -t typing-race:verify .` | Succeeded, multi-stage, Vite build embedded, precompressed `.gz` assets emitted | ✓ PASS |
| `docker run` — health, SPA, WS, non-root | `curl :8081/health`, `curl :8081/`, Node WS client, `docker exec whoami` | `{"ok":true,...}`; `id="root"` present; `hello` frame with UUID received; `whoami` → `bun` | ✓ PASS |
| `docker exec du -sh /app` | image size check | `221M` | ✗ FAIL — over Plan 03's "under 200MB" must-have by ~10%; see gaps |
| Duplicate wire-contract definitions | `grep -rl discriminatedUnion apps/*/src` | 0 matches outside `packages/shared` | ✓ PASS |
| No debt markers in deploy/wire-contract files | `grep -E "TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER"` on Dockerfile/fly.toml/deploy.sh/messages.ts/App.tsx | Only legitimate HTML `placeholder=` attributes found | ✓ PASS |

### Probe Execution

`find scripts -path '*/tests/probe-*.sh' -type f` returned no matches, and neither
PLAN nor SUMMARY files for this phase reference a `probe-*.sh` convention.
Step 7c: **SKIPPED (no probes declared for this phase)**.

### Requirements Coverage

Per task instructions, cross-referenced against `.planning/PROJECT.md` (no
`REQUIREMENTS.md` in this project) and the phase's declared `requirements:`
frontmatter.

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|--------------|--------|----------|
| REQ-13 | 01-01, 01-02 | Shared TS types (single source of truth via Zod) | ✓ SATISFIED | `packages/shared` is the sole definer of wire-contract discriminated unions; 37 real import sites across all 3 current apps; typecheck clean; zero duplicate schema definitions found |
| REQ-12 | 01-02, 01-03 | Fly.io single-process deploy (descoped from "deploy" to "build + smoke-test" 2026-09-16) | ⚠️ PARTIALLY SATISFIED (as descoped) | Dockerfile/fly.toml/.dockerignore/scripts/deploy.sh all exist and are now live-smoke-tested (this session): build succeeds, container serves SPA+WS+/health, runs non-root — this fully satisfies the descoped bar. However the underlying Plan 03 must-have on image size (<200MB) fails at 221M; see gaps. `fly deploy` itself correctly never executed, matching the 2026-09-16 descope decision recorded in `.planning/PROJECT.md` Out of Scope |

No orphaned requirements found for Phase 1 in `.planning/PROJECT.md`.

### Decision Coverage

No `01-CONTEXT.md` exists for this phase (checked `.planning/phases/01-foundation/*-CONTEXT.md` — none found), so the decision-coverage gate is a clean skip; nothing to report.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/gateway/package.json`, `apps/engine/package.json` | n/a | No `build` script exists for either; server always runs from TS source, never bundled | ⚠️ Warning | Root cause of gap 1 (server dist never produced). Architecturally sound (Bun native TS execution) but never reconciled against the roadmap's literal wording via an accepted override |
| Docker image (current build) | n/a | `/app` measures 221M inside the running container | ⚠️ Warning | Exceeds Plan 03's "under 200MB" must-have (~10% over) — tracked as gap 2 |
| `scripts/deploy.sh` | n/a | File existed on disk since Phase 1 execution but was not committed to git until backfill commit `8fe46d7` (2026-09-16, same day as this verification) | ℹ️ Info | Process/hygiene gap only — content is correct and matches the plan's must-have verbatim; no functional impact |

No 🛑 Blocker-level anti-patterns (debt markers, stubs, hollow props) found in any file covered by this phase.

### Human Verification Required

N/A — Infrastructure/foundation phase with no user-facing elements requiring
manual judgment beyond what `01-UAT.md` already discharged (5/5 tests passed:
cold-start smoke, dev proxy + WS handshake with visible "Hello Typing Race" +
playerId in DOM, prod single-process SPA serving with compression headers,
deploy-infra files present + `deploy.sh` dry-run, and the wire-tracer's
Zod-validated `hello` frame). All items in `01-UAT.md` remain valid evidence and
are not re-litigated here per the infra-phase human-verification scoping rule.

### Gaps Summary

Two genuine, never-closed gaps, both non-blocking to the phase's actual demoed
functionality but real deviations from declared must-haves:

**Gap 1 — server build artifact never produced.** The ROADMAP's literal SC1
wording ("`bun run --filter '*' build` produces both `apps/server/dist` and
`apps/client/dist`") was never fully satisfied. The client half (`apps/web/dist`)
is real, substantive, and verified with precompressed asset siblings. The server
half was never produced — not at Phase 1 completion, not in any of the 7
subsequent phases, including the Phase 7 gateway/engine split. The server has
always run directly from TypeScript source via Bun's native execution model
(confirmed live: `bun run apps/gateway/src/index.ts` and the Dockerfile
`ENTRYPOINT` both run source, not a bundled artifact). This is very likely the
*correct* engineering call — Bun doesn't require transpilation to run TS, unlike
a Node.js deployment target — but it was never formally reconciled against the
roadmap text via an accepted override. Neither `.planning/v1.0-MILESTONE-AUDIT.md`
(which declares "10 of 10 in-scope requirements fully satisfied" at the REQ
level) nor any prior phase verification addresses this specific sub-clause by
name.

**Gap 2 — container image over the declared 200MB budget.** Live measurement
this session: `du -sh /app` inside the running container reports 221M, against
Plan 03's explicit must-have of "under 200MB." Everything else about the
container (non-root user, multi-stage build, correct serving of SPA+WS+/health)
checks out; this is purely a size-threshold miss, newly discovered by this
verification (the original Phase 1 execution never got a live measurement due to
a host Docker networking failure).

**This looks intentional (gap 1) / minor and likely fixable (gap 2).** To accept
these deviations, add to this file's frontmatter:

```yaml
overrides:

  - must_have: "bun run --filter '*' build produces apps/server/dist"
    reason: "Bun executes TypeScript source natively; the server (originally apps/server, now apps/gateway+apps/engine) has never needed a bundled dist artifact in any of the 8 shipped phases — Dockerfile ENTRYPOINT and `bun run start` both run source directly. Only the browser-delivered client requires a Vite build."
    accepted_by: "{your name}"
    accepted_at: "{current ISO timestamp}"
  - must_have: "docker run --rm typing-race:test du -sh /app reports under 200MB"
    reason: "Accept current 221M size, OR prune image before accepting — developer's call."
    accepted_by: "{your name}"
    accepted_at: "{current ISO timestamp}"
```

Then re-run verification to apply. Everything else — the shared Zod
single-source-of-truth (REQ-13), the single-process static+WS pipeline, and the
deploy infrastructure build/run/WS/non-root path (freshly re-verified live this
session, resolving the "environment limitation" the original Phase 1 execution
hit) — is genuinely proven.

---

_Verified: 2026-09-16T22:45:00Z_
_Verifier: Claude (gsd-verifier)_
