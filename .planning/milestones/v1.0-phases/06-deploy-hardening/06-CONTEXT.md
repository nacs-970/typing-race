# Phase 6: Deploy + Hardening - Context

**Gathered:** 2026-09-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Hardening only — the CI/deploy-gate item from the original phase goal ("CI runs `bun run start` against pinned Bun before every deploy") is explicitly OUT of scope for this pass, per user direction. In scope:

- Graceful shutdown: drains in-flight rooms on SIGTERM instead of the current ad-hoc immediate-stop behavior in `apps/gateway/src/index.ts` and `apps/engine/src/index.ts`.
- Bun version reproducibility: `.bun-version` dev default + exact-pinned Dockerfiles (engines.bun range in package.json stays as-is).
- Anti-cheat regression test suite for the 4 checks built in Phase 2.
- React Compiler opt-in — resolved as skip (see Decisions).

`fly.toml` / actual `fly deploy` execution / `.github/workflows` CI gate remain untouched — deferred, not part of this phase's scope.

</domain>

<decisions>
## Implementation Decisions

### Graceful Shutdown
- **D-01:** On SIGTERM, broadcast a shutdown notice to all connected clients immediately, then drain: reject new room joins/race starts, let active races run to completion, exit once empty or at the timeout. — **Reversibility:** reversible.
- **D-02:** Drain timeout is 90s — if rooms are still active after 90s from SIGTERM, force-exit anyway. — **Reversibility:** reversible. Note: exceeds Fly.io's default 30s SIGTERM→SIGKILL grace window; whoever picks up the deferred deploy/CI work must bump `kill_timeout` in `fly.toml` to ≥90s or the platform will SIGKILL mid-drain.
- **D-03:** Engine is the source of truth for drain state. On SIGTERM, Engine publishes a `draining` event over the existing EventBridge (`packages/shared/bridge`, already used for gateway↔engine pub/sub). Gateway subscribes and flips to reject-new-rooms mode while keeping existing connections alive. — **Reversibility:** costly — changes the event-bridge contract between tiers; both `apps/gateway/src/index.ts` and `apps/engine/src/index.ts` need coordinated changes.

### Bun Version Pinning
- **D-04:** Add `.bun-version` = `1.3.2` at repo root as the local-dev default (matches the version already pinned in Phase 1 Plan 01). `engines.bun` in `package.json` stays as the existing range (`>=1.3.2 <1.5.0`) — not tightened. — **Reversibility:** reversible.
- **D-05:** All 4 Dockerfiles (root, `apps/web`, `apps/gateway`, `apps/engine`) pin `FROM oven/bun:1.3.2` (or the matching alpine/slim tag) exactly — including `apps/web`'s build stage, for consistency even though it's build-time only. — **Reversibility:** reversible.

### Anti-Cheat Regression Tests
- **D-06:** Unit-test `apps/engine/src/race/validator.ts` directly (not integration-through-engine) — fast, precise failure localization per check.
- **D-07:** Cover all 4 checks from Phase 2 (server-timestamp, pre-start reject, min-interval ≥20ms, char-match) with a valid-case + violation-case pair each (8 baseline tests), PLUS named test cases for documented bypass scenarios: replay attack (resending a valid keystroke burst), timestamp spoofing, and claimed-impossible-WPM. — **Reversibility:** reversible.

### React Compiler
- **D-08:** Skip entirely. Phase 5 already isolated cursor rendering via CSS `transform3d` outside the React render tree specifically to avoid render cost — no measured bottleneck exists to justify adding React Compiler now. — **Reversibility:** reversible (can revisit if profiling ever shows a real problem).

### Claude's Discretion
- Exact Dockerfile syntax/tag naming (e.g. `oven/bun:1.3.2-alpine` vs `oven/bun:1.3.2-slim`) — pick whatever the existing Dockerfiles' base currently use, just pin the version.
- Where exactly to house the new anti-cheat test file (co-located `validator.test.ts` next to `validator.ts`, matching existing test conventions in the repo).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & State
- `.planning/PROJECT.md` — race-length target (30-60s), Fly.io single-VM-per-tier deploy constraint, out-of-scope list.
- `.planning/STATE.md` — flags that SIGTERM handling already exists ad-hoc (done alongside Phase 7's N-tier split) and is insufficient; flags Phase 6 as the only genuinely unstarted phase.

### Architecture (from Phase 7)
- `.planning/phases/07-split-into-n-tier-architecture/07-CONTEXT.md` — tier boundaries (D-01), EventBridge publish/subscribe contract (D-06), lifecycle split between Gateway (connections) and Engine (game state) (D-08). The shutdown drain-signal decision (D-03 above) builds directly on this EventBridge.

### Existing Shutdown Code (to be replaced/extended)
- `apps/gateway/src/index.ts` (SIGTERM handler at line 153, `onShutdown` at line 146) — currently calls `instance.stop()` then exits immediately, no drain.
- `apps/engine/src/index.ts` (SIGTERM handler at line 42) — currently calls `worker.stop()` then exits immediately, no drain.
- `apps/engine/src/engine.ts` (`EngineWorker.stop()` at line 47) — just clears the tick timer and unsubscribes; no drain logic exists here today.

### Anti-Cheat Source (Phase 2)
- `apps/engine/src/race/validator.ts` — the 4 anti-cheat checks to be regression-tested.

### Bun Pinning
- `package.json` (line 21-22) — current `engines.bun` range.
- `Dockerfile`, `apps/web/Dockerfile`, `apps/gateway/Dockerfile`, `apps/engine/Dockerfile` — all 4 need the exact-version pin.
- `fly.toml` — exists as scaffolding; NOT touched by this phase, but flagged (D-02) for whoever does the deploy work later.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/shared/bridge` — `EventBridge` interface (in-memory / Redis / loopback-IPC implementations) already provides the publish/subscribe mechanism the drain signal (D-03) will reuse — no new transport needed.

### Established Patterns
- Gateway owns WebSocket connections/heartbeats; Engine owns room game state and lifecycle (Phase 7 D-08 split). The shutdown drain design respects this: Engine decides when to drain (game-state concern), Gateway just reacts (connection concern).
- Server-authoritative anti-cheat: validation relies on server-received timestamps, never client-reported ones — the tests must exercise this by feeding crafted server-side timestamps, not trusting any client-supplied time field.

### Integration Points
- SIGTERM handlers in both `apps/gateway/src/index.ts` and `apps/engine/src/index.ts` are the two places code changes for D-01/D-02/D-03.
- No existing test file references anti-cheat — this is a net-new test file, not an extension of one.

</code_context>

<specifics>
## Specific Ideas

- 90s drain timeout was a deliberate explicit choice (not "Recommended" 30s) — the user typed this directly as free text, weighing "cover a full race" over "match Fly.io's default grace window." Downstream agents should not silently shorten it.
- No specific request on Dockerfile base-image tag styling — open to standard approach (see Claude's Discretion above).

</specifics>

<deferred>
## Deferred Ideas

- CI gate (`.github/workflows` running `bun run start` against pinned Bun before every deploy) — explicitly deferred out of this phase per user direction ("everything except CI gate"). Belongs to a future deploy-focused pass.
- Bumping `fly.toml`'s `kill_timeout` to match the 90s drain window — deferred alongside the CI gate since it's deploy config, but flagged in D-02 so it isn't forgotten.
- React Compiler — not deferred to "later" as a todo, but explicitly decided against (D-08) unless future profiling shows an actual bottleneck.

### Reviewed Todos (not folded)
None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-deploy-hardening*
*Context gathered: 2026-09-08*
