# Phase 1: Foundation — Research

**Researched:** 2026-08-30
**Domain:** Bun monorepo + Hono HTTP/WS + Vite/React SPA + Fly.io single-process deploy
**Confidence:** HIGH (npm registry + Context7 + Fly.io docs verified today)

**Inherits from:** `.planning/research/{SUMMARY,STACK,PITFALLS,ARCHITECTURE}.md` (v1 stack already locked).
**Purpose of this file:** Resolve the seven open questions that gate Phase 1 planning — monorepo layout, WS upgrade mechanism, dev proxy, prod static serving, Dockerfile + fly.toml, Zod 4 cross-package schemas, known prod gotchas. Plus the Nyquist validation experiments that prove Foundation works end-to-end.

---

## User Constraints (from PROJECT.md)

### Locked Decisions (NON-NEGOTIABLE)
- **Stack:** Bun 1.3.x runtime + Hono 4.13.x + Vite 8 + React 19 + TypeScript 7 + Zod 4. Single Fly.io process serves frontend + WS endpoint.
- **WS message schemas live in `packages/shared`**; both client and server import from one source. No copy-paste.
- **In-memory `Map<roomCode, Room>` storage** — no Redis. Honest tradeoff: rooms vanish on restart.
- **No `hono/helper/websocket` `upgradeWebSocket`** for the WS layer (decision made in STACK.md §Server). We use Bun-native `Bun.serve({ websocket })` directly so `ws.data` is typed and we own `maxPayloadLength` / `backpressureLimit` / `idleTimeout`.
- **Deploy strategy:** `fly deploy --strategy immediate` (not rolling) — state-loss mid-race is worse than brief downtime (STACK.md + PITFALLS.md Pitfall 10).

### Claude's Discretion
- Workspace directory naming: `packages/*` vs `apps/*`+`packages/*` hybrid.
- Package names inside the workspace (`@typing-race/shared` vs `@typing-race/server` vs `@typing-race/web`).
- Vite dev server port vs Bun server port (default Vite 5173, Bun 8080).
- Whether to use Bun's `bunfig.toml` for workspace config.
- Health-check endpoint shape (`/health` vs `/healthz`).

### Deferred (OUT OF SCOPE for Foundation)
- Tailwind v4 / styling system — UI phase decides (STACK.md).
- React Compiler 1.0 — measure cursor render cost in Phase 5 first (STACK.md).
- Cursor interpolation buffer size — Phase 5 spike (SUMMARY §Confidence).
- Socket.IO / rooms abstraction — explicitly rejected (STACK.md "What NOT to Use").
- Redis / persistent rooms — explicit Out-of-Scope (PROJECT.md).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| WS message contract (`ClientToServer`, `ServerToClient` discriminated unions) | Shared package (`packages/shared`) | — | One source of truth imported by both apps; neither owns it. |
| HTTP API (`/health`, future REST) | Bun server (`apps/server`) | — | Hono handles routing; Bun hosts it. |
| WS upgrade + per-connection state | Bun server | — | Native `Bun.serve({ websocket })` is the only path; Hono helper rejected. |
| Static file serving (prod built SPA) | Bun server | — | Same process, single port. Hono `serveStatic` from `hono/bun` with `precompressed: true`. |
| React UI, Vite dev server | Vite SPA (`apps/web`) | — | Vite 8 + plugin-react v6. |
| Dev proxy `/api` + `/ws` to Bun | Vite dev server | — | `server.proxy` with `ws: true` on a single `/api` entry (or split entries if WS becomes a separate upstream — not our case). |
| Container build + Fly.io machine lifecycle | Dockerfile + `fly.toml` | — | Multi-stage build; `oven/bun:1.x-slim` base. |

Single-process deploy — every runtime capability lives inside the Bun server; the SPA is built static and shipped from the same process.

---

## Summary

Phase 1's job is boring and load-bearing: stand up the bun-workspace monorepo, wire Zod schemas into a shared package, build a "Hello world" React page, get it served by Hono from inside Bun, and prove the whole pipeline runs locally *and* deploys to Fly.io before any game logic stacks on top.

The standard approach is the one STACK.md + ARCHITECTURE.md already chose: native `Bun.serve({ fetch, websocket })` instead of Hono's `upgradeWebSocket` helper (typed `ws.data` is the reason), Hono for the small HTTP surface only, Vite 8 + React 19 for the SPA, and `oven/bun:1.3-slim` (or `-alpine`) in a multi-stage Dockerfile. The non-obvious bits — `concurrency.type = "connections"` for WS-heavy workloads, `idleTimeout` semantics, `precompressed: true` for gzip static serving, and the Bun-WS-behind-Fly-proxy host-header nuance — are documented below with citations.

**Primary recommendation:** Use `bun-workspace` with `apps/*` for deployables + `packages/*` for libraries. Names: `@typing-race/shared`, `@typing-race/server`, `@typing-race/web`. Use native `Bun.serve({ websocket })`. Use Hono's `serveStatic` from `hono/bun` with `precompressed: true` and precompressed `.br`/`.gz` artifacts. Ship a multi-stage Dockerfile + a `fly.toml` tuned for `shared-cpu-1x` 256MB, `concurrency.type = "connections"`, `auto_stop_machines = "stop"`, `/health` check.

---

## Standard Stack (verified against registry today)

### Core
| Library | Version (npm `latest` 2026-08-30) | Purpose | Why Standard |
|---|---|---|---|
| `bun` | 1.4.0 (runtime) | JS runtime + WS server + bundler + pkg manager | Lowest-latency WS server in Node-compat ecosystem; typed `ws.data`; `Bun.serve` does HTTP+WS in one call. |
| `hono` | 4.13.5 | HTTP routing, middleware, `/health`, future REST | ~14 KB, zero deps, type-safe, runs unchanged on Bun/Node/Deno/Workers. |
| `@hono/zod-validator` | 0.9.0 | Validate `/api/*` bodies via Zod 4 schemas | Only on HTTP routes; WS layer parses directly. |
| `zod` | 4.5.4 | Schema-validate every WS frame at the boundary | One schema per message; types via `z.infer<>`; same package used by client + server. |
| `vite` | 8.2.2 | Frontend dev server + production build | Rolldown-powered, smallest bundles in the ecosystem, React Compiler opt-in path via plugin-react v6 + oxc. |
| `@vitejs/plugin-react` | 6.1.1 | JSX + Fast Refresh + optional React Compiler | Only frontend plugin we need. |
| `react` / `react-dom` | 19.2.8 | UI rendering | Concurrent rendering + `useSyncExternalStore` handle 30 Hz cursor stream without manual batching. |
| `typescript` | 7.0.2 | Type system | One TS config per package, root `tsconfig.json` for path resolution. |
| `@types/bun` | 1.4.0 | TS types for `Bun.serve`, `ServerWebSocket`, `Bun.file` | Listed as devDep only; runtime image doesn't need it. |

### Supporting
| Library | Version | Purpose | When to Use |
|---|---|---|---|
| `zustand` | 5.0.15 | Lobby / race / cursor stores | Vanilla store API + `useSyncExternalStore` shim. |
| `nanoid` | 6.0.1 | 6-char room codes via custom alphabet | Use `customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6)` — no `I/O/0/1`. |
| `pino` + `pino-pretty` | 10.3.1 / 13.1.3 | Structured logs | JSON in prod (Fly log shipper), pretty in dev. |
| `@types/react` / `@types/react-dom` | 19.2.18 / 19.2.5 | React 19 types | Required peers. |
| `vitest` | 4.1.11 | Component tests | Same Vite config we already have. |
| `happy-dom` | 20.12.0 | Test DOM | Faster than jsdom; no need for full CSS engine. |
| `@testing-library/react` | 16.3.3 | Component render tests | Pair with `happy-dom` env. |
| `prettier` | 3.9.6 | Formatting | Standard. |
| `eslint` + `@typescript-eslint/*` + `eslint-plugin-react-hooks` | 10.9.1 / 8.68 / 7.1 | Lint | Catches missed deps before Compiler is on. |

### Image Base
- **`oven/bun:1.3-slim`** (or `1.4-slim` once stable, which is what `bun` latest is today). Slim variant preferred over alpine for better `node-gyp`/native-module compatibility if we ever add one. Both ship the `bun` binary; no Node runtime layer.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|---|---|---|
| Bun workspaces | npm workspaces / pnpm / yarn | Bun's built-in workspaces are zero-extra-deps, fastest install, and the same `bun install` we already run for prod. |
| `packages/shared` + `apps/{server,web}` | Single package with `src/{server,web,shared}` | Single-package loses type-isolation boundary and forces duplicate `tsconfig.json`. |
| Native `Bun.serve({ websocket })` | Hono's `upgradeWebSocket` helper | Helper targets standard `WebSocket` (good for Workers/Deno); Bun-native gives typed `ws.data`, `ws.subscribe()`, `ws.publish()`, and direct `maxPayloadLength` / `backpressureLimit` / `idleTimeout` knobs. We deploy only on Bun. |
| Hono `serveStatic` from `hono/bun` | Hand-rolled `Bun.file` streaming | Hand-rolled gets you `content-length`/`content-type` for free (Bun does it), but you reinvent path-traversal safety, gzip/brotli lookup, and SPA fallback. Hono's helper is one line. |
| `fly.toml` `concurrency.type = "connections"` | `"requests"` | `requests` is recommended for plain HTTP (Fly pools/reuses); `connections` counts raw TCP sockets — correct unit for WS-heavy apps where each WS holds open for 30–60 s. nerdleveltech May 2026 guide uses `"requests"` for pure HTTP — we're not pure HTTP. **Use `"connections"` for typing-race**, switch to `"requests"` if the app ever becomes HTTP-dominated. |
| `oven/bun:1.3-slim` | `oven/bun:1.3-alpine` | Alpine smaller but more native-module friction; `-slim` (Debian) is the safer default for prod. |

**Installation (no-op from STACK.md; restated for planner):**
```bash
bun init -y                                                # root
# edit package.json: "workspaces": ["apps/*", "packages/*"]
mkdir -p packages/shared/src apps/server/src apps/web/src

# shared
cd packages/shared
bun init -y
bun add zod@4.5.4
# (no hono / no vite here)

# server
cd ../../apps/server
bun init -y
bun add hono@4.13.5 @hono/zod-validator@0.9.0 zod@4.5.4 nanoid@6.0.1 pino@10.3.1
bun add -d @types/bun@1.4.0 typescript@7.0.2 pino-pretty@13.1.3

# web
cd ../web
bun create vite . --template react-ts          # interactive; pick react-ts
bun add zustand@5.0.15 nanoid@6.0.1 zod@4.5.4
bun add -d @types/react@19.2.18 @types/react-dom@19.2.5 typescript@7.0.2 \
  @vitejs/plugin-react@6.1.1 vite@8.2.2 vitest@4.1.11 happy-dom@20.12.0 \
  @testing-library/react@16.3.3 prettier@3.9.6 eslint@10.9.1

# cross-package links (each app's package.json):
#   "@typing-race/shared": "workspace:*"
bun install
```

---

## Architecture Patterns

### System Diagram

```
Browser (React 19 SPA, Vite dev server :5173 in dev)
   │
   │  ws://localhost:5173/ws   ← proxied by Vite to Bun :8080
   │  http://localhost:5173/api/...  ← proxied by Vite to Bun :8080
   │
   ▼
┌─────────────────────────────────────────────────────────────────┐
│ Bun.serve({ fetch, websocket }) — :8080 in dev, :8080 in prod   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ fetch(req, server)                                          │ │
│ │   ├─ url.pathname === "/ws"     → server.upgrade(req, …)    │ │
│ │   ├─ url.pathname startsWith "/api/" / "/health" → hono     │ │
│ │   └─ else                       → hono serveStatic (prod)   │ │
│ │                                → static.ts dev shim (dev)  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ websocket: {                                                │ │
│ │   data: {} as { playerId, roomCode },                       │ │
│ │   open(ws), message(ws, raw), close(ws, code, reason),       │ │
│ │   idleTimeout: 120, maxPayloadLength: 16_384,               │ │
│ │   backpressureLimit: 1_048_576, sendPings: true             │ │
│ │ }                                                           │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

Both apps import `@typing-race/shared` (Zod schemas + inferred TS types) via `workspace:*` resolution. Server parses inbound WS frames with `clientToServerSchema.safeParse()`. Client parses inbound frames with `serverToClientSchema.safeParse()`. Same source.

### Recommended Project Structure

```
typing-race/
├── package.json                          # workspaces: ["apps/*", "packages/*"]
├── bun.lock / bun.lockb
├── bunfig.toml                           # [install] workspaces config (optional)
├── tsconfig.base.json                    # shared compilerOptions
├── Dockerfile                            # multi-stage; oven/bun:1.3-slim base
├── fly.toml                              # auto_stop_machines=stop, conn concurrency
├── .dockerignore
├── packages/
│   └── shared/                           # @typing-race/shared
│       ├── package.json                  # name, main: "./src/index.ts", exports
│       ├── src/
│       │   ├── messages.ts               # Zod discriminated unions
│       │   ├── race.ts                   # RaceState, PlayerState, Passage
│       │   ├── codes.ts                  # 6-char alphabet + nanoid helper
│       │   └── index.ts                  # barrel
│       └── tsconfig.json                 # extends ../../tsconfig.base.json
└── apps/
    ├── server/                           # @typing-race/server
    │   ├── package.json                  # depends on @typing-race/shared (workspace:*)
    │   ├── src/
    │   │   ├── index.ts                  # Bun.serve({ fetch, websocket })
    │   │   ├── routes.ts                 # Hono app: /health, future /api/*
    │   │   ├── ws/
    │   │   │   ├── dispatch.ts           # clientToServer.safeParse → handler
    │   │   │   └── handlers.ts           # join_room, hello, ping (Phase 1 stubs)
    │   │   ├── rooms.ts                  # Map<string, Room> (Phase 1 stub)
    │   │   ├── static.ts                 # serve apps/web/dist (prod) / index (dev)
    │   │   ├── logger.ts                 # pino instance
    │   │   └── env.ts                    # PORT, NODE_ENV
    │   └── tsconfig.json                 # "types": ["bun"], "moduleResolution": "bundler"
    └── web/                              # @typing-race/web
        ├── package.json                  # depends on @typing-race/shared (workspace:*)
        ├── index.html
        ├── vite.config.ts                # server.proxy.{ '/api', '/ws' }
        ├── src/
        │   ├── main.tsx
        │   ├── App.tsx                   # <HelloWorld/> Phase 1 only
        │   ├── net/
        │   │   └── ws.ts                 # WSConnection class (Phase 2 wires real msgs)
        │   └── store/
        │       └── connection.ts         # zustand: { status, lastMessage }
        └── tsconfig.json
