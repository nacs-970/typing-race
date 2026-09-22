# Technology Stack and Tooling

**Analysis Date:** 2026-09-21  
**Project:** `typing-race` (Multiplayer Type-Racer Clone)  
**Repository Type:** Monorepo (Bun Workspaces)

---

## 1. Languages and Runtimes

| Layer | Language / Version | Runtime / Host | Purpose |
|-------|--------------------|----------------|---------|
| **Shared & Backend** | TypeScript 5.6.3 | Bun 1.3.2 (pinned; `>=1.3.2 <1.5.0`) | Universal schemas, Gateway server, Engine worker |
| **Frontend Web** | TypeScript 5.6.3 / TSX | Modern Browser (ES2022) | React 19 SPA, zero-commit cursor rendering |
| **Styling** | CSS3 / Tailwind CSS 4.3.3 | Browser / PostCSS / Vite | Design token palette, responsive utility layout |
| **Scripts & Ops** | Bash / Docker / Caddyfile | Linux / Container / Fly.io | Pre-flight check, local smoke test, proxying |

---

## 2. Monorepo Architecture and Workspaces

Configured via root [package.json](file:///home/nacs/Documents/git/typing-race/package.json):
```json
"workspaces": ["apps/*", "packages/*"]
```

### Workspace Packages

1. **`packages/shared` (`@typing-race/shared`)**
   - **Path:** `packages/shared/`
   - **Main:** `./src/index.ts`
   - **Bridge Exports:** `./src/bridge.ts`
   - **Role:** Contract definitions, Zod 4 wire message validation, passage corpus database, room code generation, and EventBridge interface implementations (`InMemoryEventBridge`, `RedisEventBridge`).

2. **`apps/gateway` (`@typing-race/gateway`)**
   - **Path:** `apps/gateway/`
   - **Main:** `src/index.ts`
   - **Role:** Edge connection layer handling client WebSockets (`Bun.serve<WsData>`), Hono HTTP endpoints (`/health`, `/api/server-time`), static asset serving (`/` and built SPA), IP rate limiting, heartbeat pings, and message dispatching across the EventBridge.

3. **`apps/engine` (`@typing-race/engine`)**
   - **Path:** `apps/engine/`
   - **Main:** `src/engine.ts`
   - **Role:** Headless race engine worker. Manages room state, 5-stage race FSM (`lobby` → `countdown` → `racing` → `grace` → `finished`), server-authoritative keystroke verification, 1Hz tick scheduler, scoring calculations (net WPM and accuracy), passage deck dealing, and graceful drain cycles.

4. **`apps/web` (`@typing-race/web`)**
   - **Path:** `apps/web/`
   - **Role:** Single Page Application built with React 19, Vite 8, Zustand 5, and Tailwind CSS 4. Handles optimistic typing input, text layout calculation via Pretext, hardware-accelerated opponent cursor extrapolation, clock synchronization, and cookie-based session reconnection.

---

## 3. Dependency Inventory

### Core Frameworks & Libraries
- **Bun Native HTTP & WS:** `Bun.serve<WsData>` for WebSocket connections, heartbeat detection, and socket upgrade.
- **Hono (`4.13.5`):** Ultra-light HTTP router mounted within the Gateway (`routes.ts`) for health and time synchronization endpoints.
- **React (`19.2.8`) & React DOM (`19.2.8`):** UI component framework for lobby, countdown, race HUD, and results.
- **Zustand (`5.0.15`):** Reactive state management across distinct client domains (`race`, `cursor`, `connection`, `clock`, `toast`).
- **Pretext (`@chenglou/pretext` `0.0.8`):** High-performance canvas-based text measurement and line-breaking for monospace fonts in the browser.
- **Tailwind CSS (`4.3.3`) & `@tailwindcss/vite` (`4.3.3`):** Utility-first styling engine with Vite plugin integration.

### Protocols & Data Validation
- **Zod (`4.5.4`):** Strict discriminated union runtime schema validation on both client and server wire boundaries (`messages.ts`, `race.ts`).
- **ioredis (`^5.4.1`):** Redis client powering `RedisEventBridge` for pub/sub messaging between Gateway and Engine.
- **Nanoid (`6.0.1`):** Custom 6-character uppercase alphanumeric room code generator avoiding ambiguous characters (`codes.ts`).
- **Pino (`10.3.1`) & Pino Pretty (`13.1.3`):** Structured JSON logging across Gateway and Engine with domain bracket prefixes (`[gateway]`, `[engine]`, `[ws]`, `[race]`, `[rooms]`).

---

## 4. Developer Workflows and Tooling

### Monorepo Scripts (`package.json`)

| Command | Action | Implementation |
|---------|--------|----------------|
| `bun run dev` | Full local multi-process dev environment | Concurrently runs `dev:web`, `dev:gateway`, `dev:engine` |
| `bun run dev:unified` | Single-process gateway + engine + web | Runs `dev:web` and `MODE=unified bun run dev:gateway` |
| `bun run dev:gateway` | Hot-reloading Gateway | `bun --hot run apps/gateway/src/index.ts` |
| `bun run dev:engine` | Hot-reloading Engine | `bun --hot run apps/engine/src/index.ts` |
| `bun run dev:web` | Vite frontend HMR server | `vite` in `apps/web` (port 5173 with proxy to 8080) |
| `bun run typecheck` | Strict monorepo typecheck | `tsc --noEmit` across `packages/shared`, `apps/web`, `apps/gateway`, `apps/engine` |
| `bun test` | Full test suite execution | `bun test` for shared/gateway/engine + `vitest run` for web |
| `bun run build` | Production client build | `apps/web`: `tsc --noEmit && vite build` with compression |
| `bun run start` | Production gateway boot | `bun run apps/gateway/src/index.ts` |

### Utility & Operational Scripts
- **`scripts/smoke-test.sh`:** 4-step local smoke test. Builds web bundle, launches unified server (`PORT=8080 MODE=unified`), polls `GET /health`, tests WebSocket handshake and awaits `hello` frame.
- **`scripts/deploy.sh`:** Pre-flight deployment verification checking Docker, Bun, Dockerfile, `fly.toml`, and built web distribution bundle.

---

## 5. Build and Infrastructure Artifacts

- **`Dockerfile`:** Multi-stage build (base `oven/bun:1.3.2-slim` → deps → client-build → release). Runs as unprivileged `bun` user, exposes port 8080, includes native container healthcheck.
- **`docker-compose.yml`:** Multi-service container topology defining:
  - `redis`: Redis 7 Alpine with healthcheck.
  - `engine`: Headless Engine connected to Redis.
  - `gateway`: Public WebSocket/HTTP gateway exposed on `8080:8080`.
  - `web`: Standalone static web container running on `5173:80`.
- **`fly.toml`:** Fly.io deployment manifest targeting the `ord` region with HTTP service configuration on internal port 8080 and TCP health checks.
- **`apps/web/Caddyfile`:** Production reverse-proxy and static asset server configuration with gzip/zstd compression and client-side history route fallback.
