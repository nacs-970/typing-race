# Architecture Research

**Domain:** Realtime multiplayer game (browser-based, WebSocket)
**Researched:** 2026-08-30
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                       Browser Clients (2-8)                  │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────┐  ┌───────────┐  ┌───────────┐                │
│  │ Race View │  │ Lobby View│  │ Room Setup│                │
│  │  (React)  │  │  (React)  │  │  (React)  │                │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘                │
│        │              │              │                       │
│        └──────────────┼──────────────┘                       │
│                       │                                      │
│              ┌────────▼─────────┐                            │
│              │  WS Client       │  ← zustand store, hooks    │
│              │  (shared proto)  │                            │
│              └────────┬─────────┘                            │
└───────────────────────┼──────────────────────────────────────┘
                        │ wss://fly-host/room/:code
                        ▼
┌─────────────────────────────────────────────────────────────┐
│            Bun + Hono single process (Fly.io VM)            │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   Hono WS Router                      │   │
│  └─────┬────────────┬──────────────┬─────────────────────┘   │
│        │            │              │                          │
│  ┌─────▼─────┐ ┌────▼─────┐ ┌─────▼──────┐                   │
│  │  Room     │ │  Race    │ │  Passage   │                   │
│  │  Manager  │ │ Controller│ │  Registry  │                   │
│  │ (Map)     │ │ (per-room)│ │  (corpus)  │                   │
│  └───────────┘ └──────────┘ └────────────┘                   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │       Static File Server (built Vite bundle)         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
              ┌──────────────────┐
              │   Shared Types   │ ← monorepo `packages/shared`
              │   (Zod + TS)     │   imported by client + server
              └──────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Race View | Render passage, accept keystrokes, show own + opponent cursors, WPM live | React component, controlled `<input>`, canvas/DOM track |
| Lobby View | Show joined players, host start button, room code, copy link | React component, polls lobby state via WS |
| Room Setup | Generate 6-char code, create room on server, redirect to lobby | React form, single `POST /api/rooms` or WS create |
| WPM Board | Final ranking: finish time, WPM, accuracy, per-word correctness | React component, reads race-end state |
| WS Client | Maintain single WS connection, dispatch typed messages, reconnect on drop | `WebSocket` wrapper + zustand store, exponential backoff |
| Hono WS Router | Upgrade HTTP to WS, route by room code, dispatch to Room Manager | `@hono/node-ws` or Bun-native `server.upgrade()` |
| Room Manager | Create/lookup/evict rooms in-memory; cap 8 players; enforce code uniqueness | `Map<string, Room>`, single Map keyed by 6-char code |
| Race Controller | Per-room state machine (lobby → countdown → racing → ended); server tick; keystroke validation; winner detection | Class per Room, owns timers + per-player progress |
| Passage Registry | Bundled corpus (50-100 public-domain passages), pick random on race start | TS module exporting frozen array + `pickRandom(seed)` |
| Static Server | Serve `dist/` Vite bundle + SPA fallback to `index.html` | Hono `serveStatic` middleware |
| Shared Types | WS message schemas (lobby, race-start, keystroke, cursor, race-end, rematch); discriminated union; zod parse | `@typing-race/shared` package, both client + server import |

## Recommended Project Structure

Monorepo via Bun workspaces (lightweight, no Turborepo for v1):

