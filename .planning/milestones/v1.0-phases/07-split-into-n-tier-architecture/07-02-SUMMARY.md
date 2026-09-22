# Phase 7 Plan 02 Summary: Gateway Tier Extraction & Legacy Cutover

## Overview
Extracted real-time WebSocket ingress, HTTP routes, client socket mappings, NTP clock sync, and IP rate limiting into `apps/gateway`. Established dual-mode orchestration (unified single-process and split multi-process), updated monorepo scripts, and completed legacy cutover from monolithic `apps/server` to the 3-tier architecture.

## User-Observable Achievements

1. **Dedicated Gateway Tier (`apps/gateway`)**:
   - Handles Bun-native WebSocket connections, upgrades, and 15s/5s heartbeat ping/pongs.
   - Zero game logic: validates wire schema frames via Zod and dispatches them over `EventBridge`.
   - LRU rate limiter restricting room creation to 10 per hour per IP.
   - Serves HTTP `/health` and `/api/clock-sync`, plus static SPA asset fallback for unified single-container deploys.

2. **Dual-Mode Local Development**:
   - `bun run dev`: Boots `web` (:5173), `gateway` (:8080), and `engine` (:8081) concurrently using `LoopbackIpcClient` and `LoopbackIpcServer`.
   - `bun run dev:unified`: Boots `web` (:5173) and unified `gateway` (:8080) running gateway + engine in a single process via `InMemoryEventBridge`.

3. **Complete Legacy Cutover (D-09)**:
   - Retired monolithic `apps/server`.
   - Updated root `package.json` scripts (`dev`, `dev:unified`, `dev:web`, `dev:gateway`, `dev:engine`, `typecheck`, `test`, `start`).
   - Updated Vite proxy in `apps/web/vite.config.ts` to forward `/ws`, `/api`, and `/health` to `GATEWAY_PORT || PORT || 8080`.
   - Updated root single-deploy `Dockerfile` to package `apps/gateway` and `apps/engine` in unified mode.

## Tasks Completed & Commits

- **Task 1: Scaffold apps/gateway & HTTP Endpoints with Static Asset Serving (D-01, D-05)**
  - Created package configuration, tsconfig, env, Pino logger, NTP clock sync, IP rate limiter, and Hono routes with static asset fallback.
  - Ported NTP clock sync and rate limiter unit tests.
  - Commit: `ed55f65` (`feat(07-02): scaffold apps/gateway and http endpoints with static asset serving`)

- **Task 2: WebSocket Ingress, Client Manager & EventBridge Dispatch (D-01, D-06, D-08)**
  - Implemented `ClientManager` tracking sockets and room memberships.
  - Implemented Bun WebSocket handlers with 15s heartbeat pings and 5s pong timeouts.
  - Created `dispatch.ts` parsing frames, validating schemas, enforcing IP rate limits, and forwarding to `EventBridge`.
  - Created `LoopbackIpcClient` with automatic reconnect backoff.
  - Commit: `d889cda` (`feat(07-02): websocket ingress, client manager, and eventbridge dispatch`)

- **Task 3: Dual-Mode Gateway Entrypoint & Integration Tests (D-02, D-04, D-05, D-06)**
  - Implemented `startGateway()` entrypoint supporting Redis, unified in-memory, and split loopback IPC modes.
  - Added `ws-lifecycle.test.ts` (connection, ping/pong, error frames, health routes).
  - Added `gateway.test.ts` (full multi-client race flow in unified mode).
  - Exported `InMemoryRoomStore` from `@typing-race/engine`.
  - Commit: `1a26ede` (`feat(07-02): dual-mode gateway entrypoint and integration tests`)

- **Task 4: Monorepo Orchestration Scripts & Legacy Cutover (D-04, D-09)**
  - Updated root `package.json` scripts for 3-tier execution.
  - Updated `apps/web/vite.config.ts` dev proxy.
  - Re-pointed web client unit tests from `apps/server/src/race/scoring` to `apps/engine/src/race/scoring`.
  - Removed obsolete `apps/server` codebase and updated root `Dockerfile`.
  - Commit: `802ba24` (`chore(07-02): monorepo orchestration scripts and legacy cutover`)

## Verification Results

1. **TypeScript Typecheck**:
   - `packages/shared`: 0 errors
   - `apps/web`: 0 errors
   - `apps/gateway`: 0 errors
   - `apps/engine`: 0 errors

2. **Automated Test Suites**:
   - `bun test packages/shared apps/gateway apps/engine`: 122 passed, 0 failed across 20 files.
   - `bun run --cwd apps/web test`: 74 passed, 0 failed across 11 files.
   - Total: 196 tests passing across all tiers.

## Deviations from Plan

- None. All requirements delivered according to specification and architecture decisions.
