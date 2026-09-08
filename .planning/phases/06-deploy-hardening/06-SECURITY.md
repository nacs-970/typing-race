---
phase: "06"
slug: "deploy-hardening"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-09-09"
---

# Phase 06 — Security

> Per-phase security contract, reconstructed retroactively (State B — threat models were authored in each PLAN.md, but no SECURITY.md existed yet). Register built from the `<threat_model>` blocks in 06-01/02/03/04-PLAN.md; each mitigation verified against actual code, not just the plan's claim.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Gateway WS client → Gateway dispatch | Untrusted browser input; a client could keep sending game messages during the drain window | Game/lobby messages |
| Engine ↔ Gateway EventBridge (loopback IPC or in-memory) | Private, single-VM-per-tier internal link, not exposed to end clients | Internal drain/broadcast events |
| Dockerfile `ARG BUN_VERSION` → `oven/bun:${BUN_VERSION}-slim` base image tag | Docker Hub tag mutability boundary — tags are not immutable references | Base image content |
| Regression test suite → production `validateKeystroke` | Tests must exercise real attack shapes, not implementation details | Anti-cheat behavior assertions |
| README → operator running the eventual real deploy | Documentation is the only safeguard once the CI gate is deferred out of scope | Deploy/ops instructions |
| Gateway WS server → browser client | Server-supplied error code rendered as UI copy; code is a fixed enum member, not free text — no injection surface | Error/toast display text |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-06-01 | Denial of Service | `apps/gateway/src/ws/dispatch.ts`, `apps/engine/src/engine.ts` | medium | mitigate | Gateway rejects `create_room`/`join_room`/`start_race` the instant `manager.isDraining()` flips; Engine independently re-checks its own `draining` flag before creating/joining/starting a race, closing the async forwarding window. Verified: `apps/engine/src/engine.ts` lines 133, 164, 283 each check `this.draining` and return `SERVER_SHUTTING_DOWN`. | closed |
| T-06-02 | Tampering | `apps/engine/src/engine.ts` (`EngineWorker.drain`) | high | mitigate | `drain()` races the room-state poll loop against an independent `setTimeout(timeoutMs)` hard-exit promise, so a throwing/hanging `store.list()` cannot delay shutdown past the 90s deadline. Verified present; timer-leak follow-up (WR-02, unrelated to this threat) fixed in the Phase 6 code-review pass. | closed |
| T-06-03 | Denial of Service | `apps/engine/src/index.ts`, `apps/gateway/src/index.ts` (SIGTERM/SIGINT handlers) | medium | mitigate | `drain()` memoizes and returns the same in-flight promise on repeat calls — double-signal delivery cannot start a second concurrent drain timer. Verified via `drain.test.ts` idempotency test (both engine and gateway) and re-confirmed live during `/gsd-verify-work` UAT probes. | closed |
| T-06-04 | Information Disclosure | `apps/web/src/App.tsx` (SERVER_SHUTTING_DOWN toast) | low | accept | Toast message is a static string keyed off a fixed server error-code enum; no server internals are leaked, no free-text is rendered. | closed |
| T-06-05 | Repudiation | `packages/shared/src/bridge.ts` (`draining`/`drained` events) | low | accept | Events aren't authenticated across the loopback IPC boundary — same trust level as all existing EventBridge traffic; Engine↔Gateway is a private internal link, not exposed to end clients. | closed |
| T-06-06 | Tampering | Dockerfile x4 (`FROM oven/bun:${BUN_VERSION}-slim`) | medium | accept | Tag-based (not digest-based) pinning is a theoretical upstream-repoint risk. D-05 explicitly chose exact-version-tag pinning as sufficient for this phase; digest-pinning is unrequested future hardening. | closed |
| T-06-07 | Tampering | `.bun-version` / Dockerfile / `package.json` drift | low | mitigate | Regression test fails the moment `.bun-version`, any Dockerfile's `ARG BUN_VERSION`, or `package.json`'s `engines.bun`/`packageManager` diverge. Verified: `packages/shared/src/__tests__/bun-version-pin.test.ts`, 6/6 passing. | closed |
| T-06-08 | Tampering | `apps/engine/src/__tests__/validate-keystroke.test.ts` | medium | mitigate | New tests exercise `validateKeystroke` through its real exported signature with independently-computed expected WPM, so they fail on a real reopened bypass. Verified: 26/26 passing including the new `D-07 bypass scenarios` describe block. | closed |
| T-06-09 | Repudiation | `scripts/smoke-test.sh` / absence of CI | medium | accept | No CI gate exists this phase (explicitly deferred). Accepted because the CI-gate work is out of scope for this pass; README documents it as pending follow-up so it isn't forgotten. Verified: README's Local Smoke Test section states this explicitly. | closed |
| T-06-10 | Information Disclosure | `README.md` | low | mitigate | README documents env var *names* only, never an inline real secret value. **Initially found OPEN** during this security review — README had zero environment-variable documentation at all (the plan's claimed mitigation was unfulfilled, though no actual value was ever exposed since nothing was documented). Fixed same-session: added a names-only Environment Variables table (commit `62e3e76`). | closed |

*Status: open · closed · open — below `high` threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `workflow.security_block_on` (`high`) count toward `threats_open`*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-06-01 | T-06-04 | Static toast string, no server internals leaked, no injection surface (fixed enum, not free text) | 06-04-PLAN.md (plan-time) | 2026-09-08 |
| R-06-02 | T-06-05 | EventBridge internal link not exposed to end clients; same trust level as all existing bridge traffic | 06-01-PLAN.md (plan-time) | 2026-09-08 |
| R-06-03 | T-06-06 | Tag-based Docker pinning explicitly chosen (D-05) as sufficient for this phase; digest-pinning is unrequested future hardening | 06-02-PLAN.md (plan-time) | 2026-09-08 |
| R-06-04 | T-06-09 | CI gate explicitly out of scope for Phase 6 (06-CONTEXT.md domain boundary); documented as pending follow-up in README | 06-03-PLAN.md (plan-time) | 2026-09-08 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-09 | 10 | 10 | 0 | Claude (retroactive register build + code-level verification, per `/gsd-secure-phase 6`) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-09