```
typing-race/
├── package.json                  # workspace root, scripts: dev, build, deploy
├── bun.lockb
├── fly.toml                      # Fly.io config, single process, PORT 8080
├── packages/
│   └── shared/                   # WS message schemas, passage corpus, types
│       ├── package.json
│       ├── src/
│       │   ├── messages.ts       # zod schemas + discriminated union
│       │   ├── passages.ts       # bundled corpus (~60 passages)
│       │   ├── protocol.ts       # version constant, opcode enum
│       │   └── index.ts          # barrel
│       └── tsconfig.json
├── apps/
│   ├── server/                   # Bun + Hono backend
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.ts          # Hono app, serve static, upgrade WS
│   │   │   ├── rooms.ts          # Room Manager (Map + lifecycle)
│   │   │   ├── race.ts           # Race Controller (per-room FSM)
│   │   │   ├── ws-handler.ts     # message dispatch, validation
│   │   │   ├── clock.ts          # server tick, broadcast loop
│   │   │   └── codes.ts          # 6-char code generator (collision retry)
│   │   └── tsconfig.json
│   └── web/                      # Vite + React frontend
│       ├── package.json
│       ├── index.html
│       ├── vite.config.ts        # proxy /ws -> localhost:8080 in dev
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx           # router (no react-router needed for v1, hash routing)
│       │   ├── views/
│       │   │   ├── RoomSetup.tsx
│       │   │   ├── Lobby.tsx
│       │   │   ├── Race.tsx
│       │   │   └── Results.tsx
│       │   ├── components/
│       │   │   ├── Track.tsx          # passage render + cursor overlay
│       │   │   ├── OpponentCursor.tsx
│       │   │   ├── WpmLive.tsx
│       │   │   └── RoomCodeBadge.tsx
│       │   ├── net/
│       │   │   ├── ws-client.ts       # connection lifecycle
│       │   │   ├── messages.ts        # typed send/recv wrappers
│       │   │   └── reconnect.ts       # backoff + resume token
│       │   ├── store/
│       │   │   ├── room.ts            # zustand: lobby + race state
│       │   │   └── cursor.ts          # zustand: opponent cursor positions
│       │   ├── hooks/
│       │   │   ├── useKeystroke.ts    # debounced sender
│       │   │   ├── useClockSync.ts    # NTP-style RTT/offset
│       │   │   └── useInterpolation.ts # cursor smoothing
│       │   └── lib/
│       │       ├── wpm.ts             # local WPM calc
│       │       └── passage.ts         # helpers for per-word correctness
│       └── tsconfig.json
└── .planning/                    # existing
```

### Structure Rationale

- **`packages/shared/`:** Single source of truth for WS message shape. Client + server import zod schemas; server parses inbound, client parses inbound. Eliminates drift. Lives at monorepo root so neither app owns it.
- **`apps/server/src/rooms.ts` + `race.ts`:** Separation of concerns. Room Manager owns Map + player roster; Race Controller owns in-race state machine (countdown timer, per-player progress, winner detection). One Race Controller per active race.
- **`apps/web/src/views/`:** Page-level components, one per route. Each owns its WS subscription lifecycle.
- **`apps/web/src/store/`:** zustand for client state — light, no Redux ceremony. Two stores: room (server-pushed truth) + cursor (high-frequency, separate to avoid re-render storms).
- **No `components/ui/` folder:** v1 has 4 reusable widgets (Track, OpponentCursor, WpmLive, RoomCodeBadge). Inline in `components/`. Promote to subfolder only if v2 grows.
- **Hash routing over react-router:** Three routes total (`/`, `/room/:code`, `/race/:code`). Hash routing = static-host friendly, zero deps. v2 may swap for react-router if needed.

## Architectural Patterns

### Pattern 1: Discriminated Union WS Messages with Zod

**What:** Every WS frame is JSON `{ type: <opcode>, payload: <data> }`. A zod discriminated union validates client→server and server→client frames at the boundary. Both sides import the same schemas.

**When to use:** Always — this is the project's contract. Cheap to set up, catches schema drift at compile time + runtime.

**Trade-offs:** Zod adds ~12KB to client bundle (acceptable). Runtime validation per message is microsecond-scale — irrelevant at 10Hz update cadence. Forces a clear protocol version constant.

**Example:**
```typescript
// packages/shared/src/messages.ts
import { z } from 'zod';

export const LobbyState = z.object({
  roomCode: z.string().length(6),
  players: z.array(z.object({ id: z.string(), name: z.string(), ready: z.boolean() })),
  hostId: z.string(),
});

export const RaceStart = z.object({
  type: z.literal('race:start'),
  payload: z.object({
    passage: z.string(),
    startAtServerMs: z.number(),  // for clock sync
    durationMs: z.number(),
  }),
});

export const Keystroke = z.object({
  type: z.literal('input:keystroke'),
  payload: z.object({
    expectedIndex: z.number(),   // server's authoritative cursor pos
    char: z.string().length(1),
    serverTimeMs: z.number(),
  }),
});

export const CursorPos = z.object({
  type: z.literal('cursor:pos'),
  payload: z.object({ index: z.number(), serverTimeMs: z.number() }),
});

export const RaceEnd = z.object({
  type: z.literal('race:end'),
  payload: z.object({
    rankings: z.array(z.object({
      playerId: z.string(), finishedAtMs: z.number(), wpm: z.number(), accuracy: z.number(),
    })),
  }),
});

export const ServerMsg = z.discriminatedUnion('type', [LobbyState, RaceStart, RaceEnd, /* ... */]);
export const ClientMsg = z.discriminatedUnion('type', [Keystroke, CursorPos, /* ... */]);
```

