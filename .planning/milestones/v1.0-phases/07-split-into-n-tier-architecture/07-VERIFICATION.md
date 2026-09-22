---
status: passed
phase: 07-split-into-n-tier-architecture
verified_at: "2026-09-04T18:18:50+07:00"
requirements: [D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-08, D-09]
---

# Phase 07 Verification Report: Split into N-tier Architecture

## Goal Achievement Assessment

### Phase Goal
Split monolithic server into 3-tier architecture: `apps/web`, `apps/gateway`, `apps/engine`, `packages/shared`, with abstracted event bridge and zero-install in-memory fallback.

### Verdict: PASSED

The monolithic server (`apps/server`) has been completely decoupled and replaced with an N-tier monorepo architecture:
1. **Presentation Tier (`apps/web`)**: Pure static React 19 + Vite client with Tailwind CSS v4 and zero backend coupling.
2. **Real-Time Gateway Tier (`apps/gateway`)**: Ingress tier handling client WebSockets (`Bun.serve`), connection tracking (`ClientManager`), heartbeat ping/pong, IP rate limiting, NTP clock sync, and static asset serving in unified/production mode. Holds zero race simulation logic.
3. **Race Engine Tier (`apps/engine`)**: Headless worker executing authoritative race loop, 1Hz tick, FSM transitions, anti-cheat validation, scoring, and 60-second disconnect grace handling. Zero WebSocket or socket handles in domain types (`Player` has zero `wsRef`).
4. **Shared Contract Tier (`packages/shared`)**: Canonical wire protocol schemas, room codes, passages corpus, and typed `EventBridge` contracts (`GatewayToEngineEvent`, `EngineToGatewayEvent`, `InMemoryEventBridge`, `RedisEventBridge`).
5. **Event Bridge & Dual-Mode Local Dev**: Abstracted `EventBridge` allows running in unified mode (`MODE=unified`, single process with zero-copy in-memory EventEmitter) or split mode (`MODE=split`, 3 independent processes communicating via internal loopback IPC). Transparently activates `RedisEventBridge` when `REDIS_URL` is set.
6. **Containerization & Deployment**: Cloud-agnostic multi-stage Dockerfiles for each tier (`apps/web/Dockerfile`, `apps/gateway/Dockerfile`, `apps/engine/Dockerfile`), root `docker-compose.yml` with optional Redis 7, and preserved root `Dockerfile` fallback running in unified mode for Fly.io.

---

## Truth Verification Table

