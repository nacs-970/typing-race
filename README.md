# Typing Race

A realtime multiplayer typing race. Practice alone with a typing test, or create a room, share a six-character code, and race in a room of up to eight players on the same text while watching each other's cursors move live. The server scores every player, so the WPM and accuracy board is the same for everyone.

## Features

- **Solo typing test** as the landing view. Modes: timed (15, 30, 60, 120 s), word count (10, 25, 50, 100) or a passage (short, mid, long). Optional punctuation and numbers. Choices are saved in the browser (`localStorage`).
- **Multiplayer rooms** for up to 8 players. The host picks the text (a real passage or random words, short, mid or long) and the finish grace: once the first player finishes, the others keep typing for 3 to 10 seconds (default 5) before the race ends. After the race, everyone sees a ranked board with WPM and accuracy, and the host can start a rematch.
- **Live opponent cursors**, interpolated between server updates and positioned outside the React tree with CSS `translate3d`.
- **Fair start.** Clients sync their clocks with the gateway (NTP-style) before the countdown, so everyone starts within about 50 ms of each other.
- **Server-authoritative scoring.** The client only renders. The engine checks every keystroke and computes the final stats.
- **Reconnect mid-race.** A dropped player has 60 seconds to rejoin with a session token and keeps their place and progress.
- **Customisable look.** Olive, Dark, High Contrast and Ocean presets, custom colors and font size. Phones type through a hidden input. Accessibility fixes (contrast, labels, live announcements, focus) are tracked against WCAG success criteria.

## Quick start