### Pattern 2: Server-Authoritative Race State

**What:** Client sends keystroke events; server is the only component that knows the canonical cursor position, correct-char count, and elapsed time. Server broadcasts authoritative snapshots back. Client renders; never decides.

**When to use:** All race in-race state. Lobby/room creation can be looser (HTTP request/response is fine for create-room).

**Trade-offs:** Network latency = apparent input lag for the typing player. Mitigation: optimistic local render of own keystroke (cursor moves instantly), server confirms/corrects on next broadcast. Adds complexity but is the whole anti-cheat foundation.

**Example:**
```typescript
// apps/server/src/race.ts (sketch)
function onKeystroke(playerId: string, msg: KeystrokePayload) {
  const player = this.players.get(playerId)!;
  const passage = this.passage;
  const expected = passage[player.cursorIndex];
  if (msg.char === expected) {
    player.cursorIndex++;
    player.correctChars++;
    if (player.cursorIndex === passage.length) player.finishedAt = Date.now();
  } else {
    player.errorChars++;
    // optional: backspace on space-boundary tracked separately
  }
  // Anti-cheat: if msg.serverTimeMs < player.lastKeystrokeMs + 30ms → flag
  player.lastKeystrokeMs = msg.serverTimeMs;
  this.broadcast({ type: 'cursor:pos', payload: { playerId, index: player.cursorIndex } });
}
```

### Pattern 3: Two-Phase Clock Sync (NTP-style)

**What:** On WS connect, client sends `{ type: 'clock:sync', t0: clientNow }`. Server replies with `{ t1: serverNow, t0 }`. Client computes `offset = ((t1 - t0) + (t2 - t3)) / 2` after a second exchange. Server's `race:start.startAtServerMs` is in server time; client adds its offset to schedule countdown.

**When to use:** Before any race starts. Re-run if connection roams (mobile) or every 60s during long races.

**Trade-offs:** Two round-trips add ~50-100ms before race start — invisible. Sub-second accuracy good enough for a 30-60s race; clients within ~150ms see the same "go" frame.

**Example:**
```typescript
// apps/web/src/hooks/useClockSync.ts (sketch)
async function syncClock(ws: WebSocket): Promise<number> {
  const t0 = Date.now();
  ws.send(JSON.stringify({ type: 'clock:sync', t0 }));
  // wait for reply with t1=serverNow
  const { t1 } = await waitForMsg(ws, 'clock:sync:reply');
  const t3 = Date.now();
  const offset = ((t1 - t0) + (t1 - t3)) / 2;  // simplified, see Crist's algorithm
  return offset;
}
```

### Pattern 4: Cursor Interpolation Buffer

**What:** Opponent cursor updates arrive at ~10Hz with `{ index, serverTimeMs }`. Client keeps a 100ms buffer; render position = `interpolate(buffer, renderTime)` where `renderTime = serverNow - 100ms`. Hides jitter.

**When to use:** Always for remote cursors. Own cursor = no interpolation (render instantly).

