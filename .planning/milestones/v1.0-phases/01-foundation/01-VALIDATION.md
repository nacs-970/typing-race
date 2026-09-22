---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-30
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.11 (Node test runner via bun) |
| **Config file** | `vitest.workspace.ts` at repo root (one config per workspace package) |
| **Quick run command** | `bun test` (uses vitest's `bun` adapter; ~3s) |
| **Full suite command** | `bun run --filter '*' test` (runs tests across all workspaces; ~8s) |
| **Estimated runtime** | ~8 seconds |

## Sampling Rate

- **After every task commit:** Run `bun test`
- **After every plan wave:** Run `bun run --filter '*' test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | REQ-13 (shared TS types) | — | N/A | unit | `bun test packages/shared` | ⬜ pending |
| 1-02-01 | 02 | 1 | REQ-12 (single-process deploy) | — | N/A | smoke | `curl -fsS http://localhost:3000/health` | ⬜ pending |
| 1-03-01 | 03 | 1 | REQ-13 + REQ-12 | — | N/A | integration | `bun run --filter '*' build && bun run --filter server start` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.workspace.ts` at repo root (or vitest auto-discovery via per-package `vitest.config.ts`)
- [ ] `bun-types` devDep on root so TS understands `bun:test`
- [ ] `happy-dom` env registered for web package (vitest config)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Nyquist Experiments (from RESEARCH.md §Validation Architecture)

| ID | What It Proves | Command | Pass Criteria |
|----|----------------|---------|---------------|
| E1 | Monorepo installs + typechecks cleanly | `bun install && bun run --filter '*' typecheck` | exit 0 |
| E2 | Health endpoint serves | `curl -fsS http://localhost:3000/health` | `{"ok":true}` + exit 0 |
| E3 | Static SPA is served from Bun | `curl -fsS http://localhost:3000/` | response body contains `<div id="root">` |
| E4 | Vite dev proxy routes `/ws` to Bun | Manual: two `wscat` connections to ws://localhost:5173/ws | both echo a ping |
| E5 | Fly.io deploy from clean checkout | `fly deploy --remote-only` (after auth) | public URL returns 200 on `/health` |

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Fly.io deploy | REQ-12 | Requires `fly auth login` + card on file | Run `fly deploy`, open returned URL, check `/health` returns 200 in browser |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending