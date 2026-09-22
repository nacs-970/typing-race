# Typing Race

## What This Is

A realtime multiplayer typing-race game. Create a room, share a 6-char code or
link, friends join the lobby, everyone types the same passage against a live
countdown, and a winner is decided by WPM + accuracy with opponent cursors
visible on every player's track view. Built to demo well: open two laptops,
watch the cursors race.

## Core Value

Two connected clients see each other's cursor in real time and the race ends
with a fair, identical WPM/accuracy score — nothing else matters.

## Requirements

### Validated

- ✓ Room creation with 6-char code + shareable join link — v1.0
- ✓ Lobby state: host starts countdown when ≥2 players present — v1.0
- ✓ Synchronized race start (server-tick countdown, two-phase clock sync) — v1.0
- ✓ Server-authoritative input validation (anti-cheat: server-timestamp,
  pre-start reject, ≥20ms min-interval, char-match) — v1.0. Regression tests
  cover replay/impossible-WPM/exact-boundary bypass attempts.
- ✓ Live opponent cursors on the typing track — v1.0. Server-authoritative
  via `cursor_update` broadcasts; own-player rendering is client-predicted
  for latency, opponents are server-sourced.
- ✓ Per-word correctness + backspace handling for accurate WPM — v1.0, with
  one accepted deviation: word-level aggregation (`aggregateWordCorrectness`)
  is computed but intentionally unconsumed by any UI/stats feature (D-13);
  char-level correctness (2-tone, not 3-tone — D-11/D-12) is what's rendered
  and what WPM/accuracy are actually computed from. Both deviations formally
  signed off (see 03-VERIFICATION.md).
- ✓ Reconnect mid-race without corrupting race state — v1.0. 500ms grace
  window, full snapshot resend, multi-tab session takeover (notify + evict).
- ✓ Race-end screen: WPM + accuracy board, ranked by score (wpm × accuracy +
  finish bonus, so finishers always outrank DNFs) — v1.0. Changed from the
  original finish-time-primary ordering per a later, explicit user request;
  ROADMAP/PROJECT text and the results-board delta display were both
  reconciled to the new formula (a display bug the change introduced —
  delta anchored to top score instead of fastest time — was found and fixed).
- ✓ Rematch button (same room, new passage) — v1.0
- ✓ Bundled public-domain passage corpus, no-repeat picker — v1.0 (67 passages)

### Active

(None yet for the next milestone — see Deferred Items in STATE.md for
carried-forward feature ideas: live WPM/accuracy during race, theme/dark-mode
toggle, reaction emoji, sound effects, cursor interpolation polish, per-char
error highlighting.)

### Out of Scope

- Accounts / login / persistent identity — anonymous rooms only
- Persistent leaderboards — race results live in the room, vanish on disconnect
- Themes, ghost replay, share-result-image — deferred to v2 polish (a
  player-settings panel with theme presets + cursor styling shipped
  post-v1.0-planning as an exception; full theme system remains deferred)
- Non-English passages — English only for v1
- More than 8 players per room — hard cap, UI/scroll tuned for 2-8
- Persistent room history — rooms evaporate when last player leaves
- Multiplayer spectating post-race — lobby closes after rematch dismissed
- Mobile-first UI — desktop-first, mobile acceptable but not optimized
- Public deployment to Fly.io — infra built and smoke-tested (Dockerfile,
  fly.toml, scripts/deploy.sh, graceful shutdown/drain), but `fly deploy`
  itself never run; fly.toml's `kill_timeout` (10s) was never bumped to the
  drain window (90s) since it's moot for an unused target. **Superseded**:
  the project deployed live to Render.com instead (render.yaml, free tier),
  fully verified end-to-end (create → join → race → results → rematch,
  and multi-tab session takeover) against the running production URL.

## Context

- FDE resume project — the demo and the GitHub link are the deliverable.
- **Shipped v1.0** (2026-09-23): live at https://typing-race-krhc.onrender.com/
  (Render free tier). 12 phases (7 primary + 5 gap-closure), 240 commits,
  ~7,300 LOC (TS/TSX excl. tests), 243 automated tests.
- **Measured, not claimed, numbers for the resume:** input-to-broadcast
  latency <5ms server-side (loopback, unified mode; tested to 200 concurrent
  players with no degradation); live Render free-tier instance runs
  ~5-10 concurrent rooms before latency rises to 100-200ms (0.1 CPU/512MB
  is the bottleneck, not the code); 243 tests.