Requires [Bun](https://bun.sh) `>=1.3.2 <1.5.0`.

```bash
bun install --frozen-lockfile
bun run dev:unified
```

Open <http://localhost:5173>. To try a race alone, join the room from a second browser or a private window. A second tab in the same browser takes over your first player's session.

## Architecture

An N-tier Bun monorepo. Each tier can run in its own process or, in unified mode, all in one.

```
 browser ──HTTP/WS──▶ gateway ──EventBridge──▶ engine
 (apps/web)          (apps/gateway)           (apps/engine)
                            ▲                       │
                            └───── cursor_update ───┘
```

| Path | Package | Role |
| --- | --- | --- |
| `apps/web` | `@typing-race/web` | Presentation tier: Vite 8, React 19, Zustand 5, Tailwind CSS v4. Text layout uses `@chenglou/pretext`. In dev, Vite proxies `/ws`, `/api` and `/health` to the gateway. |
| `apps/gateway` | `@typing-race/gateway` | Ingress tier: `Bun.serve` and Hono 4. Handles WebSockets, heartbeat, clock sync (`GET /api/clock-sync`), per-IP rate limits, and forwards game actions to the engine. Serves the built SPA in production. |
| `apps/engine` | `@typing-race/engine` | Headless simulation tier. Runs the room lifecycle (`lobby`, `countdown`, `racing`, `grace`, `finished`), a 100 ms tick that broadcasts `cursor_update`, anti-cheat, scoring, host promotion and disconnect grace. |
| `packages/shared` | `@typing-race/shared` | Zod wire protocol (`ClientToServer`, `ServerToClient`), room codes, passage corpus, word generator, and the `EventBridge` contract. |

The gateway and engine talk through an `EventBridge`:

- **Unified mode:** `InMemoryEventBridge`, one process.
- **Split mode:** loopback WebSocket IPC between gateway (client) and engine (server on `:8081`).
- **Redis:** `RedisEventBridge` over Pub/Sub, used when `REDIS_URL` is set.

`@typing-race/shared` must stay browser-safe. Node-only code (`ioredis`, `node:events`) lives behind the `@typing-race/shared/bridge` subpath and is never re-exported from the package root.

### Anti-cheat rules

The engine rejects a keystroke unless all of these hold:

- It arrives no earlier than the race start minus a 50 ms grace window.
- It comes at least 20 ms after the player's previous keystroke (about 250 WPM at most).
- Its index equals the player's current cursor index (no skipped characters).
- Its character matches the passage at that index.

`AGENTS.md` has the full set of domain invariants, including session tokens (`typing_race_{roomCode}` cookie) and tab takeover.

## Development

```bash
bun run dev           # split mode: web :5173, gateway :8080, engine :8081
bun run dev:unified   # web :5173 and one server process on :8080 (gateway + engine)
bun run dev:web       # one tier only
bun run dev:gateway
bun run dev:engine
```

Before you finish a change, run all three checks:

```bash
bun run typecheck   # tsc across shared, web, gateway, engine
bun run test        # bun test (shared, gateway, engine) and vitest (web)
bun run build       # production client build
```

### Passage corpus

`PASSAGES` in `packages/shared/src/passages.ts` holds the curated passages plus any Project Gutenberg passages imported into `passages.generated.ts` (empty until you run the importer):

```bash
bun run corpus:gutenberg -- --books 1342,11 --per-book 9
```

The script `scripts/fetch-gutenberg.ts` writes `packages/shared/src/passages.generated.ts` (do not edit that file by hand). It caches downloads in `scripts/.cache/`, skips duplicates, and fails closed on copyright. A book is used only if its metadata says "Public domain in the USA" and every author, translator and editor died on or before `--max-death-year` (default: current year minus 71). Use `--dry-run` to preview.

## Configuration

Names only. Real values are never committed. See `.env.example` for local defaults.

| Variable | Purpose | Default |
| --- | --- | --- |
| `MODE` | `unified` (gateway and engine in one process) or `split` | `split` |
| `PORT` / `GATEWAY_PORT` | Gateway listen port. Render injects `PORT` (default `10000`), so do not set it there. | `8080` |
| `HOST` / `GATEWAY_HOST` | Gateway bind address | `0.0.0.0` |
| `ENGINE_HOST` | Engine host (split mode) | `127.0.0.1` |
| `ENGINE_PORT` | Engine port (split mode) | `8081` |
| `REDIS_URL` | Redis connection string for the Redis `EventBridge`. Its presence overrides `MODE`, so leave it unset in unified deployments. | unset |
| `NODE_ENV` | `production` or `development` | `development` |
| `LOG_LEVEL` | pino log level | `info` in production, `debug` otherwise |
| `VITE_WS_URL` | Build-time WebSocket URL for the client. Leave it unset to use the same origin (`wss://<host>/ws`), which Render needs. | same origin |
| `VITE_HOST`, `VITE_PORT` | Vite dev server bind and port (dev only) | `true`, `5173` |
| `VITE_SERVER_URL` | Gateway URL the Vite dev proxy targets (dev only) | `http://localhost:8080` |

## Deployment

### Docker Compose (three tiers plus Redis)

```bash
docker compose up --build
```

| Service | Port | Notes |
| --- | --- | --- |
| `redis` | 6379 | Redis 7, Pub/Sub between the tiers |
| `engine` | 8081 (internal) | Headless engine, connected to Redis |
| `gateway` | 8080 | WebSocket gateway with a `/health` healthcheck |
| `web` | 5173 | Static client served by Caddy (container port 80) |

### Single container (unified mode)

The root `Dockerfile` runs gateway, engine and the static SPA in one process as a non-root `bun` user. This is the image Render deploys.

```bash
docker build -t typing-race -f Dockerfile .
docker run -p 8080:8080 typing-race
```

### Render (free tier)

Push to `master`, then in the Render dashboard choose **New, Blueprint** and select this repo. `render.yaml` defines one free Docker web service in the Singapore region, using the root `Dockerfile` and `/health` as the health check.

- **Cold starts.** A free instance spins down after 15 minutes without traffic, and the next visitor waits about a minute. Room state lives in memory, so a room code shared before a spin-down stops working. This is an accepted trade-off for a demo.
- **Redeploys are not zero-downtime.** Clients get the shutdown notice and reconnect, but rooms are lost. The free tier does not support `maxShutdownDelaySeconds`, so its short fixed shutdown grace can kill the process before the 90-second drain finishes.
- **Builds.** Auto-deploys skip changes that only touch `.planning/`, `.claude/`, `.hermes/`, `*.md` or `docker-compose.yml`.

### Graceful shutdown

On `SIGTERM` the process:

1. Broadcasts a `SERVER_SHUTTING_DOWN` error frame to every client. The web app shows a "Server Restarting" toast.
2. Stops accepting `create_room`, `join_room` and `start_race`.
3. Lets races in progress finish.
4. Exits once all rooms have drained, or after a 90-second hard cap.

The logic is in `EngineWorker.drain()` (`apps/engine/src/engine.ts`) and `GatewayInstance.drain()` (`apps/gateway/src/index.ts`).

### Smoke test

```bash
bash scripts/smoke-test.sh
```

Builds the client, boots a unified server on `:8080`, polls `GET /health`, opens a WebSocket and waits for the `hello` frame. It writes the server output to `server.log`. Two-browser race checks are still manual, and there is no CI gate yet.

## More documentation

- `AGENTS.md`: architecture reference, domain invariants and rules for coding agents.
- `spec.md`: the original project brief and scope.