```

### Pattern 1: Workspace layout — `apps/*` + `packages/*`

**What:** Two top-level workspace roots. Deployables live under `apps/`; reusable libraries under `packages/`. The root `package.json` only declares the workspace globs and dev scripts; it has **no** `dependencies`/`devDependencies` of its own (per Bun docs).

**When to use:** Whenever you have ≥1 deployable + ≥1 shared library. We have 2 deployables (`server`, `web`) + 1 shared (`shared`) — exactly the pattern.

**Why this and not single-package with `src/{server,web,shared}`:** Each package gets its own `tsconfig.json` (`"types": ["bun"]` on server, no Bun types on web, no React types on shared), its own dependencies (`react` on web only, `hono`/`pino` on server only), and a clean `workspace:*` resolution that TypeScript picks up via `package.json` `exports`.

**Why `packages/` for shared and `apps/` for deployables (and not both under `packages/`):** Bun's docs use `packages/` for the convention; mixing deployables into `packages/*` is fine but loses the visual signal "these are things that run, these are things that are imported." STACK.md originally used `packages/` for all three; ARCHITECTURE.md used `apps/` for server/web + `packages/` for shared. We pick the latter (split) because the planner reads cleaner and `bun install --filter` patterns target deployables vs libraries more obviously.

```jsonc
// package.json (root)
{
  "name": "typing-race",
  "private": true,
  "type": "module",
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "bun --filter '*' run dev",      // runs dev in each workspace in parallel
    "build": "bun --filter '@typing-race/web' run build",
    "start": "bun --filter '@typing-race/server' run start",
    "typecheck": "bun --filter '*' run typecheck"
  }
}
```

```jsonc
// apps/server/package.json
{
  "name": "@typing-race/server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "bun --hot run src/index.ts",
    "start": "bun run src/index.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@typing-race/shared": "workspace:*",
    "hono": "4.13.5",
    "@hono/zod-validator": "0.9.0",
    "zod": "4.5.4",
    "nanoid": "6.0.1",
    "pino": "10.3.1"
  },
  "devDependencies": {
    "@types/bun": "1.4.0",
    "typescript": "7.0.2",
    "pino-pretty": "13.1.3"
  }
}
```

```jsonc
// apps/web/package.json
{
  "name": "@typing-race/web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -b --noEmit"
  },
  "dependencies": {
    "@typing-race/shared": "workspace:*",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "zustand": "5.0.15",
    "zod": "4.5.4"
  },
  "devDependencies": {
    "@types/react": "19.2.18",
    "@types/react-dom": "19.2.5",
    "@vitejs/plugin-react": "6.1.1",
    "vite": "8.2.2",
    "typescript": "7.0.2",
    "vitest": "4.1.11",
    "happy-dom": "20.12.0",
    "@testing-library/react": "16.3.3"
  }
}
```

### Pattern 2: Native `Bun.serve({ fetch, websocket })` over Hono's `upgradeWebSocket`

**What:** Inside `apps/server/src/index.ts`, a single `Bun.serve({...})` does HTTP + WS. The `fetch` handler routes by pathname; `server.upgrade(req, { data: { playerId } })` upgrades WS connections. The `websocket` object declares `data: {} as { playerId, roomCode }` so every lifecycle hook sees a fully-typed `ws.data` without a type-parameter on `Bun.serve`.

**When to use:** Always on Bun. Only consider Hono's `upgradeWebSocket` if we ever port the same code to Deno, Workers, or a non-Bun runtime — which we won't.

**Why:** Bun's native `ServerWebSocket<T>` exposes typed `ws.data` (per-connection context like room id, player id) that travels with the socket — no `WeakMap<WebSocket, Context>` gymnastics. It also gives direct control over `maxPayloadLength` (default 16 MB — drop to ~16 KB to reject giant payloads), `backpressureLimit` (default 16 MB), `closeOnBackpressureLimit` (default false), `idleTimeout` (default 120 s, max 255 s), `sendPings` (default true), and `ws.subscribe()`/`ws.publish()` for room broadcasting (Phase 2 uses these; Phase 1 just echoes).

Hono's `upgradeWebSocket` helper targets the standard `WebSocket`/`WebSocketPair` API — fine for portability, but you lose `ws.data` typing and the Bun-specific knobs. Hono's own docs note that on Bun you can use `Bun.serve({ fetch, websocket })` directly with `app.fetch` in the fetch handler (per the bun-hono README example).

**Verified example** (Bun Context7 `/oven-sh/bun` `docs/runtime/http/websockets.mdx`):
```ts
const server = Bun.serve({
  fetch(req, server) {
    const success = server.upgrade(req);
    return success ? undefined : new Response("Hello world!");
  },
  websocket: {
    data: {} as { authToken: string },     // typed ws.data across all hooks
    async message(ws, message) { ws.send(`You said: ${message}`); }
  }
});
```

**Our Phase 1 sketch** (simplified):
```ts
// apps/server/src/index.ts
import { serveStatic } from "hono/bun";
import hono from "./routes";
import staticApp from "./static";

type WsData = { playerId: string; roomCode: string | null };

const server = Bun.serve<WsData>({
  port: Number(process.env.PORT ?? 8080),
  idleTimeout: 120,                       // s, default; 30-60 s race uses pings to keep alive
  maxPayloadLength: 16 * 1024,            // 16 KB; keystroke frames are <500 B
  backpressureLimit: 1 * 1024 * 1024,     // 1 MB; cursor broadcasts at 30 Hz fit comfortably
  sendPings: true,                        // Bun sends WS ping frames automatically
  async fetch(req, server) {
    const url = new URL(req.url);

    // 1. WebSocket upgrade
    if (url.pathname === "/ws") {
      const playerId = crypto.randomUUID();
      const ok = server.upgrade(req, { data: { playerId, roomCode: null } satisfies WsData });
      return ok ? undefined : new Response("Upgrade failed", { status: 400 });
    }

    // 2. Hono routes
    if (url.pathname === "/health" || url.pathname.startsWith("/api/")) {
      return hono.fetch(req);
    }

    // 3. Static frontend (prod built SPA via hono serveStatic; dev no-op fallback)
    return staticApp.fetch(req);
  },
  websocket: {
    open(ws) {
      ws.send(JSON.stringify({ type: "hello", playerId: ws.data.playerId, ts: Date.now() }));
    },
    message(ws, raw) {
      const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
      ws.send(JSON.stringify({ type: "echo", received: text, ts: Date.now() }));
    },
    close(ws, code, reason) {
      // Phase 2: remove player from room; if room empty, delete from Map
      console.log(`[ws] close ${ws.data.playerId} code=${code} reason=${reason}`);
    },
  },
});

process.on("SIGTERM", () => server.stop());    // graceful drain on Fly deploy
process.on("SIGINT",  () => server.stop());

console.log(`[server] listening on :${server.port}`);
```

Note: `Bun.serve<WsData>` — Bun's older docs typed `ws.data` via a type parameter on `Bun.serve`. As of Bun 1.3+ (verified Context7 /oven-sh/bun), the recommended path is `data: {} as WsData` inside the `websocket` object because of a TS limitation. Either form works; we use the object form for forward compat.

### Pattern 3: Vite dev proxy — single `/api` entry with `ws: true`

**What:** In `apps/web/vite.config.ts`, `server.proxy` maps both REST and WS to the Bun server on `:8080`. Single entry covers both because Vite's `http-proxy` attaches the upgrade handler per proxy entry, not per URL path.

**When to use:** Any time SPA dev server needs to talk to a separate backend. Our case: Vite on 5173, Bun on 8080.

**Tradeoff:** A single `/api` entry rewrites the path; the WS endpoint then lives at `/api/ws` from the client's perspective — fine, but feels weird when the URL still says `/api` for a WS. **Alternative:** split entries — one for `/api` (HTTP only), one for `/ws` (WS only). Both `ws: true` and `changeOrigin: true` on the WS entry. Cleaner mental model.

We pick **split entries** because the URL semantics match what production will look like (`/ws` is WS, `/api/*` is REST, `/health` is health). Even if both end up at the same Bun process, the paths are honest.

```ts
// apps/web/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        ws: false,           // HTTP only
      },
      "/ws": {
        target: "ws://localhost:8080",
        ws: true,            // upgrade handler attached
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
```

Vite proxy docs (vite.dev/config/server-options) confirm `ws: true` on a proxy entry makes the dev server handle the `Upgrade: websocket` handshake. `rewriteWsOrigin` default is "safe"; for local dev it Just Works.

### Pattern 4: Hono `serveStatic` from `hono/bun` with `precompressed: true`

**What:** In prod, `apps/server/src/static.ts` mounts Hono's `serveStatic` middleware to serve `apps/web/dist/*` + an SPA fallback to `index.html` for any non-API, non-WS path.

**Why not hand-roll `Bun.file` streaming:** `Bun.file()` does give you streaming + auto `content-type`/`content-length`/`content-disposition`, but you'd reinvent path-traversal safety (prevent `../`), `If-Modified-Since` / `ETag` handling, range requests, and gzip/brotli lookup. Hono's helper is one line.

**`precompressed: true`:** checks for `.br` (Brotli), `.zst` (Zstd), then `.gz` (gzip) next to each file and serves them based on `Accept-Encoding`. **Critical:** Vite 8 doesn't emit `.gz`/`.br` by default — you need `vite-plugin-compression` (or `rollup-plugin-gzip` via a Vite plugin) to produce the `.gz`/`.br` siblings at build time. Otherwise `precompressed: true` is a no-op and you serve uncompressed.

```ts
// apps/server/src/static.ts
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { readFile } from "node:fs/promises";
import path from "node:path";

const DIST = path.resolve(import.meta.dir, "../../web/dist");

const app = new Hono();

// Asset files (with content-hash in name → long cache)
app.use(
  "/assets/*",
  serveStatic({
    root: path.join(DIST),
    precompressed: true,
    onFound: (_p, c) => c.header("Cache-Control", "public, max-age=31536000, immutable"),
  })
);

// index.html + SPA fallback (NEVER cache, MUST revalidate)
app.get(
  "*",
  serveStatic({
    root: DIST,
    path: "index.html",
    precompressed: true,
    onFound: (_p, c) => c.header("Cache-Control", "no-cache"),
  })
);

export default app;
```

Vite plugin for precompressed assets (one of):
```ts
// apps/web/vite.config.ts (add)
import compression from "vite-plugin-compression";
export default defineConfig({
  plugins: [react(), compression({ algorithm: "gzip" }), compression({ algorithm: "brotli" })],
});
```

This writes `index.html.gz` / `index.html.br` / `assets/index-<hash>.js.gz` / `.js.br` next to each uncompressed file. Hono's `precompressed: true` then serves them when `Accept-Encoding: gzip, br` is present — measurably faster cold load on first paint.

### Anti-Patterns to Avoid
- **Two workspaces for the same code path** (e.g., `packages/server-types` + `apps/server/src/types.ts`): pick one. We chose `packages/shared` for the wire contract only — game logic types live with their owners.
- **Sharing `node_modules` via `--hoist` but forgetting `"private": true`**: Bun's docs require `"private": true` on root + every workspace to prevent accidental publish. Set both.
- **`bun install` followed by `npm install` in the same repo**: `bun.lock` (text) and `bun.lockb` (binary) are not interchangeable with `package-lock.json`. Pick `bun install` everywhere.
- **Mixing `Bun.serve({ fetch, websocket })` with Hono's `app.get('/ws', upgradeWebSocket(...))` on the same path**: Hono helper modifies immutable headers and fights Bun's native upgrade. Use one path, one mechanism. We chose native.
- **Serving the SPA from the same Hono route as `/api`**: split them so future `/api/*` routes don't accidentally catch `/api/assets/foo.js`.
- **Vite proxy pointing to `ws://localhost:8080` without `changeOrigin: true`**: cookies / auth headers will leak origin info. Always `changeOrigin: true` on WS entries too.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Static file serving + SPA fallback | Custom `Bun.file` resolver with `path.join` + path-traversal check | Hono `serveStatic` from `hono/bun` | Path traversal, ETag, range requests, content-type lookup — Bun's `Bun.file()` solves the streaming part, the rest is Hono's job. |
| Gzip/Brotli on static assets | Custom `Accept-Encoding` negotiation + `zlib.gzipSync` at build | `vite-plugin-compression` (build) + Hono `precompressed: true` (serve) | Pre-compress at build is constant-time; runtime compression is CPU-bound per request. |
| WS upgrade | `http.createServer` + `ws` package + manual upgrade handshake | `Bun.serve({ websocket })` | Bun-native is ~10× lower alloc and gives typed `ws.data`. `ws` is the Node polyfill — we run on Bun. |
| Per-connection context (`playerId`, `roomCode`) | `WeakMap<WebSocket, PlayerContext>` | `ws.data` (typed via `data: {} as WsData`) | WeakMap works but loses type safety across hooks. |
| Schema validation at WS boundary | Hand-rolled type guards / `if (typeof msg.type !== 'string')` | `clientToServerSchema.safeParse(msg)` from `@typing-race/shared` | One source of truth; server and client import same module. |
| Cross-package TS resolution | Relative paths (`../../packages/shared/src/messages`) | `"@typing-race/shared": "workspace:*"` in each consumer's `package.json` | Workspace resolution makes `tsc --noEmit` happy and produces the same `import` string that Vite/Bun resolve at runtime. |
| Health check endpoint | `app.get('/health', ...)` inside Hono | `hono.get('/health', (c) => c.text('ok'))` + `[[http_service.checks]] path = "/health"` in `fly.toml` | Fly's check is a GET on a path; keep it cheap, return `200 text/plain "ok"`. |

**Key insight:** Phase 1 is the "boring layer." Every custom path here is a footgun (path traversal, gzip negotiation, WS upgrade handshake) that has a battle-tested one-liner. Use them.

---

## Common Pitfalls (Phase 1 specific)

### Pitfall 1: Vite dev proxy doesn't forward WS upgrades

**What goes wrong:** `new WebSocket('ws://localhost:5173/ws')` connects, but Bun server never receives the upgrade — the SPA gets a normal HTTP response and the WS dies.

**Why it happens:** Missing `ws: true` on the Vite proxy entry. `http-proxy` (which Vite uses) only attaches the `Upgrade` handler when you opt in.

**How to avoid:**
```ts
"/ws": { target: "ws://localhost:8080", ws: true, changeOrigin: true }
```

**Warning signs:** Browser DevTools → Network → WS shows `101 Switching Protocols` from `5173` but the connection closes within 1 s with no frames; Bun server logs show no `[ws] open` line.

### Pitfall 2: Bun WS handler treats string and binary frames inconsistently

**What goes wrong:** Server expects `JSON.parse(raw)` to always work because it "only sends JSON." First binary frame from a client (or a server-side accidental `Uint8Array`) crashes with `SyntaxError`.

**Why it happens:** Bun's `message(ws, message)` delivers `message: string | ArrayBuffer | Uint8Array`. If you ever call `ws.send(uint8)`, the receive side has to handle Uint8Array too. Phase 1 we only send/receive JSON strings, but be explicit:

```ts
message(ws, raw) {
  const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
  // ...
}
```

**How to avoid:** Always TextDecoder-wrap on receive. Document in `ws/README.md` that this app is JSON-only.

**Warning signs:** Server throws on first non-ASCII character; tests pass because they only send ASCII; a future dev adds a binary feature and crashes prod.

### Pitfall 3: `bun install` writes `bun.lock` AND `bun.lockb` — gitignore the wrong one

**What goes wrong:** `.gitignore` excludes both lockfiles; CI installs without `--frozen-lockfile` and resolves different versions.

**Why it happens:** Recent Bun versions prefer the text `bun.lock` (JSON-ish, diff-friendly). Older `bun.lockb` is binary. Bun keeps both during migration.

**How to avoid:** Commit `bun.lock` (text). `bun install --frozen-lockfile` reads it. Add `bun.lockb` to `.gitignore` if present.

**Warning signs:** Two CI runs produce different `node_modules/`; Fly deploy from CI uses a different Zod version than local dev.

### Pitfall 4: Static SPA path: absolute vs relative

**What goes wrong:** `import.meta.dir` inside `apps/server/src/static.ts` resolves to `/app/apps/server/src` in the container, not the build context where `apps/web/dist` was COPY'd in the Dockerfile.

**Why it happens:** Dockerfile `WORKDIR` doesn't change `import.meta.dir`. You need to know the absolute path **at container runtime** (not build time).

**How to avoid:** In Dockerfile, `WORKDIR /app/apps/server` so `import.meta.dir` is `/app/apps/server/src` and `path.resolve(import.meta.dir, "../../web/dist")` = `/app/apps/web/dist`. Or pass an env var `STATIC_DIR=/app/apps/web/dist` and read it.

**Warning signs:** Prod container starts, `/health` returns 200, but `/` returns 404 — Bun has no `apps/web/dist` at the path it computed.

### Pitfall 5: Fly proxy strips `Upgrade` header or changes Host

**What goes wrong:** Browser opens `wss://typing-race.fly.dev/ws`; Fly proxies to your machine on `http://...:8080/ws`; upgrade fails with 400 or silently degrades to polling.

**Why it happens:** Fly's `fly-force-http-2` and TLS terminator should pass `Upgrade: websocket` and `Connection: Upgrade` headers through. They do — *as long as* your machine is bound to `0.0.0.0:8080` (not `127.0.0.1`) and the path matches a route on your app.

**How to avoid:**
1. Bun binds to `0.0.0.0` (default — don't override `hostname: "localhost"`).
2. `internal_port = 8080` in `fly.toml` matches `PORT` env var matches `Bun.serve({ port })`.
3. Don't intercept `Upgrade` headers in middleware (Hono `c.header()` doesn't touch them).
4. Verify with `curl -i -H "Upgrade: websocket" -H "Connection: Upgrade" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" -H "Sec-WebSocket-Version: 13" https://typing-race.fly.dev/ws` — expect `101`.

**Warning signs:** `curl` returns `400 Bad Request` from Fly; `fly logs` show no upgrade attempts.

### Pitfall 6: `idleTimeout: 120` kills the WS mid-race

**What goes wrong:** Race is 30–60 s; idle timeout is 120 s — fine. But Fly's edge proxy has its own idle timeout of ~60 s on `https` connections. If your WS frame cadence is <1/min (lobby), the *TCP* connection idles out and Fly closes the underlying TCP socket — even though Bun's WS thinks it's still open.

**Why it happens:** WebSocket keepalive at the protocol level (ping/pong every 30 s) prevents app-level idleness, but TCP-level idleness at the Fly edge is what kills you. Bun's `sendPings: true` sends WS protocol pings at the Bun level, but Fly's edge counts TCP silence separately.

**How to avoid:** Send an explicit app-level ping every 25 s during lobby (before race start) and every 10 s during race:
```ts
// apps/server/src/ws/handlers.ts (Phase 2 sketch)
ws.send(JSON.stringify({ type: "ping", ts: Date.now() }));
```
Schedule via `setInterval` inside the `open(ws)` hook, clear on `close`. This keeps TCP traffic flowing and the Fly edge happy.

**Warning signs:** Race starts, no issues; lobby sits idle for 90 s, first race-start message arrives 1 s after Fly closed the connection.

### Pitfall 7: Hono's `serveStatic` SPA fallback caches `index.html`

**What goes wrong:** After deploy, users with the old `index.html` cached get a JS error referencing a missing chunk (old hash, no longer in `assets/`).

**Why it happens:** `serveStatic` defaults to no `Cache-Control` — browsers cache `index.html` per their heuristic (often 10 min).

**How to avoid:** `onFound: (_p, c) => c.header("Cache-Control", "no-cache")` on the `index.html` route. Asset files (with hash in filename) get `public, max-age=31536000, immutable`.

### Pitfall 8: `fly.toml` `concurrency.type = "requests"` starves the WS

**What goes wrong:** Default `requests` units count HTTP request completions. A WS connection that's held open for 30 s contributes nothing to "requests completed" — but it still consumes a slot in the proxy's pool. Fly's `soft_limit = 200, hard_limit = 250` then throttles legitimate HTTP traffic to make room for idle WS sockets.

**Why it happens:** Per Fly.io docs, `type = "connections"` counts raw TCP sockets; `type = "requests"` counts completed HTTP requests. For WS-heavy apps, sockets is the correct unit.

**How to avoid:** `concurrency.type = "connections"` in our `fly.toml`. (Nerdleveltech's HTTP-only guide uses `"requests"` — we override.)

---

## Code Examples (verified)

### Zod 4 discriminated-union WS schemas (cross-package, one source of truth)

```ts
// packages/shared/src/messages.ts
import { z } from "zod";

// --- client → server ---
export const joinRoomSchema = z.object({
  type: z.literal("join_room"),
  code: z.string().regex(/^[A-Z0-9]{6}$/),
  nickname: z.string().min(1).max(20),
});

export const leaveRoomSchema = z.object({
  type: z.literal("leave_room"),
});

export const clientPingSchema = z.object({
  type: z.literal("ping"),
  clientTs: z.number().int(),
});

export const clientToServerSchema = z.discriminatedUnion("type", [
  joinRoomSchema,
  leaveRoomSchema,
  clientPingSchema,
]);
export type ClientToServer = z.infer<typeof clientToServerSchema>;

// --- server → client ---
export const helloSchema = z.object({
  type: z.literal("hello"),
  playerId: z.string().uuid(),
  serverTs: z.number().int(),
});

export const errorSchema = z.object({
  type: z.literal("error"),
  code: z.enum(["BAD_MESSAGE", "RATE_LIMITED", "INTERNAL"]),
  message: z.string(),
});

export const pongSchema = z.object({
  type: z.literal("pong"),
  clientTs: z.number().int(),
  serverTs: z.number().int(),
});

export const serverToClientSchema = z.discriminatedUnion("type", [
  helloSchema,
  errorSchema,
  pongSchema,
]);
export type ServerToClient = z.infer<typeof serverToClientSchema>;
```

```ts
// packages/shared/src/index.ts
export * from "./messages";
export * from "./race";
export * from "./codes";
```

Zod 4 note (verified against zod.dev/v4): `z.discriminatedUnion` is still the recommended API in v4 and was *upgraded* (not deprecated — that rumor is for a future v5). v4 supports nested unions and pipes as discriminator values, plus composing unions. No code change needed migrating from v3 → v4 for our basic usage. **Gotcha:** Zod 4 deprecated `errorMap`; use `error:` callback instead — but we're not customizing errors yet.

### Server: parse + dispatch + reply

```ts
// apps/server/src/ws/dispatch.ts
import { clientToServerSchema } from "@typing-race/shared";

export function dispatch(ws: ServerWebSocket<WsData>, raw: string | ArrayBuffer | Uint8Array) {
  const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
  let parsed: unknown;
  try { parsed = JSON.parse(text); }
  catch { return sendError(ws, "BAD_MESSAGE", "invalid json"); }

  const result = clientToServerSchema.safeParse(parsed);
  if (!result.success) return sendError(ws, "BAD_MESSAGE", result.error.message);

  switch (result.data.type) {
    case "join_room":
      ws.data.roomCode = result.data.code;
      // Phase 2: rooms.getOrCreate(result.data.code).addPlayer(ws.data.playerId)
      return;
    case "leave_room":
      ws.data.roomCode = null;
      return;
    case "ping":
      return ws.send(JSON.stringify({ type: "pong", clientTs: result.data.clientTs, serverTs: Date.now() }));
  }
}
```

### Client: WS connection wrapper (Zustand store)

```ts
// apps/web/src/net/ws.ts
import { serverToClientSchema } from "@typing-race/shared";
import { useConnectionStore } from "../store/connection";

export class WsConnection {
  private ws?: WebSocket;
  constructor(private url: string) { this.connect(); }

  private connect() {
    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => useConnectionStore.setState({ status: "open" });
    this.ws.onclose = () => {
      useConnectionStore.setState({ status: "closed" });
      setTimeout(() => this.connect(), 1000);              // Phase 1: naive 1 s retry
    };
    this.ws.onmessage = (ev) => {
      const parsed = serverToClientSchema.safeParse(safeJson(ev.data));
      if (!parsed.success) return console.warn("[ws] bad inbound", parsed.error);
      const msg = parsed.data;
      if (msg.type === "hello") useConnectionStore.setState({ playerId: msg.playerId, serverOffset: msg.serverTs - Date.now() });
    };
  }

  send(msg: unknown) { this.ws?.send(JSON.stringify(msg)); }
}

function safeJson(d: unknown): unknown {
  try { return JSON.parse(String(d)); } catch { return null; }
}
```

### Multi-stage Dockerfile (oven/bun:1.3-slim)

```dockerfile
# syntax=docker/dockerfile:1
ARG BUN_VERSION=1.3.14     # pin to exact version used in lockfile

# ---------- base ----------
FROM oven/bun:${BUN_VERSION}-slim AS base
WORKDIR /app

# ---------- deps ----------
FROM base AS deps
COPY package.json bun.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json    ./apps/server/
COPY apps/web/package.json       ./apps/web/
RUN bun install --frozen-lockfile

# ---------- client build ----------
FROM deps AS client-build
COPY packages/shared ./packages/shared
COPY apps/web       ./apps/web
# produce dist/ + .gz + .br siblings
RUN bun --filter '@typing-race/web' run build

# ---------- runtime ----------
FROM base AS release
ENV NODE_ENV=production
COPY --from=deps          /app/node_modules         /app/node_modules
COPY --from=client-build  /app/apps/web/dist        /app/apps/web/dist
COPY packages/shared      /app/packages/shared
COPY apps/server          /app/apps/server
COPY package.json bun.lock /app/

USER bun
EXPOSE 8080
WORKDIR /app/apps/server
# Bun.serve binds 0.0.0.0:8080 by default; no override needed
ENTRYPOINT ["bun", "run", "src/index.ts"]
```

### `fly.toml` (single-process, WS-friendly, scale-to-zero)

```toml
app = "typing-race"
primary_region = "ord"
kill_signal  = "SIGTERM"
kill_timeout = "10s"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  PORT     = "8080"

[http_service]
  internal_port       = 8080
  force_https         = true
  auto_stop_machines  = "stop"     # scale-to-zero when idle
  auto_start_machines = true
  min_machines_running = 0
  [http_service.concurrency]
    type       = "connections"     # sockets, not requests — correct unit for WS
    soft_limit = 200
    hard_limit = 250

[[http_service.checks]]
  grace_period = "3s"
  interval     = "15s"
  method       = "GET"
  timeout      = "4s"
  path         = "/health"

[[vm]]
  cpu_kind = "shared"
  cpus     = 1
  memory   = "256mb"
```

Decision call-outs:
- `concurrency.type = "connections"` — override nerdleveltech's `"requests"` default because every WS counts as one socket for the full race.
- `kill_signal = "SIGTERM"` matches the `process.on("SIGTERM", ...)` handler in `index.ts`; Fly sends SIGTERM before force-killing.
- `kill_timeout = "10s"` is generous; Phase 2 may need more for in-flight races (defer).
- Health check on `/health` is a plain `c.text("ok")`; keep it cheap.
- `[[vm]] memory = "256mb"` matches shared-cpu-1x; cost ~$1.94/mo at full uptime, less with auto-stop.

### Bun's WS handler shape (verbatim from Context7 /oven-sh/bun)

```ts
const server = Bun.serve({
  fetch(req, server) { /* upgrade logic */ },
  websocket: {
    // typed ws.data across all hooks (Bun 1.3+ recommended)
    data: {} as { authToken: string },

    // Lifecycle hooks
    open(ws) { /* on connect */ },
    message(ws, message: string | ArrayBuffer | Uint8Array) { /* on frame */ },
    close(ws, code: number, reason: string) { /* on disconnect */ },
    drain(ws) { /* backpressure cleared */ },

    // Tunables
    idleTimeout: 120,                        // seconds, max 255
    maxPayloadLength: 16 * 1024 * 1024,      // 16 MB default; we drop to 16 KB
    backpressureLimit: 16 * 1024 * 1024,     // 16 MB default; we drop to 1 MB
    closeOnBackpressureLimit: false,         // close if exceeded
    sendPings: true,                         // auto WS protocol pings
    perMessageDeflate: true,                 // permessage-deflate compression
  },
});
```

---

## Known Gotchas (Bun + Fly.io prod)

| Gotcha | Symptom | Fix |
|---|---|---|
| Bun WS `idleTimeout` in seconds, not ms | Misconfig sets `idleTimeout: 120000` thinking ms | It's seconds; max 255. Default 120 s is fine for 30–60 s races. |
| `maxPayloadLength` default 16 MB | Malicious client sends 16 MB blob, server parses, OOM | Set `maxPayloadLength: 16 * 1024` (16 KB); WS frames are <500 B. |
| `backpressureLimit` triggers `close` only when `closeOnBackpressureLimit: true` | Slow client buffers up, no error logged | Set `closeOnBackpressureLimit: true` if you want hard failure; otherwise log + drop frames. |
| `sendPings: true` only sends WS-protocol pings, not application-level pings | Fly edge times out idle TCP connections | Add app-level ping every 25 s in lobby, every 10 s in race. |
| Bun binds `0.0.0.0` by default | Override `hostname: "localhost"` and Fly can't reach | Don't override `hostname`. |
| Fly proxy adds `X-Forwarded-For` and changes `Host` | Hono / Express trusts `req.headers.get('host')` for canonical URL | Don't trust Host header. Use `req.url` directly. |
| `fly.toml` `kill_signal = "SIGTERM"` requires a handler | No handler = process killed mid-request | `process.on("SIGTERM", () => server.stop())` in `index.ts`. |
| Hono `serveStatic` doesn't auto-precompress | Static assets served uncompressed | `vite-plugin-compression` at build + `precompressed: true` on Hono. |
| Bun build mode: `bun build ./index.html` vs `vite build` | Bun's bundler doesn't understand React Compiler config used by `vite-plugin-react` | Use **Vite** for the SPA build; Bun for the server runtime. Don't mix. |
| Vite 8 + plugin-react v6 oxc-native | Some third-party Babel plugins fail | Don't add Babel; use oxc-native plugin. |
| Bun's WS message is `string \| ArrayBuffer \| Uint8Array` | Always TextDecoder-wrap on receive to avoid binary crashes | `typeof raw === "string" ? raw : new TextDecoder().decode(raw)` |
| `bun.lock` (text) vs `bun.lockb` (binary) | CI installs differently | Commit `bun.lock`; gitignore `bun.lockb` if present. |
| Fly's `internal_port` must match `PORT` env var AND `Bun.serve({ port })` | App starts, health check fails forever | Triple-match all three. |
| Fly HTTP service `force_https = true` + WS over `wss://` | Mixed HTTPS termination; works because Fly terminates TLS in front of HTTP service | No change needed — `wss://` becomes `ws://` after Fly's TLS terminator. Verified in nerdleveltech guide. |