- N-tier split (gateway/engine/web) with all three EventBridge transports
  (in-memory, loopback IPC, Redis pub/sub) proven working, not just designed —
  Redis specifically verified via real multi-container `docker compose up`
  with captured `PUBLISH` traffic, not just a mocked unit test.
- Local-first development: build + run on laptop first, deploy after v1
  ships. Kept the loop tight and avoided deploy-debug rabbit holes during
  the build; ended up deploying to Render rather than the originally-planned
  Fly.io.
- "Hard parts" worth highlighting in interviews: clock sync, server-authoritative
  input validation, reconnect mid-race, multi-tab session takeover, N-tier
  split with a pluggable event bus, and the verification-audit process itself
  (re-verifying all 9 phases fresh against the live codebase before shipping,
  catching a real display bug the ranking-formula change had introduced).

## Constraints

- **Tech stack — frontend**: Vite + React + TypeScript (Preact acceptable if
  bundle size matters; default to React for ecosystem)
- **Tech stack — backend**: Bun + Hono — native WebSockets, single deploy
  target, runs anywhere (Bun/Node/Deno/Workers), shared TS types for WS
  message schemas between client and server
- **Rooms — storage**: in-memory Map keyed by 6-char code. Honest tradeoff —
  rooms vanish on restart. Acceptable for demo + FDE resume scope; Redis/KV
  only if scaling story becomes relevant
- **Deploy — runtime**: Fly.io free tier, single shared VM serves frontend
  static bundle + WS endpoint from one Bun process. One URL, one process.
- **Code quality — shared types**: TypeScript types for all WS messages live
  in a shared package or monorepo folder; both client and server import from
  one source. No copy-paste schemas.
- **Race length**: ~30-60s target per race. Passages 30-60 words. Tuned so a
  race feels decisive but not exhausting.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Local-first dev, deploy later | Tight loop, no deploy-debug rabbit holes during build. Resume demo works offline. | ✓ Good |
| Fly.io single-process deploy | Native Bun/Hono fit, one URL, simplest free path | — Superseded: deployed to Render.com instead (free tier, no card requirement); `fly deploy` itself never run, infra kept as an unused alternative path |
| Vite + React over Preact | Ecosystem + familiarity outweigh bundle-size win at this scale | ✓ Good |
| Bun + Hono over Node + Express/Fastify | Native WS, single runtime, fastest path to v1 | ✓ Good — native `Bun.serve` WS (not Hono's `upgradeWebSocket`) for typed `ws.data` |
| In-memory room Map, no Redis (room storage) | Demo scope, honest tradeoff. State-loss on restart is acceptable. | ✓ Good for room storage — unchanged. Separately, Redis was later added as an *optional inter-tier event bus* for split-mode (gateway↔engine pub/sub), not room storage; proven working end-to-end this session (real containers, real `PUBLISH` traffic captured via `redis-cli monitor`) |
| Bundled passage corpus, no API | Zero runtime deps, works offline, instant load | ✓ Good |
| Server-authoritative keystroke counting | Anti-cheat foundation, even at best-effort level | ✓ Good — regression tests cover replay/impossible-WPM/boundary bypass |
| 6-char room code + shareable link | Code for verbal share, link for one-click join. Both paths. | ✓ Good |
| Best-effort anti-cheat (not hardcore) | Honest players see fair scores; no rate-limit / hash infra for v1 | ✓ Good |
| Ranking by score (wpm × accuracy + finish bonus), not finish-time-primary | User-requested change post-v1.0-planning: finishers should always outrank DNFs regardless of partial wpm/accuracy at grace-timeout | ✓ Good (2026-09-23: fixed a "delta anchored to top-score, not fastest time" display bug this change introduced) |
| 2-8 player cap | Sweet spot for fun multiplayer, keeps UI/scroll sane | ✓ Good |
| N-tier split: gateway/engine/web + pluggable EventBridge (in-memory / loopback IPC / Redis) | Phase 7 mid-course architecture change — separates WS edge from race logic for independent scaling/restart | ✓ Good — all three EventBridge transports verified working, not just unified mode |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-23 after v1.0 milestone*