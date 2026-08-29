# Project Research Summary

**Project:** typing-race (realtime multiplayer typing-race game)
**Domain:** Realtime multiplayer browser game (WebSocket, server-authoritative)
**Researched:** 2026-08-30
**Confidence:** HIGH

## Executive Summary

typing-race is a greenfield realtime multiplayer browser game where 2–8 players join a 6-char code room, see a synchronized countdown, race typing a shared passage, watch each other's live cursors, and get ranked WPM/accuracy results with rematch. Experts in this genre (TypeRacer, Nitro Type, Monkeytype) universally use server-authoritative state over raw WebSocket with bundled public-domain passages, clock-sync on race start, and best-effort anti-cheat — our stack matches that pattern with a modern 2026 toolset: Bun 1.3 native `Bun.serve({ websocket })` for the lowest-latency WS server available, Hono 4 for HTTP, React 19 + Zustand 5 + Zod 4 for the SPA, and Fly.io single-process deploy with scale-to-zero.

The recommended approach is a `bun`-workspace monorepo with three packages: `shared` (Zod schemas = single source of truth for the wire protocol), `server` (Bun + Hono, in-memory `Map<roomCode, Room>`, no Redis), `client` (Vite 8 + React 19 SPA). Every WS frame validates through Zod at the boundary; race state lives only on the server; clients render server-confirmed snapshots; cursor updates are batched to 20–30 Hz and interpolated client-side over a 100 ms buffer. Honest tradeoffs are baked in: rooms vanish on restart (in-memory only), no accounts, no chat, no persistence — these are features, not bugs, for a 2-weekend resume demo.

Key risks are concentrated in three areas: clock-sync drift causing unfair starts (must solve in Race Engine phase), cursor jitter destroying the "two-laptop demo" moment (must solve with interpolation buffer + rAF lerp), and best-effort anti-cheat being trivially bypassed if `clientTs` is trusted (must use server timestamps). Each of these is well-understood and the mitigations are 5–50 lines of code each. Fly.io restart wiping rooms mid-race is acceptable for v1 but needs a graceful client-side error UI (not infinite retry).

## Key Findings

### Recommended Stack