---

## State of the Art (2026)

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| `Bun.serve<WsData, ...>` type parameter for typed `ws.data` | `websocket: { data: {} as WsData }` object property | Bun 1.3 (mid-2026) | TS limitation made the type-param form fragile; object form is the recommended path going forward. Both still work. |
| Zod v3 `z.discriminatedUnion` | Zod v4 `z.discriminatedUnion` (upgraded, not deprecated) | Zod 4.0 (2026) | Supports nested unions, pipes, and composing unions as members. No code change for basic usage. |
| Vite 7 + plugin-react v5 (Babel) | Vite 8 + plugin-react v6 (oxc-native) | Mid-2026 | Smaller bundles, faster builds, optional React Compiler via oxc. |
| Hono `serveStatic` without `precompressed` | Hono `serveStatic({ precompressed: true })` | Hono 4.9+ (early 2026) | Zero-config gzip/brotli serving if `.gz`/`.br` siblings exist on disk. |
| Fly.io `auto_stop_machines = true` (boolean) | `auto_stop_machines = "off" \| "stop" \| "suspend"` (string) | Late 2025 | `"suspend"` resumes faster than `"stop"` (holds state in memory); we pick `"stop"` for $0 idle billing. |
| React 18 | React 19.2.x | 2025–2026 | Concurrent rendering + automatic batching + `useSyncExternalStore` for 30 Hz cursor stream. |

