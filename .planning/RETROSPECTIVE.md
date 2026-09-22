# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-09-23
**Phases:** 12 (7 primary + 5 gap-closure) | **Plans:** 28 | **Sessions:** several (build: 2026-08-30 → 2026-09-16; verification + milestone close: 2026-09-22 → 2026-09-23)

### What Was Built
- Real-time multiplayer typing race: WS rooms, server-authoritative anti-cheat, live opponent cursors
- N-tier split (gateway/engine/web) with a pluggable EventBridge — in-memory, loopback IPC, and Redis pub/sub, all three genuinely proven working
- Reconnect + session resilience: mid-race reconnect, multi-tab session takeover, graceful 90s SIGTERM drain
- Deployed live to Render.com, verified end-to-end against the production URL

### What Worked
- Goal-backward re-verification (gsd-verifier) before milestone close caught real, previously-undetected issues: a production-breaking drain-latch bug (06.1), a display bug from a later feature change (ResultsBoard delta going negative), and a split-mode Docker build that had never actually succeeded despite `docker compose config` "passing"
- Insisting on empirical proof over documentation claims — actually running `docker compose up`, capturing `redis-cli monitor` output, and driving a real WS client through a full race — turned three unfalsifiable claims into verified facts (or, for one, an honest "doesn't work yet, here's the fix")
- Decimal gap-closure phases (03.1, 04.1, 05.1, 06.1, 07.1) kept fixes scoped and separately verifiable rather than silently folding them into the original phase's history

### What Was Inefficient
- The pre-close verification audit went through two full rounds (an initial pass, then a fresh re-verification after doc edits) because editing a VERIFICATION.md's own content resets its staleness clock relative to covered_files that include ROADMAP.md/PROJECT.md — any subsequent doc-only commit re-triggers "stale" with no way to reach a clean `verified_closeout` without either freezing all doc edits mid-audit or accepting `override_closeout`
- One load-test harness bug (message-buffering race between attaching a listener and the event already having fired) cost a wasted first run before being fixed
- Two Docker builds hit disk-space exhaustion mid-build on a host already near capacity; required pruning build cache before retrying

### Patterns Established
- For any resume/portfolio claim ("low-latency", "handles N concurrent users", "distributed with Redis"), demand the specific measured number or run the test yourself — a claim that can't be falsified is treated as false until measured
- When re-verification finds a NEW gap the original task framing didn't anticipate, surface it explicitly rather than silently accepting or reverting — let the human decide, with the evidence in hand
- A verifier's own re-verification of "the fix is stale" often just means unrelated doc/code changed in `covered_files` since the last pass, not that the finding itself regressed — read the diff before assuming a regression

### Key Lessons
1. `docker compose config` validates YAML syntax and topology, not that the images actually build — the only way to know a multi-container stack works is `docker compose up`
2. A per-IP rate limiter in a load test looks identical to a real capacity ceiling unless you check server logs for the actual rejection reason
3. Anti-cheat keystroke-interval floors (20ms here) will silently reject a scripted test client that sends keystrokes without pacing — always match server-side timing assumptions when scripting a full-flow proof
4. Fresh subagent re-verification is worth the cost before a milestone close — it caught things a human skim of SUMMARY.md files would not have

### Cost Observations
- Model mix: this session — Sonnet 5 (orchestration + direct fixes) + 9 parallel gsd-verifier subagent passes for fresh re-verification
- Notable: batching the 9 phase re-verifications as parallel subagent calls (rather than sequential) kept wall-clock reasonable for a full-milestone re-audit

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | several | 12 | First milestone — established decimal gap-closure phase pattern, empirical-proof-over-documentation-claim verification discipline |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | 243 | not separately measured | 0 (no new runtime deps added during verification/close) |

### Top Lessons (Verified Across Milestones)

1. Demand measured numbers for any performance/scale claim before it ships in resume-facing docs
2. `docker compose up`, not `docker compose config`, is the only real proof a multi-container stack works
