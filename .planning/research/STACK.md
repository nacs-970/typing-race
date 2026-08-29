# Stack Research

**Domain:** Realtime multiplayer browser game (WebSockets, server-authoritative state)
**Researched:** 2026-08-30
**Confidence:** HIGH for runtime + framework + deploy; MEDIUM for React Compiler tooling (config shape is new in 2026); LOW for room-code collision math (depends on chosen alphabet — call out for design).

> Versions verified against the npm registry on 2026-08-30 via `https://registry.npmjs.org/<pkg>/latest`. Bun native API verified via `/oven-sh/bun` Context7 docs (`docs/runtime/http/websockets.mdx`, `docs/bundler/fullstack.mdx`). Hono WebSocket adapter verified via `/honojs/hono` Context7 docs. Vite 8 + React Compiler 1.0 wiring verified via `/vitejs/vite-plugin-react` README and the `@vitejs/plugin-react@6.1.1` peer-deps. Fly.io + Bun production pattern cross-checked against nerdleveltech.com production guide (May 2026) and `meetdave3/remix-hono-on-bun` reference repo.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|---|---|---|---|
| Bun | 1.3.x (runtime; ≥ 1.1.40 needed for `server.upgrade` typed `data`) | JS runtime + built-in bundler + native WebSocket server + npm-compatible pkg manager | One process, one runtime, no transpiler in the deploy image. `Bun.serve({ fetch, websocket })` is the fastest and lowest-allocation WS server available to a Node-compatible ecosystem; the runtime recognises `ws.data` so per-connection context (room id, player id) can travel with the socket without `WeakMap` gymnastics. Bun also has a native bundler we can optionally use to produce the static frontend, but we keep Vite for the frontend because of its HMR + React Compiler story. |
| Hono | 4.13.5 (or any 4.x ≥ 4.11.2 for `@hono/zod-validator` peer) | HTTP routing + middleware for `/api/*` and health checks | Hono is ~14 KB, zero deps, type-safe across middleware chains, and runs unchanged on Bun/Node/Deno/Workers. We use it for the small HTTP surface (health, future REST endpoints) and let `Bun.serve`'s `fetch` dispatch to it. We do **not** use Hono's `upgradeWebSocket` helper — Bun has a more direct path. |
| TypeScript | 7.0.2 | Shared types for WS messages, room state, race protocol | One source of truth for the wire format. Lives in `packages/shared` and is imported by both the React app and the Bun server. Eliminates the entire class of "client and server disagree on the schema" bugs that ruin demo days. |
| React | 19.2.x | UI rendering for lobby, race view, results screen | Concurrent rendering + automatic batching matters when opponent cursors stream at 30 Hz — without it we'd manually debounce state updates to avoid render storms. `useSyncExternalStore` lets the WS store feed React without tearing. |
| Vite | 8.2.x | Frontend dev server + production build | Fastest dev loop in the ecosystem, mature React plugin, Rolldown-powered production builds ship smaller bundles than esbuild/Rollup v4. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---|---|---|---|
| `@vitejs/plugin-react` | 6.1.1 | JSX + Fast Refresh + (optional) React Compiler | Always — this is the only plugin we need on the frontend. |
| `oxc-transform-react` | 0.147.x (peer of plugin-react v6) | React Compiler 1.0, Rust port, no Babel runtime cost | Use **only if** enabling React Compiler. With React 19 + Compiler 1.0 we can drop most `useMemo`/`useCallback` and let the compiler auto-memoize cursor-update renders. **Not needed for v1**; treat as a v2 perf win once cursor render cost is measurable. Skip the Babel-based form (`babel-plugin-react-compiler` + `@rolldown/plugin-babel`) — Vite 8 + plugin-react v6 uses oxc natively, and the Babel form is the older path. |
| Zustand | 5.0.15 | Local UI + connection-state stores | For lobby state, race state mirror, and the WebSocket connection wrapper. Vanilla store API means we can reuse the same store from a future test or worker without React context. Pair with `useSyncExternalStore` shim (built in) for tear-free subscriptions. |
| Zod | 4.5.4 | Schema-validate every inbound and outbound WS message | Server-authoritative input validation **starts at the wire boundary**. One schema per message type; reject on parse failure. Same schemas compile to TypeScript types via `z.infer<>` so the shared package exposes types and validators from one source. |
| `@hono/zod-validator` | 0.9.0 (peer: `hono ≥ 4.11.2`, `zod ^3.25 \|\| ^4`) | Validate HTTP body/query on Hono routes | Use on any `/api/*` HTTP route (health responses, room-creation REST fallback if we ever add one). |
| `nanoid` | 6.0.1 | Generate 6-char room codes from a URL-safe alphabet | 6 chars × ~56-symbol alphabet ≈ 30 billion codes — collision risk is real but tiny for v1; we still check-on-create and retry once. **Pick `nanoid`'s custom-alphabet API** rather than the default 21-char id, because we need exactly 6 readable chars. |
| `pino` + `pino-pretty` | 10.3.1 / 13.1.3 | Structured server logs | JSON in prod (so Fly's logs aggregator can ingest), pretty in dev. Wrap the WS `message` handler so anti-cheat rejects log with the reason and player id. |
| `@types/bun` | 1.4.0 | TS types for `Bun.serve`, `Bun.file`, `Bun.CookieMap`, `ServerWebSocket` | Required for server TS to typecheck. Listed as devDep only — runtime image doesn't need it. |
| `@types/react` + `@types/react-dom` | 19.2.18 / 19.2.5 | React 19 type definitions | Required peer of `@testing-library/react` and react-typed code. |
| `vitest` | 4.x | Unit + integration tests | Same Vite config we already have; covers race-state logic, WPM math, anti-cheat thresholds. |
| `@testing-library/react` | 16.3.3 | Component tests | Render `<RaceTrack/>` against a fake WS store. |
| `happy-dom` | 20.x | Test DOM (faster than jsdom) | Default test env for component tests. |
| `eslint` + `@typescript-eslint/*` + `eslint-plugin-react-hooks` | 10 / 8.68 / 7.1 | Lint guardrails | `react-hooks` catches missed deps that would have been auto-memoized by the Compiler — useful **before** turning the Compiler on, free afterwards. |
| `prettier` | 3.9.6 | Formatting | Standard. |

### Development Tools

| Tool | Purpose | Notes |
|---|---|---|
| `bun` as the JS runtime everywhere | Local dev, test, prod | Use `bun test` for unit tests, `bun --hot src/server.ts` for the dev server. Avoid mixing with `npm`/`pnpm` in the same repo — `bun.lock` is text-ish and `bun install` is fastest, so commit to one. |
| Vite dev proxy | Frontend → `/ws` and `/api` during dev | Add `server.proxy = { '/ws': 'ws://localhost:8080', '/api': 'http://localhost:8080' }` in `vite.config.ts` so the React app always sees same-origin URLs. |
| `oven/bun:1.3.x-slim` Docker base | Fly.io build | Multi-stage: `deps` stage installs with `--frozen-lockfile --production`, runtime stage copies `node_modules` + `src` and runs as non-root `bun` user. |
| `flyctl` | Deploy + machine scaling | Single-machine, `auto_stop_machines = "stop"`, `auto_start_machines = true`, `min_machines_running = 0`. WebSocket-friendly `concurrency.type = "connections"` (so each WS counts as one, not bursty request streams). |
| `wrk` or `autocannon` | WS load test | Sanity-check before the demo: 50 simulated rooms × 4 players per room. |

---

## Monorepo Layout

Recommended `bun`-workspace layout (zero extra tooling — Bun's built-in workspaces cover it):

```
typing-race/
├── package.json              # workspaces: ["packages/*"]
├── bun.lock
├── Dockerfile                # multi-stage; bun install → bun build frontend → bun run server
├── fly.toml                  # auto_stop_machines = "stop", concurrency = connections
├── packages/
│   ├── shared/               # WS message schemas (zod) + inferred TS types
│   │   └── src/
│   │       ├── messages.ts   # ClientToServer, ServerToClient discriminated unions
│   │       ├── race.ts       # RaceState, PlayerState, Passage
│   │       └── index.ts
│   ├── client/               # Vite + React 19
│   │   ├── vite.config.ts    # /api + /ws proxy to 8080
│   │   ├── index.html
│   │   └── src/
│   │       ├── ws/           # connection wrapper, reconnect logic
│   │       ├── stores/       # zustand: lobbyStore, raceStore
│   │       ├── screens/      # LandingScreen, LobbyScreen, RaceScreen, ResultScreen
│   │       └── components/   # RaceTrack, OpponentCursor, Countdown
│   └── server/               # Bun + Hono
│       ├── src/
│       │   ├── index.ts      # Bun.serve({ fetch, websocket })
│       │   ├── rooms.ts      # in-memory Map<roomCode, Room>
│       │   ├── race.ts       # race FSM (lobby → countdown → racing → finished)
│       │   ├── messages.ts   # parse + dispatch (uses @shared/messages)
│       │   ├── static.ts     # serves built client/ + SPA fallback
│       │   └── passages.json # bundled corpus (~80 passages, 30-60 words each)
│       └── tsconfig.json     # "types": ["bun"]
```

Why workspaces (vs a single package): the shared types are the whole point — Zod schemas on the server and React components on the client must agree on the wire format. A workspace makes `import { type JoinRoom, joinRoomSchema } from "@typing-race/shared"` a typed contract, not a copy-paste.

---

## Installation

The bootstrap script — assumes Bun 1.3+ is already installed:

```bash
# Workspace root
bun init -y
# Edit package.json to add:  "workspaces": ["packages/*"]

# Shared types + Zod schemas
mkdir -p packages/shared/src
# ... write packages/shared/src/{messages,race,index}.ts by hand ...

# Client (Vite + React 19 + TS)
mkdir -p packages/client
cd packages/client
bun create vite . --template react-ts        # interactive; pick "react-ts"
cd -
bun add -w zustand@5.0.15 nanoid@6.0.1

# Server (Bun + Hono)
mkdir -p packages/server/src
cd packages/server
bun init -y
bun add hono@4.13.5 @hono/zod-validator@0.9.0 zod@4.5.4 nanoid@6.0.1 pino@10.3.1
bun add -d @types/bun@1.4.0 pino-pretty@13.1.3

# Client dev deps
cd ../client
bun add -d @types/react@19.2.18 @types/react-dom@19.2.5 \
  vitest@4 happy-dom @testing-library/react@16.3.3 \
  eslint@10 @typescript-eslint/parser@8.68.0 @typescript-eslint/eslint-plugin@8.68.0 \
  eslint-plugin-react-hooks@7.1.1 prettier@3.9.6

# Optional (perf, v2): React Compiler via oxc
bun add -d oxc-transform-react@0.147
# Then in vite.config.ts:  react({ compiler: true })
```

### Production Dockerfile (Fly.io single process)

```dockerfile
# syntax=docker/dockerfile:1
ARG BUN_VERSION=1.3.14

FROM oven/bun:${BUN_VERSION}-slim AS base
WORKDIR /app

# ---- deps ----
FROM base AS deps
COPY package.json bun.lock bun.lockb* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/client/package.json ./packages/client/
COPY packages/server/package.json ./packages/server/
RUN bun install --frozen-lockfile

# ---- client build ----
FROM deps AS client-build
COPY packages/shared ./packages/shared
COPY packages/client ./packages/client
RUN bun --cwd packages/client run build      # writes packages/client/dist

# ---- runtime ----
FROM base AS release
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=client-build /app/packages/client/dist ./packages/client/dist
COPY packages/shared ./packages/shared
COPY packages/server ./packages/server
COPY package.json bun.lock ./
USER bun
EXPOSE 8080
WORKDIR /app/packages/server
ENTRYPOINT ["bun", "run", "src/index.ts"]
```

### `fly.toml` (the load-bearing 8 lines)

```toml
app = "typing-race"
[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  PORT     = "8080"

[http_service]
  internal_port       = 8080
  force_https         = true
  auto_stop_machines  = "stop"
  auto_start_machines = true
  min_machines_running = 0
  [http_service.concurrency]
    type       = "connections"
    soft_limit = 200
    hard_limit = 250

[[http_service.checks]]
  grace_period = "3s"
  interval     = "15s"
  method       = "GET"
  timeout      = "4s"
  path         = "/health"

kill_signal  = "SIGTERM"
kill_timeout = "10s"

[[vm]]
  cpu_kind = "shared"
  cpus     = 1
  memory   = "256mb"
```

Notes on the file: `concurrency.type = "connections"` (not `"requests"`) — for a WebSocket-heavy app this is the right unit; one WS counts as one. `min_machines_running = 0` + `auto_stop_machines = "stop"` keeps the demo at $0 idle (root-fs billing only). `kill_signal = "SIGTERM"` lets the server's graceful shutdown drain in-flight rooms before the platform force-kills.

---

## Server: Bun-native WS, not Hono's `upgradeWebSocket`

**Decision:** Use `Bun.serve({ fetch, websocket })` directly. Hono's `upgradeWebSocket` helper is documented for cross-runtime portability (Deno, Cloudflare Workers, edge); on Bun we get faster WS upgrades and per-connection typed `ws.data` by going native.

```ts
// packages/server/src/index.ts
import { Hono } from "hono";
import index from "./static";              // serves client/dist/* + SPA fallback
import { dispatch } from "./messages";

type WsData = { playerId: string; roomCode: string | null };
const rooms = new Map<string, Room>();     // in-memory

const hono = new Hono()
  .get("/health", (c) => c.text("ok"))
  .route("/api", apiRoutes);               // any future REST surface

const server = Bun.serve<WsData, undefined>({
  port: Number(process.env.PORT ?? 8080),
  idleTimeout: 120,                         // seconds; default is fine
  async fetch(req, srv) {
    const url = new URL(req.url);

    // 1. WebSocket upgrade path
    if (url.pathname === "/ws") {
      const playerId = crypto.randomUUID();
      const upgraded = srv.upgrade(req, { data: { playerId, roomCode: null } });
      if (upgraded) return;                  // Bun returns 101 internally
      return new Response("Upgrade failed", { status: 400 });
    }

    // 2. Hono for HTTP API
    if (url.pathname.startsWith("/api/") || url.pathname === "/health") {
      return hono.fetch(req);
    }

    // 3. Static frontend (built by Vite into packages/client/dist)
    return index(req);
  },
  websocket: {
    open(ws)   { /* look up player, send hello, wait for JoinRoom */ },
    message(ws, raw) {
      try {
        dispatch(ws, rooms, JSON.parse(typeof raw === "string" ? raw : raw.toString()));
      } catch (err) {
        ws.send(JSON.stringify({ type: "error", code: "BAD_MESSAGE", message: String(err) }));
      }
    },
    close(ws) { /* remove player from room; if room empty, delete from Map */ },
  },
});

process.on("SIGTERM", () => server.stop());  // graceful drain
process.on("SIGINT",  () => server.stop());
```

Why not `upgradeWebSocket` from `hono/helper/websocket`:
- It targets the standard `WebSocket`/`WebSocketPair` API (good for Workers/Deno), but Bun's `ServerWebSocket` gives us typed `ws.data`, `ws.subscribe()` for room broadcasting, and `backpressureLimit` knobs.
- Hono's docs explicitly call out that on Bun you can use `Bun.serve({ fetch, websocket })` directly with `app.fetch` in the fetch handler — exactly what we do.

---

## Client: Wire Schema → Zustand → React

**Decision:** One `WsConnection` class wraps the `WebSocket`, parses messages, and updates a small set of Zustand stores. React subscribes to the stores via `useStore(selector)`.

```ts
// packages/client/src/ws/connection.ts
import type { ServerToClient, ClientToServer } from "@typing-race/shared";
import { useLobbyStore } from "../stores/lobby";
import { useRaceStore }  from "../stores/race";

export class WsConnection {
  private ws!: WebSocket;
  constructor(private url: string) { this.connect(); }

  private connect() {
    this.ws = new WebSocket(this.url);
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data) as ServerToClient;
      switch (msg.type) {
        case "lobby_state":  useLobbyStore.setState(msg.state); break;
        case "race_start":   useRaceStore.setState({ status: "racing", passage: msg.passage, startAt: msg.startAt }); break;
        case "cursor":       useRaceStore.getState().applyCursor(msg.playerId, msg.position, msg.at); break;
        case "race_end":     useRaceStore.setState({ status: "finished", results: msg.results }); break;
        // ...
      }
    };
    this.ws.onclose = () => setTimeout(() => this.connect(), 1000); // reconnect
  }

  send(msg: ClientToServer) { this.ws.send(JSON.stringify(msg)); }
}
```

Zustand vs alternatives for this domain:
- **Redux / Redux Toolkit:** overkill. Our stores are tiny (lobby: 5 fields, race: 8 fields, connection: 3 fields). Zustand gives us `useStore(s => s.x)` selectors + `setState` actions with zero boilerplate.
- **Jotai:** fine for atom-style state, but a 30 Hz cursor stream wants a single store object we can `cork`-style batch — Zustand's `setState(partial)` is exactly that.
- **Recoil:** unmaintained-ish and React 19 compat is shaky.

React Compiler note: if we enable `react({ compiler: true })` later, **most** `useMemo`/`useCallback` in `RaceTrack`/`OpponentCursor` disappear. Don't pre-optimise now — write the naïve version, profile, then flip the compiler switch and watch the React DevTools "✨ Memo" badges land.

---

## Shared types: Zod schemas as the contract

```ts
// packages/shared/src/messages.ts
import { z } from "zod";

export const joinRoomSchema = z.object({
  type: z.literal("join_room"),
  code: z.string().regex(/^[A-Z0-9]{6}$/),
  nickname: z.string().min(1).max(20),
});
export type JoinRoom = z.infer<typeof joinRoomSchema>;

export const keystrokeSchema = z.object({
  type: z.literal("keystroke"),
  expectedIndex: z.number().int().nonnegative(),
  char: z.string().length(1),
  clientTs: z.number().int(),
});
export type Keystroke = z.infer<typeof keystrokeSchema>;

export const clientToServer = z.discriminatedUnion("type", [
  joinRoomSchema, keystrokeSchema /* ... */
]);
export type ClientToServer = z.infer<typeof clientToServer>;

export const serverToClient = z.discriminatedUnion("type", [
  z.object({ type: z.literal("lobby_state"), /* ... */ }),
  z.object({ type: z.literal("race_start"), passage: z.string(), startAt: z.number() }),
  z.object({ type: z.literal("cursor"), playerId: z.string(), position: z.number(), at: z.number() }),
  z.object({ type: z.literal("race_end"), /* ... */ }),
  // ...
]);
export type ServerToClient = z.infer<typeof serverToClient>;
```

Server-side: every inbound `ws.message` runs through `clientToServer.safeParse`. Anti-cheat rejects in the **next** layer (timing, monotonic cursor, etc.), but parse failures = hard close. No exceptions, no "best-effort parse the unknown shape" — invalid messages are always cheats or bugs, and we want to know which.

---

## Anti-cheat (best-effort, server-authoritative)

A short list of what we do **and why we don't go further for v1**:

| Check | Implementation | Why this is enough for v1 |
|---|---|---|
| Schema validation | `clientToServer.safeParse` | Rejects malformed messages before they touch state. |
| Cursor monotonicity | Server tracks `player.cursor`; rejects `keystroke.expectedIndex < player.cursor` or non-monotonic jumps | No negative deltas, no going backwards. |
| Char matches passage | `passage[expectedIndex] === char` | Server is the only source of "correct keystroke count". Client renders only what server confirms. |
| Rate limit | Sliding-window max keystrokes/sec/player (e.g. 25/s sustained, 40/s burst) | Even a paste of the full passage can't legitimately produce >20 WPM in ms-bursts. |
| Future-start reject | `now < room.startAt` keystrokes rejected | Stops clock-cheats where a client claims `clientTs` from before the start. |
| Reconnect resume | Reconnect carries `playerId` + `roomCode`; server restores cursor from `rooms.get(code).players[id].cursor` | The room state stays authoritative; client can never claim a better position than the server recorded. |

What we **don't** build: keystroke-timing biometrics, replay-window hashing, headless-browser detection, CAPTCHA on join. All of these need either a persistent identity layer or a server-side ghost trace — both are out of scope for "honest players get fair scores."

---

## Room state: in-memory `Map`

```ts
// packages/server/src/rooms.ts
type Room = {
  code: string;
  status: "lobby" | "countdown" | "racing" | "finished";
  players: Map<string, Player>;          // playerId -> Player
  passage: string | null;
  startAt: number | null;
  createdAt: number;
};
export const rooms = new Map<string, Room>();
```

- `Map<string, Room>` keyed by 6-char code. O(1) lookup per WS message.
- Eviction: on `close`, if `players.size === 0`, `rooms.delete(code)`. Cap idle rooms (e.g. >30 min in `lobby`) with a `setInterval` sweeper.
- **Honest tradeoff:** restart = all rooms gone. Acceptable per spec.
- **When to graduate to Redis:** the moment we run >1 Fly Machine. Until then: do not add Redis. (See "What NOT to Use".)

Room code generation: `nanoid(6)` with a custom alphabet of `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (32 symbols, no `I/O/0/1` to avoid visual ambiguity) → 32⁶ ≈ 1.07 billion. Collision odds at 10k live rooms ≈ 0.005%. Check-on-create with one retry is sufficient; we are not a lottery system.

---

## Clock sync (race start)

**Decision:** No library. Server time wins.

- Lobby join: client sends `{ type: "request_start", clientTs }`.
- Server replies `{ type: "race_start", passage, startAt: server.now() + 3000 }` (3-second countdown gives clients time to receive + render).
- Client renders countdown based on its own `performance.now()` clock; the **race clock starts at `startAt` regardless of client clock drift**. We do not measure or correct client clocks — they only display.
- During race: every `keystroke` carries `clientTs` but server validates using its own monotonic clock for `now < startAt` rejection only. We do not use `clientTs` for WPM math (server timestamps the keystroke when it accepts).

Why no `timesync`, no NTP, no `npt-client`: the server is the only time authority that matters. We don't sync clocks — we don't need them synced.

---

## Cursor interpolation (for smooth remote cursors)

**Decision:** No library. Linear interpolation on `requestAnimationFrame`.

```ts
// packages/client/src/stores/race.ts
applyCursor(playerId: string, target: number, serverAt: number) {
  const now = performance.now();
  const localArrival = now + NETWORK_LATENCY_MS; // constant estimate
  // queue: { from, to, departAt, arriveAt }
  this.cursors[playerId] = { from: this.cursors[playerId]?.to ?? target, to: target, departAt: localArrival - 100, arriveAt: localArrival };
}
```

Each rAF tick: `lerp(from, to, clamp((now - departAt) / (arriveAt - departAt), 0, 1))`. 100 ms of interpolation buffer hides 99% of jitter. No need for GSAP, no need for `react-spring`. The math is 5 lines.

---

## Bundled passage corpus

**Decision:** `passages.json` in `packages/server/src/`, ~80 strings, 30–60 words each, public-domain.

- Read at boot: `import passages from "./passages.json"` (Bun's bundler inlines JSON).
- Pick per race: `passages[Math.floor(Math.random() * passages.length)]` on the host's "start" action.
- Why bundled vs API: zero runtime dep, works offline (matters for FDE laptop demo on a hotel WiFi), instant pick. Sources: Project Gutenberg short stories, poetry out of copyright (pre-1928 for US).

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|---|---|---|
| **Bun + Hono** | Node + Fastify + `ws` | If the team is more fluent with Node and Bun's Node-compat has gaps for the chosen library. Not our case — Bun 1.3 is production-stable and the gap is shrinking. |
| **Bun + Hono** | Deno + Hono | If deploying to Deno Deploy or if the team standardised on Deno. Not us — Fly.io is the deploy target. |
| **`Bun.serve({ fetch, websocket })` native** | Hono's `upgradeWebSocket` helper | If we need to **port the same code to Deno, Workers, or any non-Bun runtime without changes**. That portability is real value — but v1 ships on Bun, and native is faster + gives us `ws.data` typing. Revisit at "multi-runtime" requirement. |
| **`Bun.serve({ fetch, websocket })` native** | Socket.IO 4 + `@socket.io/bun-engine` | If we need rooms, broadcasts, reconnection-with-state, and zero protocol work. But Socket.IO's Bun adapter is still v0.1.x with known rough edges, and the resume bullet explicitly calls out "WebSocket rooms" — using raw WS demonstrates we wrote the protocol. For v1 simplicity wins. **For v2**, if we add chat or presence features, re-evaluate Socket.IO. |
| **Vite 8 + `@vitejs/plugin-react` v6** | Vite 7 + plugin-react v5 (Babel form) | Only if a third-party Babel plugin is unavoidable. We don't need any. |
| **Vite 8** | Next.js / Remix / TanStack Start | If we wanted SSR, file-based routing, server actions. We don't — the spec is a SPA with WS as the data plane. SSR would also fight the WS-first architecture. |
| **Vite 8 + React 19 + Zustand** | Same stack + React Compiler from day 1 | If we know cursor-render cost is the bottleneck before measuring. **Measure first.** Enabling the Compiler is a one-line config change; do it after the v1 demo works. |
| **React Router 8** | `wouter` | React Router 8 is fine and matches React 19 peers, but the spec doesn't need multi-page routing — `<LandingScreen/>`, `<LobbyScreen/>`, `<RaceScreen/>` is enough. **Use `wouter`** if we want a tiny router for `/r/:code` deep-linking; **use nothing** if we just read `window.location.pathname` and dispatch. |
| **`wouter` / no-router** | TanStack Router | Type-safe routing. Overkill for 2 routes. |
| **Zustand 5** | Redux Toolkit, Jotai | Redux if the team already knows Redux Toolkit and we want RTK Query for the future REST surface. Jotai for atom-fan-out (e.g. many independent passage words). Zustand is the lowest-boilerplate fit for our store sizes. |
| **Zod 4** | Valibot 1, TypeBox, ArkType | Valibot is smaller (good for bundle size if we shipped Zod to the client). **We ship Zod to the client** because it's the schema-validation contract shared with the server — picking different libs on each side re-introduces the drift problem. TypeBox is fastest to compile but ecosystem is thinner. **Zod 4 it is** (smaller than v3, faster, native JSON Schema export). |
| **`@hono/zod-validator`** | Custom middleware | Custom if we need a feature `z-validator` doesn't expose. It exposes everything we need. |
| **`nanoid` with custom alphabet** | `crypto.randomUUID()` | UUID is 36 chars, too long for a verbal share code. `nanoid` with a 32-symbol alphabet is the right tool. |
| **`pino`** | `console.log`, `bunyan`, `winston` | `console.log` is fine for first cut, but Pino's JSON output is what Fly's log shipper expects and `pino-pretty` makes dev readable. No reason to reach for bunyan/winston in 2026. |
| **In-memory `Map`** | Redis / KV (Upstash, Fly's Redis) | If/when we scale to >1 Fly Machine, or want rooms to survive restarts. Spec says no. |
| **`happy-dom` for tests** | `jsdom` | happy-dom is ~3× faster; we don't need jsdom's full CSS engine. |
| **Tailwind v4 (deferred)** | Plain CSS / CSS Modules / vanilla-extract | Tailwind v4 + `@tailwindcss/vite` is great for a 2-weekend demo. **Defer the decision to the UI phase** — STACK only commits to the runtime; styling is a UI concern. Listed as a "not yet" rather than "use." |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|---|---|---|
| **Socket.IO 4** for v1 | `@socket.io/bun-engine` is still 0.1.x with known reconnect/time-out rough edges; resume bullet reads better with raw WS anyway; we don't need Socket.IO's room abstraction (`Map<roomCode, Set<ws>>` is 10 lines). | Native `Bun.serve({ fetch, websocket })` — write the 10 lines. |
| **`hono/helper/websocket`'s `upgradeWebSocket`** | It's a portability shim that hides Bun's typed `ws.data` and direct control of `maxPayloadLength`/`backpressureLimit`. We deploy only on Bun. | Native `server.upgrade(req, { data })` inside `Bun.serve.fetch`. |
| **React Router 8 / TanStack Router** | Adds SSR-adjacent abstractions for an SPA that has one screen flow and one URL pattern (`/r/:code`). | `wouter` if we need a router, or `window.location.pathname` if we don't. |
| **Next.js / Remix / TanStack Start** | SSR frameworks are opinionated about HTTP routing and request/response lifecycles; our data plane is a WS connection, not HTTP. The whole "fetch data on the server, hydrate on the client" model is the wrong shape for realtime. | Vite + React 19 SPA + native `WebSocket`. |
| **Redux / Redux Toolkit** | Boilerplate-to-value ratio is wrong for ~5 store fields. | Zustand 5. |
| **Valibot / TypeBox / ArkType** on the client | Different validator on each side re-introduces wire-schema drift — the exact bug we set out to prevent. | Zod 4 on both sides, types via `z.infer<>`. |
| **Express / Fastify / Koa** | Hono is the modern choice on Bun/Node/Deno/Workers; using Express means we lose Bun-native perf and the unified runtime story. | Hono 4. |
| **`ws` package (npm)** | It's the Node polyfill. Bun has native WebSocket server. | `Bun.serve({ websocket })`. |
| **`tsx` / `ts-node` for the server** | Bun runs TypeScript natively — no transpiler in the loop. | `bun run src/server.ts`. |
| **Redis / Upstash / Fly Redis** | Spec calls for in-memory; adding Redis means more config, more deploy steps, more free-tier dance, and the demo's "vanish on restart" honesty is actually a feature for v1. | A `Map<string, Room>`. |
| **`ulidx` / `uuid` for room codes** | 26/36 chars, way over the 6-char share-code budget. | `nanoid` with a 32-symbol custom alphabet, length 6. |
| **Time-sync libraries (`timesync`, `ntp-client`, `chrony`)** | We don't sync clocks — we make the server the only clock that matters. Server timestamps every keystroke on accept; client clock is purely cosmetic. | Server `Date.now()` for everything authoritative; `performance.now()` for animation only. |
| **Cursor interpolation libs (`gsap`, `react-spring`, `framer-motion`)** | We need ~5 lines of linear interpolation in one rAF loop, not a full animation framework. | A `useEffect` with `requestAnimationFrame` and `Math.max(0, Math.min(1, t))` lerp. |
| **React Compiler 1.0 from day 1** | oxc-transform-react is new in 2026, ESLint plugin surface is still settling, and our render-cost hotspot is one component. Measure first. | Plain React 19 + Zustand selectors. Flip `react({ compiler: true })` in `vite.config.ts` after the demo works and we see the bottleneck in DevTools. |
| **Tailwind v4 (premature)** | STACK should not commit styling in the stack-research phase — let the UI phase pick. Listed as a known option, not a chosen one. | (TBD by UI phase.) |
| **Class components / `create-react-class`** | React 19 deprecated them; no benefit. | Function components + hooks. |
| **PropTypes** | We have TypeScript end-to-end. | TypeScript interfaces + Zod schemas at the boundary. |
| **A separate test runner (Jest, Mocha)** | Bun ships `bun test`, fast, JSDOM/happy-dom compatible, no extra config. | `bun test` for unit; vitest for component tests if we want Vite's transform pipeline, otherwise `bun test` + `@testing-library/react` works fine. |
| **A custom Dockerfile / hand-written nginx** | Bun + Hono + Bun-native static file serving covers the whole stack in one process. One container, one port, one URL. | Multi-stage Dockerfile shown above; no reverse proxy. |
| **Auto-scaling based on WS count** | Free tier is single-machine; `min_machines_running = 0` already gives scale-to-zero for HTTP. WebSocket-aware scaling is a Fly.io feature request, not stock. | Single machine with `auto_stop_machines = "stop"`. Plan a migration when we outgrow 256 MB. |

---

## Stack Patterns by Variant

**If you ship the demo before the React Compiler is stable on Vite 8 + oxc-transform-react:**
- Drop `react({ compiler: true })` from `vite.config.ts`.
- Keep the rest of the stack identical — the Compiler is additive, not load-bearing.

**If you want to defer the second cursor interpolation pass:**
- A `setInterval` at 33 ms with linear lerp is fine as a v1. The rAF + 100 ms buffer variant above is the v2 polish.

**If you want SSR later (e.g. for SEO of a landing page):**
- Add `@hono/node-server` or run the same Hono app on `@hono/vercel-edge`. Keep the WS portion on Bun.
- Don't switch the SPA to Next.js — the WS connection model fights SSR hydration.

**If you ever run >1 Fly Machine:**
- Move `rooms` from `Map` to a shared KV (Fly's Upstash Redis is the natural fit on Fly.io).
- Add a `@socket.io/redis-adapter`-equivalent hand-rolled pub/sub over Redis for cross-machine room broadcasts (or migrate to Socket.IO at that point).
- Re-evaluate WebSocket scaling patterns; `concurrency.type = "connections"` no longer holds.

**If the demo venue has bad WiFi:**
- Increase the client-side cursor interpolation buffer to 200–300 ms. Already the cheapest knob in the system.
- Lower the WS ping interval (Bun's default `sendPings: true` is good; tune `idleTimeout` if you see drops).
- Anti-cheat rate-limit thresholds are network-sensitive — tune per real telemetry, not on the laptop.

---

## Version Compatibility

| Package A | Compatible With | Notes |
|---|---|---|
| `vite@8.2.x` | `@vitejs/plugin-react@6.1.1` | Hard peer: `vite ^8.0.0`. plugin-react v6 uses oxc; do not pass `babel: { plugins: [...] }` — that API was removed in v6. |
| `@vitejs/plugin-react@6.1.1` | `oxc-transform-react@0.145+` (optional, only for React Compiler) | If omitted, plugin runs JSX + Fast Refresh only; Compiler is opt-in via `react({ compiler: true })`. |
| `@vitejs/plugin-react@6.1.1` | `@rolldown/plugin-babel@^0.2.x` + `babel-plugin-react-compiler@^1.0.0` (alternative Babel path) | Skip unless a downstream Babel plugin is required. |
| `hono@4.13.x` | `@hono/zod-validator@0.9.0` (peer `hono >=4.11.2`, `zod ^3.25 \|\| ^4`) | Tested together — works. |
| `zod@4.5.4` | All Hono / React libs in this stack | Zod 4 is a major rewrite from v3; if any sub-dep imports `zod@3`, pin explicitly to v4 in the workspace root. |
| `zustand@5.0.15` | `react@^18 \|\| ^19`, `@types/react >=18`, `use-sync-external-store >=1.2` | Built-in shim for React 18+; React 19 native `useSyncExternalStore` is used. |
| `nanoid@6.0.1` | Bun, Node ≥18, browsers | ESM-first; v6 requires Node 18+. |
| `bun@1.3.x` | `Bun.serve({ websocket })` typed `data` | Available since Bun 1.1.40. |
| `react@19.2.x` | `react-dom@19.2.x`, `react-router@8.3.x`, `wouter@3.10.x`, `@testing-library/react@16.3.x` | React 19 is the floor for some peers. If you must stay on 18, swap to `@testing-library/react@15.x`. |
| `typescript@7.0.2` | `zod@4`, `valibot@1` (peer `typescript >=5`), everything else | TS 7 is the current major. |
| `vitest@4.x` | `vite@6 \|\| 7 \|\| 8`, `@testing-library/jest-dom@7` | Pair with `happy-dom@20` for test env. |
| `pino@10.x` | `pino-pretty@13.x` | The 10/13 pair is the working combo as of 2026-08. |
| `@types/bun@1.4.x` | `bun@1.3.x` | Track Bun's runtime version. |
| `oven/bun:1.3.x-slim` (Docker) | Fly.io builders, multiarch linux/amd64 (Fly's free tier is amd64) | Pin exact patch version in `BUN_VERSION` arg to avoid surprise breaks on `1.3.x` rolling forward. |

### Known gotchas

- **`@vitejs/plugin-react` v6 dropped the `babel: { plugins: [...] }` option.** Anything you read in pre-2026 tutorials that says `react({ babel: { plugins: ['babel-plugin-react-compiler'] } })` will silently do nothing on Vite 8 / plugin v6. Either move to `react({ compiler: true })` + `oxc-transform-react`, or fall back to `@rolldown/plugin-babel` + `reactCompilerPreset()`.
- **`auto_stop_machines`** takes the string `"stop"` (or `"suspend"` / `"off"`) — **not** the boolean `true` you'll see in older Fly.io blog posts.
- **`fly.toml`'s `[http_service.checks]`** does not follow 301/302 redirects. `/health` must return 200 directly.
- **Bun's `Bun.serve` binds to `0.0.0.0` by default — required for Fly's private network** to reach the Machine. Don't override to `127.0.0.1`.
- **Zod 4's API differs from Zod 3 in subtle ways** (e.g. `z.string().email()` shape, error formatting). Lock to `zod@4.5.4` across the workspace and don't mix v3 docs.

---

## Sources

- `/oven-sh/bun` Context7 — `Bun.serve({ fetch, websocket })`, typed `data`, `server.upgrade`, static + SPA routing via `routes` or `Bun.file`. Topics: WebSocket server, serve static files, fullstack HTML import.
- `/honojs/hono` Context7 — `upgradeWebSocket` helper, Bun adapter (no adapter package needed). Topics: WebSocket helper, Bun runtime adapter.
- `/vitejs/vite` Context7 — React + TypeScript template, `defineConfig`, production build. Topics: vite.config.ts template, build for production.
- `/vitejs/vite-plugin-react` GitHub README (npm: `@vitejs/plugin-react` v6.1.1) — `compiler: true` option with `oxc-transform-react` peer, Babel fallback via `@rolldown/plugin-babel`. Topics: React Compiler integration.
- `/pmndrs/zustand` Context7 — store API, selector subscriptions, React 19 compat. Topics: state-management.
- npm registry (`https://registry.npmjs.org/<pkg>/latest`) — version pinning for all 30+ packages listed above. Verified 2026-08-30.
- nerdleveltech.com — *Deploy Bun + Hono on Fly.io: 2026 Production Guide* (May 2026). Topics: Dockerfile, `fly.toml` fields, `auto_stop_machines` semantics, graceful shutdown, health checks.
- `meetdave3/remix-hono-on-bun` reference repo — single-process Bun + Hono + frontend pattern on Fly.io. Topics: shared-cpu-1x / 256 MB footprint, `fly launch` workflow.
- `oven-sh/bun` docs — `docs/bundler/fullstack.mdx`, `docs/runtime/http/websockets.mdx`, `docs/bundler/html-static.mdx`. Topics: native WS server, fullstack HTML, SPA fallback.
- Recca0120 blog (Apr 2026) — *React Compiler 1.0 + Vite 8: The Right Way to Install*. Topics: plugin-react v6 ordering, oxc vs Babel compiler paths, gotchas with old tutorials.

---

*Stack research for: realtime multiplayer browser game (Vite + React + TS frontend, Bun + Hono backend, shared TS types, Fly.io single-process deploy, in-memory rooms, server-authoritative input validation, best-effort anti-cheat)*
*Researched: 2026-08-30 by gsd-ns-context / stack-research subagent*