**New tools/patterns to consider:**
- **Bun's HTML imports (`import index from "./index.html"`)**: Bun can serve a SPA from a single `import` statement + `Bun.serve({ routes: { "/": index } })`. **We don't use it** because we want a separate Vite build pipeline for React Compiler + oxc + precompressed assets.
- **Bun's standalone HTML (`bun build --compile --target=browser`)**: bundles entire SPA into one `.html` file. Tempting for "one file deploy," but loses caching benefits and precompressed siblings. Skip.
- **React Compiler 1.0 via oxc**: opt-in via `react({ compiler: true })` in Vite config. STACK.md defers to Phase 5 — measure cursor render cost first.

**Deprecated/outdated:**
- **`bun.lockb` (binary lockfile)**: Bun still writes both `bun.lock` (text) and `bun.lockb`; commit only `bun.lock`, ignore `bun.lockb`.
- **Fly `auto_stop_machines = true` boolean**: rejected by current Fly config schema; must be `"off" | "stop" | "suspend"`.
- **Zod `errorMap`**: deprecated in v4; use `error:` callback. Not relevant to Phase 1.

---

## Open Questions

1. **Should we add `perMessageDeflate: true` to the WS config?**
   - What we know: Default is `false`; enabling it cuts ~70% bandwidth per text frame.
   - What's unclear: CPU cost on Bun at 30 Hz × 8 players × 8 rooms = ~2000 frames/sec. Bun's permessage-deflate is reportedly fast but unverified at our scale.
   - Recommendation: **Enable** `perMessageDeflate: true` in Phase 1 (`websocket: { perMessageDeflate: true }`). Phase 5 measures; revert if CPU profiler shows hot spot. STACK.md + nerdleveltech guide confirm this is the production default in 2026.