Bun-native WebSocket server (not Hono's `upgradeWebSocket` shim) for typed `ws.data` and direct `maxPayloadLength`/`backpressureLimit` knobs. Hono 4 handles the small HTTP surface (health, future REST). The shared Zod schemas in `packages/shared` are imported by both client and server — different validators on each side re-introduce wire-schema drift, the exact bug this monorepo is designed to prevent. React 19 + Zustand 5 keeps render storms from 30 Hz cursor updates out of the main store via a dedicated cursor store. Vitest + happy-dom + `@testing-library/react` for component tests; `bun test` for server unit tests. Fly.io single-machine with `concurrency.type = "connections"` (one WS = one connection unit), `auto_stop_machines = "stop"`, `min_machines_running = 0` keeps demo idle cost at $0.

**Core technologies:**
- **Bun 1.3.x** — JS runtime + native WebSocket server + bundler + npm-compatible pkg manager; `Bun.serve({ fetch, websocket })` is the lowest-latency WS server in the Node-compat ecosystem with typed `ws.data` for per-connection context (room id, player id) without WeakMap gymnastics.
- **Hono 4.13.x** — ~14 KB zero-dep HTTP framework for `/api/*` and `/health`; runs unchanged on Bun/Node/Deno/Workers, type-safe middleware, but we do NOT use its `upgradeWebSocket` helper on Bun (native path is faster + gives typed `ws.data`).
- **React 19.2.x + Vite 8.2.x + `@vitejs/plugin-react` 6.1.1** — concurrent rendering + automatic batching matters when opponent cursors stream at 30 Hz; Vite 8 with the oxc-based plugin enables one-line React Compiler opt-in later (defer to v2 — measure first).
- **TypeScript 7.0.2** — shared types for WS messages, room state, race protocol; one source of truth in `packages/shared` imported by both apps.
- **Zustand 5.0.15 + Zod 4.5.4 + nanoid 6.0.1 + pino 10.3.1** — minimal client store, wire-schema validation at boundary, 6-char URL-safe room codes, structured server logs (JSON in prod for Fly, pretty in dev).
- **Fly.io single-process** — `oven/bun:1.3.x-slim` multi-stage Dockerfile, `auto_stop_machines = "stop"` for scale-to-zero, `concurrency.type = "connections"` for WS-friendly load semantics.

### Expected Features

**Must have (table stakes):**
- Create room with 6-char shareable code/link — every typing-race competitor (TypeRacer, Nitro Type) uses this; no way to play friends without it.
- Lobby with player list + host "Start" button — gated countdown trigger when ≥2 players.
- Synchronized countdown → race start on server tick — fair start, no client-clock advantage.
- Race track with per-word correctness + backspace — the typing surface itself; backspace is required for fairness on typos.
- Live opponent cursor on track (interpolated, 30 Hz) — Core Value, the "two-laptop demo wow" moment.
- Server-authoritative keystroke counting + best-effort anti-cheat — fair WPM; client numbers are never trusted.
- Race-end results board (ranked by finish time then WPM) — shows who won, the universal closer.
- Rematch button (same room, new passage from bundled corpus) — keeps the social loop tight.
- Reconnect mid-race without state corruption — robustness baseline; PROJECT.md calls reconnect out specifically.
- Bundled public-domain passage corpus (~50–100 short English passages) — instant load, works offline, zero runtime dep.
- Fly.io single-process deploy — public URL for resume; scale-to-zero keeps demo cost at $0 idle.

**Should have (competitive):**
- Sub-100 ms cursor sync latency (visible differentiator in side-by-side demo) — native WS + 30 Hz batching + client interpolation.
- Clean minimal UI with smooth caret animation — Monkeytype proved the niche; tasteful colors + CSS caret land well.
- 6-char code + shareable link (both paths) — verbal share + click share, most competitors pick one.
- Best-effort anti-cheat (impossible-timing rejection, min-interval check, char-match) — blocks lazy script kiddies; 4 cheap server-side checks defeat 95% of casual cheating.

**Defer (v2+):**
- Live WPM/accuracy readout during race (not just at end) — players ask "how am I doing?"; easy polish.
- 2-3 themes / dark mode toggle — when feedback says "make it mine."
- Reaction emoji on race-end (3-4 buttons, no chat) — when "I want to trash-talk" emerges; chat is an anti-feature.
- Sound effects (keystroke / countdown / finish) — demo polish.

### Architecture Approach

Single Bun process serves the built Vite SPA (`packages/client/dist`), HTTP routes via Hono (`/api/*`, `/health`), and the WebSocket endpoint (`/ws`) — one container, one port, one URL. Room state lives in an in-memory `Map<string, Room>` keyed by 6-char code; each Room owns a Race Controller (FSM: lobby → countdown → racing → finished) plus a `Map<playerId, Player>` with server-authoritative `cursorIndex`, `correctChars`, `lastKeystrokeMs`. WS messages are discriminated unions validated through Zod at the boundary — invalid messages hard-close (anti-cheat signal). Clients maintain a `WsConnection` wrapper that updates two zustand stores: a `roomStore` (lobby/race state, ~1 Hz) and a separate `cursorStore` (30 Hz) to isolate render hot paths. Cursor interpolation is 5 lines of `requestAnimationFrame` lerp with a 100 ms buffer — no GSAP, no react-spring.

**Major components:**
1. **Race View** — React component renders passage, accepts keystrokes, shows own + opponent cursors, WPM live. Optimistic local render of own keystroke; server confirms/corrects on next broadcast.
2. **Race Controller (per-room)** — State machine (lobby → countdown → racing → finished), server tick, keystroke validation, winner detection, anti-cheat enforcement. Lives in `apps/server/src/race.ts`.
3. **Room Manager** — `Map<string, Room>` keyed by 6-char code; create/lookup/evict; cap 8 players; sweep idle rooms every 60s; collides on create retry once. Lives in `apps/server/src/rooms.ts`.
4. **Shared Types Package** — Zod discriminated unions for every WS frame (lobby_state, race_start, keystroke, cursor, race_end, rematch) plus inferred TS types. Imported by both apps; one source of truth eliminates schema drift.

### Critical Pitfalls

1. **Clock sync drift causes unfair race starts** — players begin typing 200-500 ms apart because client clocks diverge from the server "go" moment; WPM inflation of 10-15% for the early starter. Mitigate with server-authoritative `startAtServerMs` + NTP-style offset handshake + client gating first keystroke on `(startAtServerMs - clockOffset + countdown)`. Use `performance.now()` for in-race timing, never `Date.now()`.
2. **WPM convention drift** — different formulas produce wildly different numbers (62 WPM vs 84 WPM for identical effort). Mitigate by picking ONE convention explicitly (standard `correctChars / 5 / minutesElapsed`), computing only on the server, unit-testing with known fixtures ("30 chars in 30 s → 2 WPM"). Net WPM and raw WPM both surfaced with different denominators.
3. **Backspace handling breaks per-word correctness** — modelling typing as a string-append log instead of a position-aware buffer causes "I corrected every error and my accuracy still dropped." Mitigate with per-character state enum (`pending | correct | error | corrected`), word-correctness only if ALL chars end `correct` at race end, backspace transitions state without deleting history.
4. **Reconnect mid-race corrupts opponent views / state divergence** — server treats reconnect as new join, resets progress, broadcasts "player joined" to room. Mitigate with `sessionToken` issued at join, reconnect sends `{roomCode, sessionToken}`, server re-binds to existing player slot + sends full race snapshot, opponent sees "player reconnected" not "player joined", 500 ms grace before keystrokes count.
5. **Server-authoritative anti-cheat that trusts `clientTs`** — cheater sends `clientTs: Date.now() + 60000` on every keystroke, server accepts, inflated WPM wins. Mitigate by server-stamping every keystroke on receipt with its OWN clock; reject pre-start (before `serverStartTs + grace`); validate inter-keystroke intervals `> 20 ms`; cap sustained WPM at ~250; char-match against passage. Four cheap checks defeat 95% of casual cheating.

## Implications for Roadmap

Based on research, suggested phase structure (buildable independently, each demoable end-to-end):

### Phase 1: Foundation (Monorepo + Shared Contract + Hello World)
**Rationale:** Everything downstream depends on the wire-format contract and the deploy pipeline. Establish bun-workspace monorepo, `packages/shared` Zod schemas, `packages/server` skeleton with `/health`, `packages/client` Vite+React skeleton serving "Hello world" via Bun-native static serving. Validate the Bun+Hono+React+Fly.io pipeline end-to-end before any game logic.
**Delivers:** Three-package monorepo, deployed "Hello world" on Fly.io, shared Zod schemas, `fly.toml` + Dockerfile + CI basics.
**Addresses:** Pre-flight for all features; proves the deploy works before game complexity stacks on.
**Avoids:** Pitfall 11 (Bun+Fly.io runtime drift) — pin Bun version, test production bundle locally in CI.
**Uses:** Bun workspaces, Zod 4, Hono 4, Vite 8, React 19, `oven/bun:1.3.x-slim` Dockerfile.

### Phase 2: Race Engine + Clock Sync + Server-Authoritative Core
**Rationale:** Foundation of the whole "fair race" core value. Without server-authoritative keystroke validation and clock-sync, every other feature (live cursors, results, WPM) is built on sand. Two-phase NTP-style clock-sync handshake + `startAtServerMs` countdown. Server-timestamped keystroke validation with the 4 anti-cheat checks (server-timestamp, pre-start reject, min-interval, char-match).
**Delivers:** Race Controller FSM, keystroke handler with anti-cheat, `race_start` broadcast, countdown UI on client, optimistic local render of own cursor + server-confirmed opponent cursor (no interpolation yet).
**Addresses:** Synchronized race start, Server-authoritative keystroke counting, Best-effort anti-cheat, Live opponent cursors (basic).
**Avoids:** Pitfall 1 (clock sync drift), Pitfall 2 (race-start race condition), Pitfall 7 (anti-cheat bypass via trusted clientTs).
**Implements:** Architecture Pattern 1 (Discriminated Union WS Messages), Pattern 2 (Server-Authoritative Race State), Pattern 3 (Two-Phase Clock Sync).
**Research flag:** Pitfall 1 + 2 + 7 are HIGH-confidence well-trodden pitfalls with explicit recipes — measure clock offset per region, write integration tests for the race-start race condition, write anti-cheat tests that send `clientTs = Date.now() + 60000` and verify WPM reflects real elapsed time.

### Phase 3: Race Track + Per-Word Correctness + WPM + Results
**Rationale:** The visible typing surface and the universal closer. Per-character state model (`pending | correct | error | corrected`) for backspace-aware correctness; word-correctness aggregated from char states. Standard WPM formula `correctChars / 5 / minutesElapsed` computed server-only. Results board ranked by finish time then WPM with explicit tiebreaker order.
**Delivers:** Race View with passage render, backspace handling, live opponent cursor (still no interpolation polish), race-end detection, Results view with rankings, WPM + accuracy display.
**Addresses:** Race track + backspace, Per-word correctness, WPM + accuracy display, Race-end results board, Bundled passage corpus.
**Avoids:** Pitfall 3 (WPM off-by-one), Pitfall 4 (backspace handling), Pitfall 8 (race-end ties).
**Implements:** Architecture Hard Parts section (Server-Authoritative Keystroke Validation, Per-Word WPM).
**Research flag:** NONE — well-documented typing-test conventions; the value here is unit tests with known fixtures, not novel research.

### Phase 4: Reconnect + Resilience + Room Lifecycle
**Rationale:** Without reconnect, demo wifi-blip = "looks broken." Without room sweeping, Fly.io RSS climbs to OOM within hours. Both are reliability multipliers — not new features, but ungating the "live URL on resume" claim. `sessionToken` issued at join, reconnect re-binds WS to existing slot, server sends full race snapshot, opponent sees "B reconnected" not "B joined." 60s room sweeper removes idle rooms >10min. 15s heartbeat ping with 5s pong timeout. Per-IP rate limit on room creation (10/hr).
**Delivers:** `sessionToken` issuance + reconnect handshake, race snapshot replay, room sweeper interval, heartbeat ping/pong, per-IP room-creation throttle, WPM board polish (per-word correctness breakdown, finish time ranking).
**Addresses:** Reconnect mid-race, Rematch (new passage from corpus), WPM board polish.
**Avoids:** Pitfall 5 (reconnect state corruption), Pitfall 9 (memory leak from abandoned rooms).
**Implements:** Architecture Hard Parts section (Reconnect Mid-Race).
**Research flag:** MEDIUM — Bun's WS lifecycle quirks (close vs abort vs browser tab kill) need empirical testing; write a "force-kill the browser tab" test in CI.

### Phase 5: Frontend Polish + Cursor Interpolation + UX
**Rationale:** The "two-laptop demo wow" depends on cursor smoothness. 30 Hz cursor updates interpolated client-side over a 100 ms buffer with linear `requestAnimationFrame` lerp; CSS `transform: translate3d()` outside the React tree for cursor element to avoid DOM thrash. Extrapolation cap ~150 ms when no fresh sample. UX polish: per-player "ready" indicator in lobby, server-synced countdown display, "Starting in 2s..." pause before rematch, distinct error toasts ("Server restarted — room lost" vs "Lost connection").
**Delivers:** Smooth 60 fps opponent cursors, server-synced countdown UI, reconnect progress bar (5s grace), graceful error toasts, WPM rounded to integer with raw + net breakdown, time-delta-to-winner on results.
**Addresses:** Sub-100 ms cursor sync latency (visible differentiator), Clean minimal UI with smooth caret.
**Avoids:** Pitfall 6 (cursor jitter), UX pitfalls (input field unfocus on render, race-start countdown local clock, silent disconnect).
**Implements:** Architecture Pattern 4 (Cursor Interpolation Buffer).
**Research flag:** MEDIUM — exact interpolation buffer size (100 ms vs 200 ms) is empirical; profile on localhost + simulated 100 ms RTT before locking.

### Phase 6: Deploy & Hardening + Optional v1.x Polish
**Rationale:** Final pass before the resume URL goes public. `fly deploy --strategy immediate` (NOT rolling — state-loss mid-race is worse than brief downtime). SIGTERM handler drains in-flight rooms. Bun version pinned in `package.json` + Dockerfile. CI runs `bun run start` against pinned version before every deploy. Heartbeat verified end-to-end. Anti-cheat revisited with the 4 checks confirmed in tests. Optionally: React Compiler opt-in (one-line config) if DevTools profiling shows cursor render as bottleneck — measure first, do not pre-optimise. v1.x polish: live WPM during race, 2-3 themes, reaction emoji on race-end.
**Delivers:** Graceful shutdown, deploy strategy documented in README, Bun version pinning, hardening tests, optional React Compiler, optional v1.x polish (live WPM, themes, emoji).
**Addresses:** Fly.io single-process deploy (finalized), Fly.io restart wipes rooms (graceful UX), Best-effort anti-cheat (revisited).
**Avoids:** Pitfall 10 (Fly.io restart wipes rooms mid-demo), Pitfall 11 (Bun runtime drift on version bump).
**Research flag:** LOW — well-documented Fly.io patterns; verify against current Fly.io docs at deploy time.

### Phase Ordering Rationale

- **Foundation before game logic:** Zod schemas + monorepo + deploy pipeline must exist before any feature can be verified end-to-end. Skipping this phase (e.g., "let's just write the React app first") compounds every subsequent phase with monorepo/deploy rework.
- **Race Engine before Results before Polish:** Server-authoritative keystroke validation is the foundation for WPM, results, and reconnect — but those are useless without the race actually working. Clock sync lives in the same phase as the engine because the same WS handshake is reused.
- **Per-Word Correctness bundled with Race Track:** The per-character state model is required for both backspace handling AND WPM accuracy AND word correctness — splitting them across phases means two passes over the same logic.
- **Reconnect before Polish:** Reconnect is ungating the "live URL on resume" claim. Without it, the demo video can break on a wifi blip. Polish without reliability looks broken; reliability without polish still demos well.
- **Cursor Interpolation after the basic cursor exists:** Interpolation is a refinement on top of server-broadcast cursor position — building it before the basic cursor works is premature optimization.
- **Hardening last:** Graceful shutdown, version pinning, deploy strategy, anti-cheat review all assume the rest of the system exists. Doing them earlier means rework.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Race Engine + Clock Sync):** HIGH-stakes — clock-sync handshake quality varies by region; need empirical NTP-style handshake tests with simulated 50/100/200 ms RTT. Anti-cheat thresholds (20 ms min-interval, 250 WPM cap, 50 ms pre-start grace) need calibration against real typing data. Plan a 1-2 day spike on clock sync + anti-cheat before committing.
- **Phase 4 (Reconnect + Resilience):** MEDIUM — Bun's WS lifecycle events (close, error, unexpected disconnect, browser tab kill) need empirical mapping; heartbeat ping/pong in Bun's `Bun.serve` WebSocket handler has subtleties vs Node `ws`. Plan a spike on WS lifecycle + heartbeat.
- **Phase 5 (Frontend Polish + Cursor Interpolation):** MEDIUM — interpolation buffer size (100 vs 200 ms), extrapolation cap (150 ms), and CSS `transform: translate3d()` perf need empirical tuning. Profile under simulated 100 ms RTT with 4 cursors.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Standard monorepo + deploy setup; no novel research needed.
- **Phase 3 (Race Track + WPM + Results):** Typing-test conventions are well-documented (monkeytype, TypeRacer); the value is unit tests with known fixtures, not novel research.
- **Phase 6 (Deploy & Hardening):** Fly.io patterns are well-documented; verify against current docs at deploy time, but no upfront research spike needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Runtime + framework + deploy verified against npm registry + Context7 docs + production references on 2026-08-30; React Compiler tooling MEDIUM (config shape new in 2026, but additive — defer); room-code collision math LOW (depends on chosen alphabet — call out for design). |
| Features | HIGH | Competitor landscape (TypeRacer, Nitro Type, Monkeytype) is well-documented; PROJECT.md explicit Out-of-Scope list matches user research; conventions (WPM formula, race-start sync, bundled corpus) are industry-standard. |
| Architecture | HIGH | Discriminated union + Zod + server-authoritative + cursor interpolation are established patterns; Component breakdown matches standard realtime multiplayer game architecture; data flow verified against WebSocket multiplayer game literature (Gaffer on Games, Gabriel Gambetta). |
| Pitfalls | HIGH | Established realtime/WS class pitfalls (clock sync, latency smoothing, reconnect, anti-cheat boundary) well-documented in game-dev literature; Bun+Fly.io specifics MEDIUM because Bun's prod-track APIs and Fly.io's free-tier behavior evolve — pin versions, verify in CI. |

