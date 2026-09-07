# Roadmap: Typing Race

## Overview

Build a realtime multiplayer typing-race game from a greenfield monorepo to a deployed public URL on Fly.io. Six phases take us from a deployable "hello world" through a server-authoritative race engine with clock sync and anti-cheat, the visible race track with per-word WPM, mid-race reconnect, frontend polish with interpolated cursors, and final deploy hardening. Each phase is independently demoable: after phase 1 a URL serves a page, after phase 2 two clients race a synced countdown, etc.

## Phases

- [x] **Phase 1: Foundation** - Monorepo, shared contract, deployable hello world (completed 2026-08-30)
- [x] **Phase 2: Race Engine** - Server-authoritative core with clock sync and anti-cheat (completed 2026-08-30)
- [x] **Phase 3: Race Track + WPM** - Per-word correctness, backspace, results board, passage corpus (completed 2026-08-31)
- [x] **Phase 4: Reconnect** - sessionToken, room sweeper, heartbeat, rematch (completed 2026-09-03)
- [x] **Phase 5: Frontend Polish** - Cursor interpolation, smooth UX, error toasts (completed 2026-09-03)
- [ ] **Phase 6: Deploy + Hardening** - Graceful shutdown, version pinning, public Fly.io deploy
- [x] **Phase 7: Split into N-tier architecture** - Decouple client CDN, WebSocket gateway, race engine, and state tier (completed 2026-09-04)

## Phase Details

### Phase 1: Foundation

**Goal**: Establish a bun-workspace monorepo with shared Zod schemas, a Bun+Hono server skeleton with `/health`, a Vite+React client, and a working single-process Bun static + WS pipeline that can be deployed to Fly.io. Validate the full deploy pipeline end-to-end before any game logic.

**Depends on**: Nothing (first phase)

**Requirements**: REQ-12 (Fly.io single-process deploy), REQ-13 (shared TS types)

**Success Criteria** (what must be TRUE):

  1. `bun install` from repo root succeeds; `bun run --filter '*' build` produces both `apps/server/dist` and `apps/client/dist`
  2. `bun run dev` (or per-package dev) serves client at `http://localhost:5173` and server at `http://localhost:3000` with `/health` returning `{ok:true}`
  3. `fly deploy` from a clean checkout produces a public URL that serves the React "hello world" page and `GET /health` returns 200
  4. `packages/shared` exports Zod schemas (initial empty envelope + frame discriminator) and both server + client import them — no duplicate type definitions

**Plans**: 3 plans

Plans:

- [x] 01-01: bun-workspace monorepo skeleton (root `package.json`, `apps/server`, `apps/client`, `packages/shared`), TypeScript 7, ESLint/Prettier baseline, root scripts (`dev`, `build`, `test`)
- [x] 01-02: Server skeleton (Bun.serve + Hono 4, `/health` route, static SPA serving from `apps/client/dist` in prod, dev proxy), Client skeleton (Vite 8 + React 19 + Zod 4, "Hello Typing Race" page)
- [x] 01-03: Fly.io config (`fly.toml`, multi-stage `Dockerfile` on `oven/bun:1.3.x-slim`, `auto_stop_machines = "stop"`, `concurrency.type = "connections"`), deploy script, end-to-end deploy verification

### Phase 2: Race Engine

**Goal**: Server-authoritative race controller with two-phase NTP-style clock-sync handshake, server-timestamped keystroke validation (4 anti-cheat checks), and a countdown-to-racing FSM. Two clients can join a room, see a synchronized countdown, and race with server-confirmed cursor positions.

**Depends on**: Phase 1

**Requirements**: REQ-01 (room creation), REQ-02 (lobby), REQ-03 (synced race start), REQ-04 (server-authoritative input validation), REQ-06 (live opponent cursors)

**Success Criteria** (what must be TRUE):

  1. Two browser windows both pointed at a freshly created room see the same passage start typing within 50ms of each other (clock-sync verified)
  2. Server rejects keystrokes arriving before `serverStartTs + grace` (50ms) — verified by sending `clientTs` set 60s in the future and confirming WPM reflects real elapsed time, not the spoofed timestamp
  3. Server rejects keystrokes whose `clientTs` advances by less than 20ms between frames; cap sustained WPM at ~250
  4. When player A finishes the passage, player B's view within 1s shows A's cursor at the end of the passage and a "finished" indicator (no interpolation polish yet — just correctness)
  5. Room code is 6 chars, no `I/O/0/1`, shareable join link opens the room directly

**Plans**: 4 plans

Plans:

- [x] 02-01: Shared Zod wire schemas (`create_room`, `join_room`, `lobby_state`, `race_start`, `keystroke`, `cursor`, `error`) with discriminated union, Room code generator (`nanoid` custom alphabet, collision retry once)
- [x] 02-02: Room Manager (`Map<code, Room>`, create/lookup/evict, 8-player cap) + Race Controller FSM (lobby → countdown → racing → finished) with server `tick()`
- [x] 02-03: Two-phase clock-sync handshake (`sync_request` → `sync_response` with `t0/t1/t2/t3` per NTP, client computes `offset`), server-authoritative `startAtServerMs`, countdown UI gated on `(startAtServerMs - clockOffset)`
- [x] 02-04: Keystroke handler with 4 anti-cheat checks (server-timestamp on receipt, pre-start reject, min-interval ≥20ms, char-match against passage) + optimistic local cursor render + server-confirmed opponent cursor broadcast