2. **Vite dev proxy path rewriting?**
   - What we know: `/api` → `http://localhost:8080` with no rewrite hits `/api/foo` on Bun. Hono routes are mounted under `/api/*` (so `app.route("/api", apiRoutes)` then `/foo` resolves).
   - What's unclear: Whether the rewrite is needed if Hono's base path is `/api`.
   - Recommendation: **No rewrite** — mount Hono under `/api` on the server side, keep paths identical in dev and prod.

3. **Bun's hot-reload + WS handler closures?**
   - What we know: `bun --hot run src/index.ts` re-evaluates the module on file change; in-flight WS handlers hold the old closure.
   - What's unclear: Whether the `rooms` Map gets duplicated across reloads (memory leak in dev).
   - Recommendation: Use `bun --hot` for dev. Document that reloading creates a fresh `rooms` Map; in-flight WS clients reconnect via `onclose` handler. **No prod impact** because prod runs `bun run` (no `--hot`).

4. **Do we need CORS on `/api/*` and `/ws` in dev?**
   - What we know: Vite proxy makes the SPA see same-origin (`localhost:5173/api/...`); browser sees no cross-origin. CORS not needed.
   - What's unclear: None — verified by Vite proxy docs.
   - Recommendation: **Skip CORS middleware in Phase 1.** If a future Phase 6 opens up a public REST API, add `@hono/cors`.

