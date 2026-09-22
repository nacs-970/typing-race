---
phase: "06"
slug: "deploy-hardening"
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-09"
---

# Phase 06 — Validation Strategy

> Per-phase validation contract, reconstructed retroactively (State B — no VALIDATION.md existed at plan time).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `bun test` (bun:test), all 4 workspaces (engine, gateway, web, shared) |
| **Config file** | none — Bun's built-in test runner |
| **Quick run command** | `bun test <file>` |
| **Full suite command** | `bun run --filter '*' test` |
| **Estimated runtime** | ~10-15 seconds |

---

## Sampling Rate

- **After every task commit:** Run the affected package's `bun test <file>`
- **After every plan wave:** Run `bun run --filter '*' test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Requirement | Automated Command | File Exists | Status |
|---------|------|-------------|-------------------|-------------|--------|
| 06-01 | 01 | REQ-12: graceful SIGTERM drain, idempotent, 90s hard cap, reject create/join/start during drain, in-flight rooms unaffected | `bun test apps/engine/src/__tests__/drain.test.ts apps/gateway/src/__tests__/drain.test.ts` | ✅ | ✅ green |
| 06-01 (post-review fix) | 01 | CR-01: gateway latches early "drained" event; WR-01 no duplicate SERVER_SHUTTING_DOWN broadcast | `bun test apps/gateway/src/__tests__/drain.test.ts` | ✅ | ✅ green |
| 06-02 | 02 | REQ-12: `.bun-version` pin + Dockerfile/package.json drift guard | `bun test packages/shared/src/__tests__/bun-version-pin.test.ts` | ✅ | ✅ green |
| 06-03 | 03 | D-07 anti-cheat bypass: replay-attack, claimed-impossible-WPM, exact min-interval boundary | `bun test apps/engine/src/__tests__/validate-keystroke.test.ts` | ✅ | ✅ green |
| 06-03 | 03 | README documents deploy strategy, graceful shutdown, kill_timeout caveat, React Compiler skip | manual review (prose, not machine-testable) | ✅ | ✅ manual-verified |
| 06-03 | 03 | Local production smoke test (build → boot → health → WS hello → teardown) | `bash scripts/smoke-test.sh` | ✅ | ✅ manual-verified (re-run live during /gsd-verify-work, exit 0) |
| 06-04 | 04 | D-01: SERVER_SHUTTING_DOWN error frame renders distinct "Server Restarting" toast, not generic fallback | `bun run --filter '@typing-race/web' test -- src/__tests__/App.test.tsx` | ✅ | ✅ green (gap filled — see Validation Audit below) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — no framework install needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| README documentation accuracy (deploy strategy, graceful shutdown, kill_timeout caveat, React Compiler skip note) | 06-03 | Prose content, not behavior — no automated assertion applies | Read `README.md`'s Deploy Strategy / Graceful Shutdown / Local Smoke Test sections; cross-check `kill_timeout` value against `fly.toml` |
| Local production smoke test end-to-end run | 06-03 | Boots a real server process and hits real network sockets — deliberately outside `bun test`'s unit/integration scope | `bash scripts/smoke-test.sh` — expect `SMOKE OK`, exit 0 |

---

## Validation Sign-Off

- [x] All tasks have automated verify or a documented manual-only rationale
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none were missing beyond the one gap below)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-09-09

---

## Validation Audit 2026-09-09

| Metric | Count |
|--------|-------|
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |

**Gap resolved:** 06-04's toast-mapping requirement (SERVER_SHUTTING_DOWN → "Server Restarting", not generic "Error") had zero automated coverage — `ToastQueue.test.tsx` only exercised the generic toast widget with hand-written titles, never `App.tsx`'s actual `msg.code`-keyed branch. Added `apps/web/src/__tests__/App.test.tsx`, which renders the real `<App />` and dispatches a real `SERVER_SHUTTING_DOWN` error frame through the same `RaceClient.dispatch` path the live WebSocket uses. Mutation-tested (temporarily swapped the dispatched code to `SESSION_INVALID`; test correctly failed) before confirming green. `App.tsx` itself was not modified — full web suite now 78/78 passing (77 pre-existing + 1 new).
