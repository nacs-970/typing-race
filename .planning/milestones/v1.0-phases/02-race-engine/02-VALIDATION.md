---
phase: 2
slug: race-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-30
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bun:test (built-in) |
| **Config file** | per-package `bunfig.toml` (or `bun test` invoked per workspace) |
| **Quick run command** | `bun test` (from repo root) |
| **Full suite command** | `bun --workspaces test` |
| **Estimated runtime** | ~5s |

## Sampling Rate

- After every task commit: `bun test`
- After every plan wave: `bun --workspaces test`
- Before `/gsd-verify-work`: full suite green
- Max feedback latency: 10s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | REQ-01 | — | N/A | unit | `bun test packages/shared` | ⬜ pending |
| 2-02-01 | 02 | 1 | REQ-01, REQ-02 | — | N/A | unit | `bun test apps/server` | ⬜ pending |
| 2-03-01 | 03 | 2 | REQ-03 | — | N/A | integration | `bun --workspaces test` | ⬜ pending |
| 2-04-01 | 04 | 2 | REQ-04, REQ-06 | T-2-01 anti-cheat | server-only timestamps | unit | `bun test apps/server` | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `bunfig.toml` test config per workspace
- [ ] `bun:test` available (built-in to Bun runtime)
- [ ] No external test runner needed (skip vitest for server-side unit tests)

*If none: "Bun built-in test runner covers all phase requirements."*

---

## Nyquist Experiments

| ID | What It Proves | Command | Pass Criteria |
|----|----------------|---------|---------------|
| E1 | Clock sync round trip | `curl -sS http://localhost:8080/api/clock-sync` | Returns `{t1, t2}`; client computes offset < 100ms |
| E2 | Two-client synced race start | 2x browser windows on same room code, host triggers start | Both see `race_start.startsAtServerMs` same; client-local start < 50ms apart |
| E3 | Anti-cheat pre-start reject | WS send `keystroke` before `race_start` | Server responds with `error{code: NOT_IN_ROOM}` |
| E4 | Anti-cheat spoofed clientTs | WS send `keystroke{clientTs: now+60000}` mid-race | Server uses server-time, not clientTs; finish time unaffected |
| E5 | Opponent cursor updates within 1s | 2 clients racing; one pauses | Other sees `cursor_update` within 1s |
| E6 | Room code excludes I/O/0/1 | `bun -e 'import('./packages/shared/src/codes.ts').then(m => { const set = new Set(); for(let i=0;i<10000;i++) set.add(m.genCode()); console.log(set.has("I"), set.has("O"), set.has("0"), set.has("1")) })'` | All 4 false |
| E7 | 8-player cap | 9 clients try `join_room` same code | 9th gets `error{code: ROOM_FULL}` |
| E8 | End-to-end cold start | 2 browsers: create → join → start → finish | <30s total |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Two-browser synced start feels simultaneous | REQ-03 | Requires 2 human eyeballs | Open 2 windows, click start simultaneously, observe both passages begin at visually same moment |
| Cursor feels smooth in opponent view | REQ-06 | Subjective UX test | Race vs yourself in 2 windows; verify opponent cursor moves without visible jumps |

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