**Trade-offs:** Adds 100ms perceived latency to opponent cursor (acceptable — it's an opponent). Removes jitter, hides packet loss. Buffer size should equal 2× typical packet interval.

**Example:**
```typescript
// apps/web/src/hooks/useInterpolation.ts (sketch)
function renderPos(buffer: {index: number, serverTimeMs: number}[], renderTime: number) {
  // find two samples bracketing renderTime, lerp
  const a = buffer.findLast(s => s.serverTimeMs <= renderTime);
  const b = buffer.find(s => s.serverTimeMs > renderTime);
  if (!a) return buffer[0].index;
  if (!b) return a.index;
  const t = (renderTime - a.serverTimeMs) / (b.serverTimeMs - a.serverTimeMs);
  return a.index + (b.index - a.index) * t;
}
```

## Data Flow

### Race Lifecycle (per race)

```
Host clicks Start
    ↓
Client sends {type: 'race:start', playerId}
    ↓
Server: Race Controller transitions lobby→countdown
    ↓
Server: pickRandom(passage), set startAtServerMs = now + 3000ms
    ↓
Server broadcasts {type: 'race:countdown', startAtServerMs} to all players in room
    ↓
Each client renders countdown, schedules local timer at (startAtServerMs - offset)
    ↓
At startAtServerMs: all clients enable input + server begins tick loop (10Hz)
    ↓
Per keystroke (each client): local optimistic render + send {type: 'input:keystroke'}
    ↓
Server validates, updates canonical cursor, broadcasts {type: 'cursor:pos', playerId, index}
    ↓
All clients update opponent cursor (interpolated)
    ↓
First player to reach passage.length → server broadcasts {type: 'race:end', rankings}
    ↓
After 5s or all-done: room returns to lobby state, rematch button enabled
```

### State Management

```
Server (truth)
    ↓ wss://  (10Hz during race, on-event otherwise)
WS Client (apps/web/src/net/ws-client.ts)
    ↓ zustand dispatch
Room Store (lobby + race state, 1Hz re-render OK)
    ↓ subscribe
React Views
    ↓ user types
Keystroke Hook (debounced, sends to WS)

Cursor Store (separate, 10Hz, NOT merged with room store — avoid re-render thrash)
    ↓ subscribe
OpponentCursor component (single canvas/DOM element)
```

Two-store split is deliberate: cursor updates at 10Hz would re-render the whole lobby/race tree if merged with room state. Cursor store isolates the hot path.

### Key Data Flows

1. **Room creation:** Host → `POST /api/rooms` → server generates code, creates Room in Map, returns `{ code }` → client redirects to `/room/:code`.
2. **Player join:** Second client → `ws://fly-host/room/ABC123` → server adds to Room.players, broadcasts updated LobbyState to all.
3. **Race start:** Host → `{type:'race:start'}` → server transitions FSM, broadcasts countdown → all clients schedule local timer.
4. **Keystroke:** Each client → `{type:'input:keystroke', expectedIndex, char, serverTimeMs}` → server validates + updates canonical cursor → broadcasts `{type:'cursor:pos', playerId, index}` at 10Hz (batched).
5. **Reconnect mid-race:** Client → `{type:'reconnect', resumeToken}` → server re-binds WS to existing player slot, sends full race state snapshot.
6. **Race end:** Server detects winner → freezes input → broadcasts `{type:'race:end', rankings}` → all clients show Results view.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-100 concurrent (Fly.io free tier, single VM) | Current architecture is correct. In-memory Map, single Bun process. |
| 100-1000 concurrent | Add rate limiting on `POST /api/rooms`; cap concurrent rooms at ~50 (8 players each); consider sticky sessions or sharding by code prefix. |
| 1000+ concurrent | Move to Redis (rooms + per-player cursor state); horizontal scale across multiple Fly VMs with sticky WS routing. Out of scope for v1. |

### Scaling Priorities

1. **First bottleneck:** Single VM memory. Each Room holds per-player state (~200 bytes) + passage (~500 bytes). 1000 concurrent rooms × 4 players avg = 4MB. Trivial. Real limit is Bun's WS connection count per file descriptor — comfortably 10k+ on Linux.
2. **Second bottleneck:** CPU on hot path — server validates every keystroke + broadcasts 10Hz × N players. For 8 players × 5 keystrokes/sec × 100 rooms = 4000 messages/sec. Trivial for Bun. Becomes relevant at ~100 rooms × 8 players.
3. **Network egress:** Fly free tier = 100GB/mo. Cursor broadcasts at 10Hz × 8 players × ~30 bytes = ~2.4KB/sec per room. 1000 rooms = 2.4MB/sec = ~6TB/mo. Hits limit at ~400 concurrent rooms. Workaround: throttle cursor to 5Hz; cursor interpolation masks the loss.

## Anti-Patterns

### Anti-Pattern 1: Client-Authoritative WPM

**What people do:** Compute WPM locally, send `{ wpm, accuracy }` to server, server ranks.
**Why it's wrong:** Trivially spoofable (send `{wpm: 9999}`). Defeats the whole "fair scores" core value. Server can't trust client numbers.
**Do this instead:** Server counts `correctChars` from validated keystrokes; computes WPM = `correctChars / 5 / minutesElapsed`. Client only renders the server's number.

### Anti-Pattern 2: Sending Every Keystroke as a Separate WS Frame

**What people do:** Client sends one WS message per keypress, server broadcasts one per keypress.
**Why it's wrong:** 8 players × 8 keys/sec = 64 messages/sec just for input. Adds latency on every keystroke. Causes re-render storms on every opponent keystroke.
**Do this instead:** Batch on the client: send `{keystrokes: [...]}` every 100ms (max 10Hz). Server coalesces into 10Hz broadcasts of cursor positions. Per-keystroke server-side validation stays, just less network chatter.

### Anti-Pattern 3: HTTP Polling for Live State

**What people do:** `GET /api/room/:code` every 500ms for lobby state.
**Why it's wrong:** Defeats the point of WebSockets. Adds 500ms perceived latency. 8 players polling = 8× server load.
**Do this instead:** Server pushes state on event (player join/leave, start). Client never polls during race.

### Anti-Pattern 4: Storing Rooms in a Database for v1

**What people do:** Spin up Postgres/Redis "to be safe."
**Why it's wrong:** Adds deploy complexity (multi-process = no shared in-memory). Out-of-scope for demo + FDE resume. Honest tradeoff stated in PROJECT.md.
**Do this instead:** In-memory Map. Rooms vanish on restart — explicitly accepted. If scale story becomes relevant later, swap to Redis. The Map interface can be abstracted behind a `RoomStore` to ease migration.

### Anti-Pattern 5: Clock Sync via `Date.now()` on Each Client

**What people do:** Each client uses local `Date.now()` to decide when race starts.
**Why it's wrong:** Client clocks drift seconds to minutes. One player gets a 3-second head start.
**Do this instead:** Server emits `startAtServerMs`. Client computes offset via NTP-style handshake (Pattern 3). All clients use `startAtServerMs - offset` as their local "go" instant.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Fly.io | Single-process Bun app via `fly.toml`, expose PORT 8080 | Free tier needs card on file. Sticky sessions not needed (WS upgrade handled in-process). |
| Public-domain passage corpus | Bundled in `packages/shared/src/passages.ts` | Project Gutenberg short quotes, public domain. Zero runtime deps. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `apps/web` ↔ `apps/server` | WebSocket only for race; HTTP only for room create (`POST /api/rooms`) | Both consume `@typing-race/shared` zod schemas. |
| `apps/server/rooms.ts` ↔ `apps/server/race.ts` | Direct function calls (single process) | Room owns Race Controller instance. Race Controller emits events; Room broadcasts. |
| Race Controller ↔ WS Handler | Event emitter pattern (`race.on('cursor', broadcast)`) | Keeps WS layer dumb — it only ships bytes, doesn't know game rules. |
| React Views ↔ WS Client | zustand store subscriptions + imperative `send()` | Two stores (room + cursor) to isolate 10Hz updates. |
| Client Keystroke Hook ↔ Server | `{type:'input:keystroke', expectedIndex, char, serverTimeMs}` | Client `expectedIndex` is informational; server still validates against its own canonical index. |

## Hard Parts — Design Decisions

### Clock Sync

Two-round-trip handshake on WS open. Server's `startAtServerMs` is the source of truth; clients schedule local countdown at `startAtServerMs - offset`. Target: all clients within ±50ms of each other for the "go" frame. Re-sync every 60s during long sessions (mobile tab backgrounded).

### Server-Authoritative Keystroke Validation

Server keeps `cursorIndex` per player. On keystroke:
- If `passage[cursorIndex] === char`: increment index, increment correctChars.
- Else: increment errorChars (backspace is its own opcode that decrements cursorIndex).
- Anti-cheat (best-effort): reject keystrokes with `serverTimeMs < lastKeystrokeMs + 30ms` (typing faster than ~2000 WPM = suspicious). Reject keystrokes that would jump cursorIndex by >1 forward (only backspace decrements).

Server computes WPM from `correctChars / 5 / (now - raceStartMs) * 60000`. Server is the only source of truth.

### Reconnect Mid-Race

Each player gets a `resumeToken` on join (random, stored in Room.players map keyed by token). Client stores token in `sessionStorage`. On WS reconnect, client sends `{type:'reconnect', token}`. Server re-binds WS socket to the existing player slot, sends full race state snapshot (`{type:'race:snapshot', cursorIndex, passage, raceStartMs, ...}`). Client snaps to that state and resumes. No race corruption.

### Cursor Interpolation

Remote cursor updates arrive at 10Hz with `{index, serverTimeMs}`. Client keeps a 200ms ring buffer (last 2 samples). Render = `lerp(buffer[0], buffer[1], (renderTime - buffer[0].serverTimeMs) / (buffer[1].serverTimeMs - buffer[0].serverTimeMs))`. Render time = `serverNow - 100ms` (100ms behind real-time for jitter hiding).

### Per-Word WPM

Track correctness per word (split passage by spaces). On space-typed:
- If all chars in word correct: `correctWords++`.
- Else: `errorWords++`.
- WPM uses `correctChars` for live calc (smooth), per-word correctness displayed in Results view for breakdown.

## Build Order (with dependencies)

1. **`packages/shared/`** — zod schemas, passage corpus. No deps. Foundation for everything.
2. **`apps/server/` skeleton** — Hono app, static file server, `/api/healthz`. Deps: `shared`.
3. **`apps/web/` skeleton** — Vite + React, single page, "Hello world". Deps: `shared` (consumes but doesn't need much).
4. **Room Manager** — `POST /api/rooms` creates room, returns code. WS route `/room/:code` upgrades + joins. Deps: `shared` (LobbyState schema).
5. **Lobby view** — show joined players, host start button (UI-only, no race yet). Deps: Room Manager.
6. **Race Controller — countdown** — host start → broadcast `race:countdown`. Clock sync handshake. Deps: Room Manager.
7. **Race Controller — keystroke validation** — input handler, cursor broadcast. Deps: countdown, shared messages.
8. **Race view** — passage render, own cursor, opponent cursor (no interpolation yet). Deps: Race Controller keystroke.
9. **Cursor interpolation** — add 200ms buffer + lerp. Deps: Race view.
10. **Race-end detection + Results view** — winner detect, rankings, WPM board. Deps: Race Controller.
11. **Reconnect mid-race** — resume token, snapshot broadcast. Deps: Race view.
12. **Rematch** — same room, new passage, reset race state. Deps: Results view.
13. **WPM board polish** — per-word correctness breakdown, finish time ranking. Deps: Results view.
14. **Deploy to Fly.io** — `fly.toml`, Dockerfile-less (use `bun` runtime), single process. Deps: everything.

Total: ~14 steps. Each step independently demoable. Steps 1-3 = "Hello world on Bun". Steps 4-5 = "Create room + lobby". Steps 6-9 = "Race works". Steps 10-13 = "Complete game loop". Step 14 = "Live URL for resume".

## Sources

- [Hono WebSocket docs](https://hono.dev/docs/helpers/websocket) — Bun-native upgrade pattern, message dispatch.
- [Zod discriminated unions](https://zod.dev/?id=discriminated-unions) — schema-as-contract for WS frames.
- [Glenn Fiedler "Fix Your Timestep"](https://gafferongames.com/post/fix_your_timestep/) — interpolation buffer pattern.
- [Crist's algorithm (NTP)](https://en.wikipedia.org/wiki/Network_Time_Protocol#Clock_synchronization_algorithm) — clock sync offset/offset calculation.
- [Fly.io Bun runtime](https://fly.io/docs/languages-and-frameworks/bun/) — single-process deploy, free tier limits.
- Project files: `/.planning/PROJECT.md`, `/spec.md`.

---
*Architecture research for: realtime multiplayer typing-race game*
*Researched: 2026-08-30*