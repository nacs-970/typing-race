# Phase 7 Plan 01 Summary: Split into N-tier Architecture — Engine Extraction & EventBridge

## Overview
Decomposed race simulation and state management out of the monolithic server into an independent headless workspace `apps/engine`, backed by typed inter-service communication channels in `packages/shared/src/bridge.ts`.

## Key Deliverables & Achievements

1. **Canonical EventBridge Contracts & Implementations (`packages/shared/src/bridge.ts`)**:
   - Strongly-typed `GatewayToEngineEvent` and `EngineToGatewayEvent` wire schemas.
   - `InMemoryEventBridge` backed by `node:events` `EventEmitter` for local/unified execution.
   - `RedisEventBridge` backed by `ioredis` Pub/Sub (`typing_race:to_engine`, `typing_race:to_gateway`) for multi-instance scaling.

2. **Headless Race Engine (`apps/engine`)**:
   - Zero imports of WebSocket network handles or Bun-specific client connection types in domain models (`Player` has zero `wsRef`).
   - Ported pure race logic: `scoring.ts` (D-05 net WPM, D-06 accuracy), `corpus.ts` (D-04 deck shuffling), `validate-keystroke.ts` (anti-cheat timestamp & rate checks with TS narrowing fix), and `frames.ts` (ServerToClient frame builders).
   - Ported `RoomStore` interface and `InMemoryRoomStore`.

3. **Room Lifecycle & 60s Disconnect Grace (`apps/engine/src/rooms/manager.ts`, `apps/engine/src/race/controller.ts`)**:
   - `RoomManager` manages room creation, joins, evictions, host promotion, and disconnect grace.
   - `RaceController` executes FSM transitions and 1Hz tick loop (countdown expiry, first finisher grace trigger, race end, and 60-second disconnect grace eviction).
   - `EngineWorker` (`apps/engine/src/engine.ts`) subscribes to inbound events from `EventBridge` and routes commands.

4. **Loopback IPC Server & Standalone Entrypoint (`apps/engine/src/bridge/loopback-server.ts`, `apps/engine/src/index.ts`)**:
   - `LoopbackIpcServer` listens on internal port (default 8081) for split-mode local dev.
   - Standalone `index.ts` automatically activates `RedisEventBridge` when `REDIS_URL` is set, `LoopbackIpcServer` in split mode, or `InMemoryEventBridge` in unified mode.

## Verification Results

- `packages/shared`: 30 unit tests passed (messages, codes, passages, bridge).
- `apps/engine`: 80 unit & integration tests passed across 12 test suites:
  - `scoring.test.ts` (10 tests)
  - `corpus.test.ts` (8 tests)
  - `char-states.test.ts` (6 tests)
  - `frames.test.ts` (9 tests)
  - `validate-keystroke.test.ts` (22 tests)
  - `rooms.test.ts` (8 tests)
  - `race-controller.test.ts` (6 tests)
  - `race-end.test.ts` (3 tests)
  - `reconnect.test.ts` (3 tests)
  - `disconnect.test.ts` (3 tests)
  - `loopback-ipc.test.ts` (1 test)
  - `engine.test.ts` (1 test — full end-to-end integration flow)
- TypeScript: Typecheck clean across `packages/shared` and `apps/engine`.

## Deviations & Fixes

- Fixed TS narrowing on `finishedAtServerMs` in `apps/engine/src/race/validate-keystroke.ts`.
- Fixed invalid `" "` char-state fixture on line 500 of `validate-keystroke.test.ts`.
- Corrected room code duplication in `race-controller.test.ts` to prevent collisions in `InMemoryRoomStore`.
- Added `{ data: {} }` payload and port fallback in `LoopbackIpcServer` for Bun.serve upgrade compatibility.

## Commits
1. `feat(07-01): canonical event bridge contracts and implementations` (3c279eb)
2. `feat(07-01): scaffold apps/engine and port pure race logic` (6326a0d)
3. `feat(07-01): port room manager, controller, and engine worker with 60s grace` (e55dc40)
4. `feat(07-01): loopback ipc server, redis support and engine standalone entrypoint` (ae1723b)