### Phase 3: Race Track + WPM

**Goal**: The visible typing surface and the universal closer. Per-character state model for backspace-aware correctness, word-correctness aggregated from char states, server-computed standard WPM formula, and a race-end results board ranked by finish time then WPM. Bundled passage corpus with ~50-100 short public-domain passages.

**Depends on**: Phase 2

**Requirements**: REQ-05 (per-word correctness + backspace), REQ-08 (race-end board), REQ-10 (bundled passage corpus)

**Success Criteria** (what must be TRUE):

  1. Typing a passage with backspaces shows correct chars in green, errored-then-corrected chars in neutral, errored chars in red — word shows correct only when ALL chars end `correct`
  2. Server-computed WPM = `correctChars / 5 / minutesElapsed` matches a known fixture (e.g., 30 correct chars in 30s → 12 WPM) verified by unit test
  3. When the first player finishes, all other players see a results board within 1s with finish times, WPM, accuracy, and ranking (finish time primary, WPM tiebreaker)
  4. Loading any room pulls a passage from a bundled JSON file (no network call), 30-60 words, no two consecutive races in the same room use the same passage
  5. Rematch button on results board starts a new race in the same room with a new passage; "Starting in 2s…" pause shows server-synced countdown

**Plans**: 4 plans

Plans:

- [x] 03-01: Bundled passage corpus (50-100 public-domain English passages, 30-60 words each, JSON in `packages/shared` or server assets) + corpus picker (no-repeat within room)
- [x] 03-02: Per-character state model (`pending | correct | error | corrected`), word-correctness aggregator, server `keystroke` updates char states + broadcasts new cursor + char-state snapshot
- [x] 03-03: WPM + accuracy computation (server-only, standard formula, unit tests with fixtures: "30 chars in 30s → 2 WPM"; net WPM with errors penalty; raw WPM)
- [x] 03-04: Race-end detection (all players finished or one finished + others past 95% progress), Results view (ranked board, finish time / WPM / accuracy / time-delta-to-winner), Rematch button

### Phase 4: Reconnect

**Goal**: Mid-race reconnect without corrupting state, plus room lifecycle (idle sweeper, heartbeat ping/pong) and per-IP rate limiting. Makes the demo URL robust to wifi blips and prevents OOM on Fly.io.

**Depends on**: Phase 3

**Requirements**: REQ-07 (reconnect mid-race), REQ-09 (rematch polish from Phase 3 deliverable)

**Success Criteria** (what must be TRUE):

  1. Closing a browser tab mid-race and reopening the room URL within 60s restores the player's progress; opponent views show "X reconnected" not "X joined"
  2. Server sends full race snapshot on reconnect (`lobby_state` or current race state with all player cursors + char states), 500ms grace before reconnected keystrokes count
  3. Idle rooms (>10min no activity) are evicted by a 60s sweeper; opponent views show graceful "room closed" toast within 5s of last player leaving
  4. WS heartbeat ping every 15s with 5s pong timeout; dead connections closed cleanly without state corruption
  5. Creating >10 rooms from one IP in 1h returns HTTP 429; existing rooms unaffected

**Plans**: 4 plans

Plans:

- [x] 04-01: `sessionToken` issuance at join (signed or opaque random, stored in WS context), reconnect handshake (`rejoin_room` with `sessionToken`), server re-binds to existing player slot
- [x] 04-02: Race snapshot replay on reconnect (full state per player: cursor index, char states, WPM, race timer), 500ms grace period before keystrokes count, "X reconnected" broadcast
- [x] 04-03: Room sweeper (60s interval, evict idle >10min), heartbeat ping/pong in `Bun.serve` WS handlers (15s ping, 5s pong timeout, graceful close), per-IP room-creation rate limit (10/hr, in-memory LRU)
- [x] 04-04: Graceful disconnect UX (opponents see "X disconnected — waiting 30s" toast, not "X left"), WS lifecycle hardening (close vs error vs tab kill, mobile Safari coverage)
- [x] 04-05: Gap closure — cursor index restore, lobby/finished reconnect cleanup, dynamic host promotion & 60s uniform grace

### Phase 5: Frontend Polish

**Goal**: The "two-laptop demo wow" moment. Smooth 60fps opponent cursors via 30Hz server broadcast + 100ms client interpolation buffer + rAF lerp, server-synced countdown UI, reconnect progress bar, distinct error toasts.

**Depends on**: Phase 4

**Requirements**: REQ-06 (live opponent cursors — interpolation polish)