**Overall confidence:** HIGH

### Gaps to Address

- **Room-code alphabet + collision math:** STACK.md flags LOW confidence on collision math because we deferred to `nanoid` with custom alphabet. Plan to write a small collision-probability calculation during Phase 1 (e.g., 32 symbols × 6 chars = ~1.07B codes; collision odds at 10k live rooms ≈ 0.005%). Document the chosen alphabet (no `I/O/0/1` for visual ambiguity) and check-on-create-with-one-retry behavior in `packages/server/src/codes.ts`.
- **React Compiler timing:** STACK.md + Phase 6 flag MEDIUM on React Compiler wiring. Plan to ship v1 without it, profile cursor render cost under simulated load in Phase 5, then enable `react({ compiler: true })` in `vite.config.ts` if bottleneck shows in DevTools. Do not pre-optimise.
- **Tailwind / styling choice:** STACK.md explicitly defers styling to the UI phase. Phase 5 should decide Tailwind v4 vs plain CSS vs CSS Modules. Listed as "not yet" in STACK.md, not "use."
- **Bun WebSocket lifecycle under browser tab kill:** PITFALLS Pitfall 9 + Phase 4 flag this. Empirically verify during Phase 4 that WS `close` fires on tab kill (it usually does, but not always — mobile Safari is the test case).
- **NTP-style clock sync offset distribution per region:** Phase 2 flag. During planning, write a small probe that measures offset + jitter from 3-4 regions (home, VPS, simulated 100 ms RTT) to validate the handshake quality before locking the protocol.