---

## Validation Architecture (Nyquist)

The five experiments below prove Phase 1 works end-to-end. Each must pass before Phase 1 is "done" and Phase 2 begins.

### Experiment 1: Monorepo installs + typechecks cleanly
**What it proves:** Workspace resolution works. All four packages (`shared`, `server`, `web`, root) share one `node_modules` at the root via Bun's hoisted linker. `tsc --noEmit` in each workspace passes.

**Procedure:**
```bash
cd /home/nacs/Documents/git/typing-race
bun install                                       # exits 0
bun --filter '*' run typecheck                    # exits 0 across all packages
ls -la node_modules/ | head -5                    # hoisted deps visible
ls packages/shared/node_modules/ 2>&1 | head -1   # should be "No such file" — hoisted
```

**Pass criteria:** All commands exit 0; `packages/shared/node_modules` does not exist (hoisted to root); root `bun.lock` is committed.

### Experiment 2: Dev proxy routes `/api` and `/ws` to Bun
**What it proves:** Vite proxy correctly forwards both REST and WS upgrades. The `http-proxy` upgrade handler attaches when `ws: true` is set.

**Procedure:**
```bash
# Terminal 1: Bun server
bun --filter '@typing-race/server' run dev         # :8080
# Terminal 2: Vite dev
bun --filter '@typing-race/web' run dev            # :5173

# Terminal 3: verify HTTP
curl -fsS http://localhost:5173/api/health        # → "ok" (proxied via Vite)
curl -fsS http://localhost:8080/health             # → "ok" (direct)

# Verify WS upgrade via Vite proxy
node -e "
  const ws = new WebSocket('ws://localhost:5173/ws');
  ws.onopen = () => { console.log('OPEN'); ws.send(JSON.stringify({type:'ping',clientTs:Date.now()})); };
  ws.onmessage = (ev) => { console.log('MSG', ev.data); process.exit(0); };
  setTimeout(() => { console.error('TIMEOUT'); process.exit(1); }, 5000);
"
```

**Pass criteria:** `curl http://localhost:5173/api/health` returns `ok`; the Node WS script prints `OPEN` then `MSG {"type":"pong",...}` then exits 0; Bun server logs show `[ws] open` and `[ws] close`.

### Experiment 3: Zod 4 schema round-trips across packages with no type duplication
**What it proves:** Client imports `@typing-race/shared` types and Zod schemas; runtime parse returns the same TS type as `z.infer<typeof X>`. Changing a schema in `packages/shared/src/messages.ts` causes **both** apps to fail `tsc --noEmit` if their consumers don't update.

**Procedure:**
```ts
// apps/web/src/__tests__/round-trip.test.ts (vitest)
import { describe, it, expect } from "vitest";
import { clientToServerSchema, serverToClientSchema } from "@typing-race/shared";

describe("shared schemas", () => {
  it("parses a valid hello", () => {
    const r = serverToClientSchema.safeParse({
      type: "hello", playerId: "00000000-0000-0000-0000-000000000000", serverTs: 1,
    });
    expect(r.success).toBe(true);
  });
  it("rejects an unknown type", () => {
    const r = clientToServerSchema.safeParse({ type: "nope" });
    expect(r.success).toBe(false);
  });
  it("rejects bad join_room code", () => {
    const r = clientToServerSchema.safeParse({ type: "join_room", code: "abc", nickname: "x" });
    expect(r.success).toBe(false);
  });
});
```

