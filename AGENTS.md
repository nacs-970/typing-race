# AGENTS.md — Repository Metadata & Agent Guide

Welcome to **Typing Race**! This document serves as the operational guide and architectural reference for AI coding agents working in this repository.

---

## 1. Project Overview & Mission

**Typing Race** is a realtime multiplayer typing race application built as a high-performance, cloud-agnostic N-tier monorepo using Bun, React 19, Vite, and Hono. 

Key characteristics:
- **Server-Authoritative**: Game logic, cursor verification, character correctness, WPM calculations, and race completion run exclusively on the server/engine.
- **NTP-Style Clock Sync**: Clients synchronize clocks with the gateway before race start to guarantee fair countdowns (<50ms skew).
- **Anti-Cheat Validation**: Server validates all keystrokes against the passage text, enforces monotonic indexing, rejects frames with `<20ms` intervals (capping ~250 WPM), and rejects keystrokes submitted before the start countdown finishes.
- **Disconnect Grace & Reconnect**: Players experiencing network drops have a 60-second grace window to reconnect via session tokens (`typing_race_{roomCode}` cookie).

---

## 2. Monorepo Architecture & Package Boundaries

The repository is structured as a Bun monorepo (`bun-workspace`) with clean separation between shared contracts and operational tiers:

```
typing-race/
├── apps/
│   ├── web/        # (@typing-race/web) Frontend presentation tier (Vite + React 19)
│   ├── gateway/    # (@typing-race/gateway) Ingress tier (Bun.serve + Hono + WebSockets)
│   └── engine/     # (@typing-race/engine) Headless race simulation tier (pure race state loop)
├── packages/
│   └── shared/     # (@typing-race/shared) Zod schemas, types, corpus, and event bridge
├── docker-compose.yml
├── Dockerfile      # Unified root Dockerfile (production fallback for Fly.io)
└── package.json    # Root workspace orchestration
```

### Tier Descriptions

1. **`packages/shared` (`@typing-race/shared`)**:
   - Canonical wire protocol defined via Zod schemas (`ClientToServer`, `ServerToClient`).
   - Passage corpus (`PASSAGES` with unique UUIDs, source metadata, and word counts).
   - Room code generator and validator (6 uppercase characters, excludes ambiguous `I, O, 0, 1`).
   - `EventBridge` contracts (`InMemoryEventBridge`, `RedisEventBridge`, `GatewayToEngineEvent`, `EngineToGatewayEvent`).
   - **CRITICAL BOUNDARY RULE**: Root export (`@typing-race/shared`) MUST remain 100% browser-safe. Node-specific modules (such as `ioredis` and `node:events`) are isolated strictly under the subpath export `@typing-race/shared/bridge`. Never re-export `bridge.ts` from `src/index.ts`.

2. **`apps/web` (`@typing-race/web`)**:
   - Presentation tier built with React 19, Vite 8, Zustand 5, and Tailwind CSS v4.
   - Text layout computed using `@chenglou/pretext`.
   - Single-origin dev proxy routes `/ws`, `/api`, and `/health` to Gateway.
   - Managed state stores: `connection`, `clock`, `race`, `cursor`, `toast`.

3. **`apps/gateway` (`@typing-race/gateway`)**:
   - Real-time client ingress tier powered by `Bun.serve` and Hono 4.
   - Manages client WebSockets, connection heartbeat/ping-pong, IP-based room creation rate limits (`/api` & WS frames), and NTP clock sync (`GET /api/clock-sync`).
   - Translates client WebSocket messages into `GatewayToEngineEvent`s and dispatches them across the configured `EventBridge`.
   - In production/unified mode, serves precompressed static assets from `apps/web/dist` (`serveStatic`).

4. **`apps/engine` (`@typing-race/engine`)**:
   - Pure headless simulation engine with zero direct browser WebSocket awareness.
   - Authoritative 100ms tick loop broadcasting `cursor_update` frames to active rooms.
   - Manages room lifecycles (`waiting` → `countdown` → `racing` → `finished`), host promotion, and 60-second disconnect grace sweepers.
   - In split mode, communicates with Gateway via loopback WebSocket IPC (`LoopbackIpcServer` on port 8081) or Redis Pub/Sub. In unified mode, runs embedded via `InMemoryEventBridge`.