**Success Criteria** (what must be TRUE):

  1. Two side-by-side browser windows show opponent cursor moving smoothly across the passage with no visible jitter at 60fps (cursor interpolation verified under simulated 100ms RTT)
  2. CSS `transform: translate3d()` used for cursor positioning outside the React tree — React DevTools profile shows no per-frame React renders for cursor motion
  3. Lobby shows per-player "ready" indicator; countdown UI ticks down based on `startAtServerMs - clockOffset` (not local clock)
  4. Disconnect shows "Reconnecting… (5s)" progress bar; reconnect success restores prior view; reconnect failure shows distinct toast ("Lost connection — room lost" vs "Server restarted")
  5. WPM displayed rounded to integer with raw + net breakdown on hover; time-delta-to-winner shown on results

**Plans**: 4 plans

Plans:
**Wave 1**

- [x] 05-01: Separate `cursorStore` (30Hz, isolated from `roomStore` ~1Hz) in Zustand 5, cursor interpolation buffer (100ms) with linear rAF lerp, extrapolation cap 150ms

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 05-02: CSS `transform: translate3d()` cursor positioning outside React tree, GPU-accelerated layer, React DevTools profile verification (no per-frame React renders)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 05-03: Server-synced countdown UI, per-player "ready" lobby indicator, "Starting in 2s…" pause with synced timer, rematch flow polish
- [x] 05-04: Reconnect progress bar (5s grace), distinct error toasts (4 cases: lost connection / server restart / rate limit / version mismatch), WPM display polish (integer + raw/net hover tooltip), time-delta-to-winner

### Phase 6: Deploy + Hardening

**Goal**: Final hardening before the public resume URL. Graceful shutdown drains in-flight rooms on SIGTERM, Bun version pinned in `package.json` + Dockerfile, CI runs `bun run start` against pinned Bun before every deploy, anti-cheat regression tests, optional React Compiler opt-in if profiling shows cursor render as bottleneck.

**Depends on**: Phase 5

**Requirements**: REQ-12 (Fly.io deploy finalized)

**Success Criteria** (what must be TRUE):

  1. SIGTERM during active race triggers graceful shutdown: in-flight rooms get `error` frame "server shutting down", client shows graceful toast, no orphaned WS connections after 30s
  2. CI workflow (`bun test` + lint + typecheck + production build + smoke `bun run start` against pinned Bun 1.3.x) passes on every PR; deploy blocked on CI failure
  3. Anti-cheat regression tests confirm: future-timestamped `clientTs` rejected, sub-20ms intervals rejected, pre-start keystrokes rejected, WPM cap 250 enforced
  4. README documents deploy strategy (`fly deploy --strategy immediate` not rolling), restart behavior, graceful shutdown, and local dev workflow
  5. Live deploy URL serves the full game end-to-end: two browsers join, race, results show, rematch works — verified by manual smoke test before shipping

**Plans**: 4 plans

Plans:

- [ ] 06-01-PLAN.md — Graceful SIGTERM drain: `draining`/`drained` EventBridge contract, EngineWorker.drain()/GatewayInstance.drain() (90s cap), SERVER_SHUTTING_DOWN error code broadcast (D-01/D-02/D-03)
- [ ] 06-02-PLAN.md — `.bun-version` pin + Dockerfile/package.json drift-guard regression test (D-04/D-05; Dockerfiles were already pinned)
- [ ] 06-03-PLAN.md — Anti-cheat bypass regression tests (replay, impossible-WPM, exact boundary), README deploy-strategy/shutdown docs, local (non-Fly.io) smoke test script (D-06/D-07/D-08; CI gate and live Fly.io deploy explicitly deferred per 06-CONTEXT.md)
- [ ] 06-04-PLAN.md — Client-side SERVER_SHUTTING_DOWN toast in `apps/web/src/App.tsx`, split from 06-01 to keep that plan's file footprint near the 5-8 target (depends on 06-01)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete    | 2026-08-30 |
| 2. Race Engine | 4/4 | Complete    | 2026-08-30 |
| 3. Race Track + WPM | 4/4 | Complete    | 2026-08-31 |
| 4. Reconnect | 5/5 | Complete    | 2026-09-03 |
| 5. Frontend Polish | 4/4 | Complete    | 2026-09-03 |
| 6. Deploy + Hardening | 0/3 | Not started | - |
| 7. Split into N-tier architecture | 3/3 | Complete    | 2026-09-04 |

### Phase 7: Split into N-tier architecture

**Goal:** Decompose the monolithic server into a decoupled 3-tier architecture: Presentation Tier (`apps/web`), Real-time Gateway Tier (`apps/gateway`), Race Engine Tier (`apps/engine`), and Shared Contract Tier (`packages/shared`), supporting zero-install local dev and multi-tier containerization.
**Requirements**: D-01, D-02, D-04, D-05, D-06, D-07, D-08, D-09
**Depends on:** Phase 5, Phase 6
**Plans:** 3/3 plans complete

Plans:
**Wave 1**

- [x] 07-01: Event Bridge & Engine Extraction (Wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 07-02: Gateway Extraction & Dual-Mode Local Dev (Wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 07-03: Cloud-Agnostic Containerization & End-to-End Verification (Wave 3)