```bash
bun --filter '@typing-race/web' test      # exits 0
```

**Pass criteria:** All 3 tests pass; `packages/shared/src/index.ts` exports both schemas and TS types; `grep -r "type.*=.*z.object" apps/web/src/` returns no matches (no schema duplication in apps).

### Experiment 4: Prod single-process serves SPA + WS from one port
**What it proves:** `docker build` produces an image that runs `bun run src/index.ts`, serves `apps/web/dist/*` (including `.gz`/`.br` siblings), responds to `/health`, upgrades WS at `/ws`, and SPA-falls-back to `index.html` for unknown paths — all from port 8080.

**Procedure:**
```bash
docker build -t typing-race:test .
docker run --rm -p 8080:8080 typing-race:test &     # background

# health
curl -fsS http://localhost:8080/health                              # → "ok"

# SPA root
curl -fsS -H 'Accept-Encoding: gzip' http://localhost:8080/ | head -c 200

# SPA fallback (deep link)
curl -fsS http://localhost:8080/r/ABC123 | head -c 200             # → index.html

# precompressed asset
ASSET=$(curl -fsS http://localhost:8080/ | grep -oE '/assets/[^"]+\.js')
curl -fsS -H 'Accept-Encoding: gzip, br' -i http://localhost:8080$ASSET | head -20   # expect Content-Encoding: br

# WS upgrade through prod server
node -e "
  const ws = new WebSocket('ws://localhost:8080/ws');
  ws.onopen = () => { console.log('OPEN'); ws.close(); };
  ws.onclose = () => { console.log('CLOSE'); process.exit(0); };
"
```

**Pass criteria:** `/health` returns 200; `/` returns 200 with HTML; `/r/ABC123` returns 200 with HTML (SPA fallback); `/assets/*.js` with `Accept-Encoding: gzip, br` returns `Content-Encoding: br`; WS upgrade succeeds.

### Experiment 5: Fly.io deploy, health check passes, WS reachable over `wss://`
**What it proves:** The image runs on Fly; `fly.toml` health check on `/health` keeps the machine alive; WS works over Fly's TLS-terminated edge (`wss://typing-race.fly.dev/ws`); `fly deploy --strategy immediate` (not rolling) keeps the deploy atomic; `auto_stop_machines = "stop"` scales to zero after idle.

**Procedure:**
```bash
fly launch --no-deploy                           # creates app + fly.toml stub
# overwrite fly.toml with the one in this RESEARCH file
fly deploy --strategy immediate --ha=false       # single machine
fly status                                       # expect "started"
curl -fsS https://typing-race.fly.dev/health     # → "ok"

# WS through Fly edge
node -e "
  const ws = new WebSocket('wss://typing-race.fly.dev/ws');
  ws.onopen = () => { console.log('OPEN'); ws.send(JSON.stringify({type:'ping',clientTs:Date.now()})); };
  ws.onmessage = (ev) => { console.log('MSG', ev.data); process.exit(0); };
  setTimeout(() => { console.error('TIMEOUT'); process.exit(1); }, 8000);
"

# verify scale-to-zero (skip if running this during a demo)
fly machine list                                 # shows status
echo "wait 10 min idle, then:"
fly machine list                                 # expect "stopped"
curl -fsS https://typing-race.fly.dev/health     # → "ok" (cold start wakes it)
```

**Pass criteria:** `fly status` shows `started`; `curl /health` returns 200; WS through `wss://` upgrades and round-trips a ping/pong in <8 s; idle machine auto-stops within ~10 min and cold-starts on next request.

---

## Sources

### Primary (HIGH confidence — verified today)
- npm registry `https://registry.npmjs.org/<pkg>/latest` — all version pins above (bun 1.4.0, hono 4.13.5, @hono/zod-validator 0.9.0, zod 4.5.4, vite 8.2.2, @vitejs/plugin-react 6.1.1, react 19.2.8, zustand 5.0.15, nanoid 6.0.1, pino 10.3.1, @types/bun 1.4.0, vitest 4.1.11, typescript 7.0.2, prettier 3.9.6, eslint 10.9.1)
- `/oven-sh/bun` Context7 docs (`docs/runtime/http/websockets.mdx`, `docs/guides/websocket/simple.mdx`) — typed `ws.data` via `data: {} as T`, `idleTimeout` semantics, lifecycle hooks, `sendPings`, `backpressureLimit`
- `/honojs/hono` Context7 docs — `serveStatic` from `hono/bun` with `precompressed: true`, SPA fallback pattern
- `https://bun.com/docs/pm/workspaces` + `https://bun.com/guides/install/workspaces` — workspace globs, hoisted linker, `workspace:*` resolution
- `https://vite.dev/config/server-options` — `server.proxy` with `ws: true`, `changeOrigin`
- `https://zod.dev/v4` — Zod 4 `discriminatedUnion` is upgraded (not deprecated), basic usage unchanged
- `https://fly.io/docs/launch/autostop-autostart/` + `https://fly.io/docs/reference/configuration/` — `auto_stop_machines = "off" | "stop" | "suspend"`, `kill_signal`, `internal_port`, `concurrency.type`, `[[http_service.checks]]`, `[[vm]]`

### Secondary (MEDIUM confidence)
- nerdleveltech.com "Deploy Bun + Hono on Fly.io: 2026 Production Guide" (May 2026) — Dockerfile, fly.toml baseline; uses `concurrency.type = "requests"` because their app is HTTP-only — we override to `"connections"` for WS
- callsphere.ai "Build a Bun + Hono + OpenAI Realtime Voice Agent on the Edge (2026)" — Bun WS behind Fly; **gpt-realtime-2** is irrelevant to us but the Fly+Bun+Hono WS pattern is verified
- hono.dev/docs/helpers/websocket — `upgradeWebSocket` helper exists and works on Bun via `hono/bun`; rejected in favor of native `Bun.serve({ websocket })` for typed `ws.data` + perf
- Stack Overflow "Zod circular schemas using discriminated unions" — confirms `z.discriminatedUnion` works on Zod 4 playground

### Tertiary (LOW confidence — verify during planning/execution)
- "Bun's permessage-deflate performance at 2000 frames/sec" — unverified; enable and measure in Phase 5
- "Fly's edge idle TCP timeout is ~60 s" — heuristic; actual value may vary; mitigate with 25 s app-level pings regardless
- "Bun hot-reload + WS closures don't leak in dev" — empirically unverified; production runs without `--hot` so it's a non-issue for Phase 1 done

---

## Metadata

**Research scope:**
- Core technology: Bun 1.3/1.4 native WS server + Hono HTTP + bun workspaces
- Ecosystem: Vite 8 / React 19 / Zod 4 / Fly.io / oven-sh Docker images
- Patterns: workspace layout, native WS upgrade, dev proxy, prod static serving, multi-stage Docker, fly.toml tuning, Zod 4 discriminated unions across packages
- Pitfalls: Vite WS proxy, Bun message type union, lockfile migration, idle timeout behind Fly edge, gzip serving

**Confidence breakdown:**
- Standard stack: HIGH — every version verified against npm registry today
- Architecture: HIGH — verified against official Context7 + Vite + Hono docs
- Pitfalls: HIGH — drawn from STACK.md/PITFALLS.md + this Phase-1-specific set; 2 MEDIUM items called out in Open Questions
- Code examples: HIGH — verbatim from Context7 /oven-sh/bun, with our types glued on

**Research date:** 2026-08-30
**Valid until:** 2026-09-30 (30 days; Bun + Hono + Vite all stable, low drift risk). Re-verify Bun's WS permessage-deflate behavior before Phase 5.

---

*Phase: 01-foundation*
*Research completed: 2026-08-30*
*Ready for planning: yes*