## Sources

### Primary (HIGH confidence)
- `/oven-sh/bun` Context7 docs (`docs/runtime/http/websockets.mdx`, `docs/bundler/fullstack.mdx`) — Bun.serve WebSocket API, typed `ws.data`, native upgrade pattern
- `/honojs/hono` Context7 docs — Hono routing, `upgradeWebSocket` helper (rejected in favor of Bun-native path)
- `/vitejs/vite-plugin-react` README + `@vitejs/plugin-react@6.1.1` peer-deps — Vite 8 + React Compiler 1.0 wiring via oxc
- npm registry verified 2026-08-30 — versions for bun, hono, react, vite, zod, zustand, nanoid, pino
- nerdleveltech.com production guide (May 2026) + `meetdave3/remix-hono-on-bun` reference repo — Fly.io + Bun production pattern
- Gaffer on Games "1500 Archers on a 28.8" + "Fix Your Timestep" — lag compensation, interpolation buffer pattern
- Wikipedia NTP + Crist's algorithm — clock sync offset calculation
- Zod discriminated unions docs — schema-as-contract for WS frames

### Secondary (MEDIUM confidence)
- TypeRacer (typeracer.com) — multiplayer typing race conventions; cursor as ghost text, room codes, global leaderboard
- Nitro Type (nitrotype.com) — gamified multiplayer; cars, achievements, paid skins (all anti-features for our scope)
- Monkeytype (monkeytype.com) — single-player typing test UX conventions; smooth caret, live WPM, minimal UI
- Gabriel Gambetta client-side prediction / entity interpolation articles — remote entity smoothing
- Fly.io Bun runtime docs — single-process deploy, free tier limits, `concurrency.type = "connections"`

### Tertiary (LOW confidence)
- Bun prod-track API evolution (pin version, verify in CI) — Bun 1.3.x APIs verified but may shift in minor versions
- Fly.io free-tier machine restart behavior — empirically observed but may change; document graceful UX

---
*Research completed: 2026-08-30*
*Ready for roadmap: yes*