| Truth | Must-Have Claim | Actual Codebase Status | Evidence |
|-------|-----------------|------------------------|----------|
| 1 | EventBridge contract provides typed pub/sub channels between Gateway and Engine | ✅ Verified | [bridge.ts](file:///home/nacs/Documents/git/typing-race/packages/shared/src/bridge.ts#L5-L65) defines `GatewayToEngineEvent`, `EngineToGatewayEvent`, and `EventBridge` interface |
| 2 | `InMemoryEventBridge` implements `EventBridge` with `EventEmitter` for zero-dependency local/unified execution | ✅ Verified | [bridge.ts](file:///home/nacs/Documents/git/typing-race/packages/shared/src/bridge.ts#L67-L105) implements `InMemoryEventBridge` without network serialization |
| 3 | `RedisEventBridge` implements `EventBridge` with `ioredis` Pub/Sub for multi-instance scaling when `REDIS_URL` is provided | ✅ Verified | [bridge.ts](file:///home/nacs/Documents/git/typing-race/packages/shared/src/bridge.ts#L107-L174) implements `RedisEventBridge` on channels `typing_race:to_engine` and `typing_race:to_gateway` |
| 4 | `apps/engine` is completely headless with zero imports of `Bun.ServerWebSocket` or WebSocket network types in domain models | ✅ Verified | [types.ts](file:///home/nacs/Documents/git/typing-race/apps/engine/src/race/types.ts#L13-L44) decouples `Player` from network handles (`wsRef` removed). WebSocket import is confined strictly to loopback IPC adapter |
| 5 | `RoomManager` and `RaceController` manage room lifecycle, anti-cheat validation, and 60s disconnect grace timer without network handles | ✅ Verified | [controller.ts](file:///home/nacs/Documents/git/typing-race/apps/engine/src/race/controller.ts#L193-L206) evaluates `now - player.disconnectedAt >= 60000` on 1Hz tick and evicts via `RoomManager` |
| 6 | `LoopbackIpcServer` in `apps/engine` allows split-mode communication via a loopback WebSocket port | ✅ Verified | [loopback-server.ts](file:///home/nacs/Documents/git/typing-race/apps/engine/src/bridge/loopback-server.ts#L1-L105) listens on `ENGINE_HOST:ENGINE_PORT` and bridges Gateway frames |
| 7 | `apps/gateway` acts as real-time ingress tier, managing client WebSockets, HTTP health, clock sync, and IP rate limiting | ✅ Verified | [handlers.ts](file:///home/nacs/Documents/git/typing-race/apps/gateway/src/ws/handlers.ts), [routes.ts](file:///home/nacs/Documents/git/typing-race/apps/gateway/src/routes.ts), [ip-limiter.ts](file:///home/nacs/Documents/git/typing-race/apps/gateway/src/rate-limit/ip-limiter.ts) |
| 8 | Gateway holds zero game simulation rules or race state; forwards events to Engine via `EventBridge` | ✅ Verified | [dispatch.ts](file:///home/nacs/Documents/git/typing-race/apps/gateway/src/ws/dispatch.ts#L61-L71) parses frame schema and publishes `client_message` directly to `EventBridge` |
| 9 | Gateway serves static web assets in unified/production mode so single-container deployments like Fly.io serve the SPA | ✅ Verified | [static.ts](file:///home/nacs/Documents/git/typing-race/apps/gateway/src/static.ts) mounts `apps/web/dist` with precompressed gzip/brotli asset headers and SPA fallback |
| 10 | Gateway supports dual-mode operation: single-process unified mode (`MODE=unified`) and multi-process split mode (`MODE=split`) | ✅ Verified | [index.ts](file:///home/nacs/Documents/git/typing-race/apps/gateway/src/index.ts#L59-L75) dynamically loads `EngineWorker` in unified mode or connects via `LoopbackIpcClient` in split mode |
| 11 | Root `package.json` scripts allow running entire stack via `bun run dev` (split mode) or `bun run dev:unified` (single backend process) | ✅ Verified | [package.json](file:///home/nacs/Documents/git/typing-race/package.json#L7-L15) configures `dev`, `dev:unified`, `dev:web`, `dev:gateway`, `dev:engine`, `typecheck`, `test`, `start` |
| 12 | Vite dev server proxies `/ws`, `/api`, and `/health` directly to Gateway port 8080 | ✅ Verified | [vite.config.ts](file:///home/nacs/Documents/git/typing-race/apps/web/vite.config.ts#L97-L113) configures dev proxy with websocket support pointing to Gateway |
| 13 | Each architectural tier (`web`, `gateway`, `engine`) has an independent, production-ready, cloud-agnostic Dockerfile | ✅ Verified | [apps/web/Dockerfile](file:///home/nacs/Documents/git/typing-race/apps/web/Dockerfile), [apps/gateway/Dockerfile](file:///home/nacs/Documents/git/typing-race/apps/gateway/Dockerfile), [apps/engine/Dockerfile](file:///home/nacs/Documents/git/typing-race/apps/engine/Dockerfile) |
| 14 | `docker-compose.yml` defines multi-tier container topology (`web`, `gateway`, `engine`, `redis`) with healthchecks and dependency wiring | ✅ Verified | [docker-compose.yml](file:///home/nacs/Documents/git/typing-race/docker-compose.yml) validates clean via `docker compose config` |
| 15 | Root Dockerfile preserves unified single-container deployment compatibility for Fly.io fallback | ✅ Verified | [Dockerfile](file:///home/nacs/Documents/git/typing-race/Dockerfile) builds multi-stage image with non-root `bun` user, `/health` check, and `MODE=unified` entrypoint |
| 16 | Full test suite across shared, gateway, engine, and web passes with zero regressions | ✅ Verified | 122 backend tests + 74 web tests = 196 tests passing across 31 test files; 0 typecheck errors |

---

## Requirements Cross-Reference

Requirements for Phase 07 are formally defined in [07-CONTEXT.md](file:///home/nacs/Documents/git/typing-race/.planning/phases/07-split-into-n-tier-architecture/07-CONTEXT.md#L19-L44) and [ROADMAP.md](file:///home/nacs/Documents/git/typing-race/.planning/ROADMAP.md#L189-L208). All requirement IDs D-01 through D-09 are fully satisfied:

| Requirement ID | Specification Description | Realization in Codebase | Status |
|----------------|---------------------------|-------------------------|--------|
| **D-01** | 3-Tier Architecture with dedicated apps in monorepo: `apps/web`, `apps/gateway`, `apps/engine`, consuming `packages/shared`. | Monorepo structured with `apps/web`, `apps/gateway`, `apps/engine`, `packages/shared`. Package boundary and dependency graphs verified in `package.json` workspaces. | ✅ SATISFIED |
| **D-02** | Zero-install in-memory state by default. No local Redis daemon or Docker required. Transparently activate Redis adapter when `REDIS_URL` is supplied. | `InMemoryRoomStore` and `InMemoryEventBridge` used by default. `RedisEventBridge` activates dynamically in both Gateway and Engine when `REDIS_URL` is provided. | ✅ SATISFIED |
| **D-03** | Ephemeral matches and rooms. Active room state evaporates when the last player disconnects; no database required for core gameplay. | `RoomManager.removePlayer` evicts empty rooms from store. Controller purges rooms when grace expires. Zero external database required. | ✅ SATISFIED |
| **D-04** | Root `bun run dev` boots `web`, `gateway`, and `engine` concurrently. Dual-mode support allows running unified in single process (`MODE=unified`) or independent processes (`MODE=split`). Dedicated scripts for isolated debugging. | `package.json` contains `dev` (split), `dev:unified` (unified), `dev:web`, `dev:gateway`, `dev:engine`. Gateway entrypoint honors `MODE` toggle. | ✅ SATISFIED |
| **D-05** | Port assignments read from `.env` with automatic fallback defaults (`WEB_PORT=5173`, `GATEWAY_PORT=8080`, `ENGINE_PORT=8081`). Vite dev server proxies `/ws`, `/api`, `/health` to Gateway. | Configured in `apps/gateway/src/env.ts`, `apps/engine/src/env.ts`, and `apps/web/vite.config.ts`. Default ports: 5173, 8080, 8081. | ✅ SATISFIED |
| **D-06** | Abstracted Event Bridge with clean `publish`/`subscribe` interface. In-memory EventEmitter locally; Redis Pub/Sub or loopback IPC in distributed mode. | `packages/shared/src/bridge.ts` exports `EventBridge` interface, `InMemoryEventBridge`, and `RedisEventBridge`. `LoopbackIpcClient` and `LoopbackIpcServer` implement IPC bridge. | ✅ SATISFIED |
| **D-07** | Author cloud-agnostic Dockerfiles for each tier and root `docker-compose.yml` for multi-cloud deployment (GCP, AWS, Fly.io) without vendor lock-in. | `apps/web/Dockerfile` (Caddy), `apps/gateway/Dockerfile` (Bun), `apps/engine/Dockerfile` (Bun), root `docker-compose.yml`, root `Dockerfile` (unified Fly.io fallback). | ✅ SATISFIED |
| **D-08** | Split responsibility: Gateway manages client WebSockets, connection upgrades, ping/pong heartbeats. Engine owns room game state, 60s disconnect grace timer, host promotion, room eviction. | Gateway in `apps/gateway/src/ws/handlers.ts` and `client-manager.ts` manages socket lifecycle and heartbeats. Engine in `apps/engine/src/race/controller.ts` and `rooms/manager.ts` manages tick, grace timer, host promotion. | ✅ SATISFIED |
| **D-09** | Direct 3-tier cutover: Reorganize existing `apps/server` into `apps/gateway` and `apps/engine` cleanly in this phase. | Obsolete `apps/server` removed completely. All monorepo scripts, tests, web imports, and Dockerfiles cut over to 3-tier architecture. | ✅ SATISFIED |

---

## Verification Command Outputs

### 1. TypeScript Typecheck across all workspaces
```bash
$ bun run typecheck
$ bun run --cwd packages/shared typecheck && bun run --cwd apps/web typecheck && bun run --cwd apps/gateway typecheck && bun run --cwd apps/engine typecheck
$ tsc --noEmit
$ tsc --noEmit
$ tsc --noEmit
$ tsc --noEmit
# Exit code: 0
```

### 2. Backend Test Suites (`packages/shared`, `apps/gateway`, `apps/engine`)
```bash
$ bun test packages/shared apps/gateway apps/engine
# 122 pass
# 0 fail
# 121260 expect() calls
# Ran 122 tests across 20 files. [5.45s]
```

Test suites executed:
- `apps/engine/src/__tests__/scoring.test.ts` (10 tests)
- `apps/engine/src/__tests__/corpus.test.ts` (8 tests)
- `apps/engine/src/__tests__/char-states.test.ts` (6 tests)
- `apps/engine/src/__tests__/frames.test.ts` (9 tests)
- `apps/engine/src/__tests__/validate-keystroke.test.ts` (22 tests)
- `apps/engine/src/__tests__/rooms.test.ts` (8 tests)
- `apps/engine/src/__tests__/race-controller.test.ts` (6 tests)
- `apps/engine/src/__tests__/race-end.test.ts` (3 tests)
- `apps/engine/src/__tests__/reconnect.test.ts` (3 tests)
- `apps/engine/src/__tests__/disconnect.test.ts` (3 tests)
- `apps/engine/src/__tests__/loopback-ipc.test.ts` (1 test)
- `apps/engine/src/__tests__/engine.test.ts` (1 test)
- `apps/gateway/src/__tests__/clock.test.ts` (2 tests)
- `apps/gateway/src/__tests__/rate-limit.test.ts` (4 tests)
- `apps/gateway/src/__tests__/ws-lifecycle.test.ts` (5 tests)
- `apps/gateway/src/__tests__/gateway.test.ts` (1 test)
- `packages/shared/src/__tests__/messages.test.ts` (14 tests)
- `packages/shared/src/__tests__/passages.test.ts` (8 tests)
- `packages/shared/src/__tests__/codes.test.ts` (4 tests)
- `packages/shared/src/__tests__/bridge.test.ts` (4 tests)

### 3. Frontend Test Suite (`apps/web`)
```bash
$ bun run --cwd apps/web test
# Test Files  11 passed (11)
# Tests  74 passed (74)
# Duration  2.11s
```

Test suites executed:
- `layout.test.ts` (4 tests)
- `cursor-manager.test.ts` (12 tests)
- `clock.test.ts` (4 tests)
- `typing-engine.test.ts` (14 tests)
- `CountdownView.test.tsx` (5 tests)
- `ToastQueue.test.tsx` (4 tests)
- `RaceHud.test.tsx` (4 tests)
- `race-client.test.ts` (6 tests)
- `ResultsBoard.test.tsx` (8 tests)
- `RaceView.test.tsx` (7 tests)
- `LobbyView.test.tsx` (6 tests)

### 4. Production Web Client Build
```bash
$ bun run --cwd apps/web build
# $ tsc --noEmit && vite build
# vite v8.2.2 building client environment for production...
# dist/index.html                   0.39 kB │ gzip:   0.27 kB
# dist/assets/index-n7URBHiT.css   39.71 kB │ gzip:   7.73 kB
# dist/assets/index-C8OKX6-7.js   759.23 kB │ gzip: 224.38 kB │ map: 3,004.32 kB
# ✓ built in 1.87s
# ✨ [vite-plugin-compression]: gzip and brotli assets generated successfully
```

### 5. Multi-Container Orchestration (`docker-compose.yml`)
```bash
$ docker compose config
# Exited 0 with valid service topology:
# - redis (redis:7-alpine, port 6379, healthcheck ping)
# - engine (apps/engine/Dockerfile, REDIS_URL=redis://redis:6379, depends_on: redis healthy)
# - gateway (apps/gateway/Dockerfile, port 8080, healthcheck /health, depends_on: redis healthy, engine started)
# - web (apps/web/Dockerfile, port 5173 -> 80, depends_on: gateway)
```

---

## Conclusion

Phase 07 goal is fully achieved. The monolithic architecture has been cleanly split into an N-tier monorepo (`apps/web`, `apps/gateway`, `apps/engine`, `packages/shared`) backed by a canonical `EventBridge` interface with in-memory, loopback IPC, and Redis implementations. All requirements D-01 through D-09 are satisfied and verified by automated tests. Zero regressions were introduced across the 196-test monorepo suite.