---

## 3. Network Ports & Topology

| Service | Port | Protocol / Endpoint | Purpose |
| :--- | :--- | :--- | :--- |
| **`apps/web`** | `5173` | HTTP | Vite dev server (proxies `/ws` & `/api` to Gateway) |
| **`apps/gateway`** | `8080` | HTTP / WebSocket | Client ingress (`/health`, `/api/clock-sync`, `/ws`) |
| **`apps/engine`** | `8081` | WebSocket (Loopback IPC) | Internal IPC between Gateway and Engine in split mode |
| **Redis** | `6379` | TCP | Optional inter-tier event bus in multi-container setups |

---

## 4. Run Modes & Development Commands

Requires **Bun >=1.3.2 <1.5.0**.

### Development Execution

- **Split Mode (Default local dev)**:
  Runs Web, Gateway, and Engine as 3 concurrent processes:
  ```bash
  bun run dev
  ```
- **Unified Mode (Single server process)**:
  Runs Web dev server and Gateway with embedded Engine via in-memory bridge:
  ```bash
  bun run dev:unified
  ```
- **Individual Workspace Dev**:
  ```bash
  bun run dev:web        # apps/web (port 5173)
  bun run dev:gateway    # apps/gateway (port 8080)
  bun run dev:engine     # apps/engine (port 8081)
  ```

### Validation & Verification

Always run all three checks before finalizing changes:

```bash
# 1. Typecheck all workspaces
bun run typecheck

# 2. Run test suites across shared, gateway, engine, and web
bun run test

# 3. Production client build
bun run build
```

### Containerization

- **Docker Compose (Distributed Topology + Redis)**:
  ```bash
  docker compose up --build
  ```
- **Unified Production Container (Fly.io)**:
  ```bash
  docker build -t typing-race -f Dockerfile .
  docker run -p 8080:8080 typing-race
  ```

---

## 5. Domain Invariants & Rules

When modifying or adding features, you must maintain these system invariants:

1. **Server Authority**: Never trust client-reported WPM or completion status. The server tracks passage progress, validates keystroke accuracy, records finish timestamps, and computes final statistics.
2. **Clock Sync Contract**: `GET /api/clock-sync` returns `{ t1, t2 }`. The web client measures local send timestamp `t0` and receive timestamp `t3`, deriving `roundtripMs = (t3 - t0) - (t2 - t1)` and `offsetMs = ((t1 - t0) + (t2 - t3)) / 2`.
3. **Keystroke Anti-Cheat**:
   - `serverTs >= raceStartTs - graceMs` (50ms grace window).
   - `clientTs - lastKeystrokeClientTs >= 20ms`.
   - `keystroke.index === currentCursorIndex` (no skipped letters).
   - Keystroke character matches the expected character in the assigned passage.
4. **Session Token Continuity**:
   - On joining or creating a room, players receive a cryptographic `sessionToken`.
   - Stored in document cookie `typing_race_{roomCode}`.
   - If a connection drops, the client reconnects with `rejoin_room` using the token.
   - The engine restores room membership, host status, and progress without dropping the room.
5. **Tab Takeover Detection**:
   - Only one active WebSocket connection per player session is permitted.
   - Opening the same room in a new tab sends `session_taken_over` to the previous connection.

---

## 6. Golden Rules for AI Agents

1. **NEVER run destructive git commands**:
   - `git reset --hard`
   - `git checkout .`
   - `git restore .`
   - `git clean -fd`
2. **Always ask permission** before performing any destructive git operations.
3. If you need to inspect an original file from git, use `git show HEAD:filename`.
4. If you need to checkout or compare branches, clone to `/tmp` and inspect there.
5. **Preserve original code and logic**: Make surgical, minimal edits. Do not refactor unrelated code.
6. **Maintain Browser Safety in Shared Package**: Never import Node-only APIs (`node:*`, `ioredis`, filesystem, child_process) into `packages/shared/src/index.ts` or files imported by `apps/web`.
