# Typing Race

Realtime multiplayer typing race. Two connected clients see each other's cursor in real time and the race ends with a fair, identical WPM/accuracy score.

## Architecture

The project is structured as a cloud-agnostic N-tier monorepo:

- **`packages/shared`** (`@typing-race/shared`): Canonical wire protocol schemas (Zod discriminated unions), room codes, corpus, and typed `EventBridge` contracts (`InMemoryEventBridge`, `RedisEventBridge`).
- **`apps/web`** (`@typing-race/web`): Pure presentation tier built with Vite 8, React 19, and Tailwind CSS v4. Dev proxy routes `/ws`, `/api`, and `/health` to Gateway.
- **`apps/gateway`** (`@typing-race/gateway`): Real-time ingress tier using `Bun.serve` + Hono. Manages client WebSocket connections, NTP clock sync, IP rate limiting, and forwards game actions to Engine via `EventBridge`.
- **`apps/engine`** (`@typing-race/engine`): Headless race simulation tier. Runs authoritative race loop, anti-cheat timestamp/rate validation, scoring, and 60-second disconnect grace handling.

## Development

Note: React Compiler was evaluated and skipped (D-08) — Phase 5 already isolated cursor rendering outside the React tree via CSS `transform3d`, and no profiling has shown a render bottleneck that would justify it; revisit only if that changes.


Bun 1.3.2+ is required. Dependencies are installed deterministically:

```bash
bun install --frozen-lockfile
```

### Local Run Modes

1. **Split Mode (Default, 3 independent processes)**:
   ```bash
   bun run dev
   ```
   Runs `web` (:5173), `gateway` (:8080), and `engine` (:8081) concurrently using internal loopback IPC.

2. **Unified Mode (Single server process)**:
   ```bash
   bun run dev:unified
   ```
   Runs `web` (:5173) and `gateway` (:8080) running gateway + engine in a single process via in-memory event dispatch.

3. **Isolated Component Debugging**:
   - `bun run dev:web`: Vite development server on port 5173
   - `bun run dev:gateway`: Gateway server on port 8080
   - `bun run dev:engine`: Standalone headless engine on port 8081

### Quality Checks

```bash
bun run typecheck   # Typecheck all packages
bun run test        # Run test suites across shared, gateway, engine, and web
bun run build       # Production client build
```

## Deployment

### Multi-Container Topology (Docker Compose)

Spin up the distributed 3-tier stack with optional Redis pub/sub:

```bash
docker compose up --build
```

- **redis**: Redis 7 on port 6379 for inter-tier Pub/Sub
- **engine**: Headless engine container connected to Redis
- **gateway**: WebSocket gateway on port 8080 with healthcheck
- **web**: Static client served via Caddy on port 5173 (maps to :80)

### Single-Container Fallback (Fly.io)

For resource-constrained single-process deployments (such as Fly.io free tier):

```bash
docker build -t typing-race -f Dockerfile .
docker run -p 8080:8080 typing-race
```

Runs Gateway, Engine, and static SPA serving in unified mode (`MODE=unified`) under a non-root `bun` user.
Configuration is maintained in `fly.toml`.

### Deploy Strategy

`fly deploy --strategy immediate --remote-only` is the intended command, chosen over a rolling strategy because a single-VM-per-tier deploy has no second instance to roll onto; the actual `fly deploy` invocation and `fly.toml` tuning are explicitly out of scope for Phase 6 and remain a follow-up.

### Graceful Shutdown

On SIGTERM, the process broadcasts a `SERVER_SHUTTING_DOWN` error frame to all connected clients (rendered as a "Server Restarting" toast), stops accepting new `create_room`/`join_room`/`start_race` messages, lets in-flight races finish normally, and exits once drained or after a 90-second hard cap (via `apps/engine/src/engine.ts`'s `EngineWorker.drain()` and `apps/gateway/src/index.ts`'s `GatewayInstance.drain()`).
Note: `fly.toml`'s current `kill_timeout` is `"10s"`, well under the 90s drain window — whoever performs the actual Fly.io deploy work must bump `kill_timeout` to `>= 90s` first, or Fly will SIGKILL mid-drain.

### Local Smoke Test

The new `scripts/smoke-test.sh` is the local pre-ship check. The full two-browser manual race verification and the CI gate are both explicitly deferred out of Phase 6's scope and remain manual/future work respectively.