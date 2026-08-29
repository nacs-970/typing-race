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

(None yet — ship to validate)

### Active

- [ ] Room creation with 6-char code (e.g. ABC123) + shareable join link
- [ ] Lobby state: host can start countdown when ≥2 players present
- [ ] Synchronized race start — all clients begin typing the same passage on
      the same server tick (clock-sync handled, see Constraints)
- [ ] Server-authoritative input validation: server counts correct keystrokes,
      client only renders; rejects impossible timings (anti-cheat, best-effort)
- [ ] Live opponent cursors on the typing track (interpolated for smoothness)
- [ ] Per-word correctness + backspace handling for accurate WPM calculation
- [ ] Reconnect mid-race without corrupting race state
- [ ] Race-end screen: WPM + accuracy board, ranked by finish time then WPM
- [ ] Rematch button (same room, new passage)
- [ ] English passages only, bundled public-domain corpus (~50-100 short
      passages, ~30-60 words each)
- [ ] Public deployment to Fly.io (single process serves frontend + WS API),
      free tier with card on file

### Out of Scope

- Accounts / login / persistent identity — anonymous rooms only
- Persistent leaderboards — race results live in the room, vanish on disconnect
- Themes, ghost replay, share-result-image — deferred to v2 polish
- Non-English passages — English only for v1
- More than 8 players per room — hard cap, UI/scroll tuned for 2-8
- Persistent room history — rooms evaporate when last player leaves
- Multiplayer spectating post-race — lobby closes after rematch dismissed
- Mobile-first UI — desktop-first, mobile acceptable but not optimized

## Context

- FDE resume project — the demo and the GitHub link are the deliverable; the
  resume bullet targets "Built real-time multiplayer typing-race game with
  WebSocket rooms, server-authoritative input validation, and sub-100ms
  cursor sync across clients; deployed at [url]"
- Local-first development: build + run on laptop first, deploy to Fly.io
  only after v1 ships. Keeps the loop tight and avoids deploy-debug rabbit
  holes during the build.
- "Hard parts" worth highlighting in interviews: clock sync, server-authoritative
  input validation, reconnect mid-race, per-word WPM, cursor interpolation.

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
| Local-first dev, deploy later | Tight loop, no deploy-debug rabbit holes during build. Resume demo works offline. | — Pending |
| Fly.io single-process deploy | Native Bun/Hono fit, one URL, simplest free path | — Pending |
| Vite + React over Preact | Ecosystem + familiarity outweigh bundle-size win at this scale | — Pending |
| Bun + Hono over Node + Express/Fastify | Native WS, single runtime, fastest path to v1 | — Pending |
| In-memory room Map, no Redis | Demo scope, honest tradeoff. State-loss on restart is acceptable. | — Pending |
| Bundled passage corpus, no API | Zero runtime deps, works offline, instant load | — Pending |
| Server-authoritative keystroke counting | Anti-cheat foundation, even at best-effort level | — Pending |
| 6-char room code + shareable link | Code for verbal share, link for one-click join. Both paths. | — Pending |
| Best-effort anti-cheat (not hardcore) | Honest players see fair scores; no rate-limit / hash infra for v1 | — Pending |
| 2-8 player cap | Sweet spot for fun multiplayer, keeps UI/scroll sane | — Pending |

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
*Last updated: 2026-08-30 after initialization*