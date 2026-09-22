# Architecture and Module Boundaries

**Analysis Date:** 2026-09-21  
**Project:** `typing-race`  
**System Pattern:** Server-Authoritative State Synchronization with Optimistic Client Rendering & Decoupled Event-Driven Transport

---

## 1. System Overview

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                   CLIENT LAYER                                   │
│  apps/web (React 19 + Zustand + Pretext + Tailwind CSS 4)                         │
│  ├── Components: LobbyView, CountdownView, RaceView, ResultsBoard, GraceBanner   │
│  ├── Core Engine: TypingEngine, CursorManager, PassageLayout                      │
│  ├── Stores: race, cursor, connection, clock, toast                               │
│  └── Network: ws.ts (auto-reconnect, cookie sessions), clock.ts (2-phase NTP)     │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ JSON WebSocket Frames (Zod-validated)
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                  GATEWAY LAYER                                   │
│  apps/gateway (Bun.serve + Hono Router)                                          │
│  ├── WebSocket Server: upgrade, 15s heartbeat, dispatch.ts                       │
│  ├── HTTP Router: /health, /api/server-time, static asset delivery               │
│  ├── ClientManager: socket mapping, room subscription tracking, drain state      │
│  └── Security: ipRateLimiter (10 rooms/hour per IP), payload size guards         │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ EventBridge (publishToEngine / publishToGateway)
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                         EVENT BRIDGE ABSTRACTION LAYER                           │
│  packages/shared/src/bridge.ts                                                   │
│  ├── InMemoryEventBridge: In-process EventEmitter (Unified Mode)                 │
│  ├── LoopbackIpcClient / Server: Local WebSocket IPC bridge (Split Mode)          │
│  └── RedisEventBridge: Pub/Sub over Redis channels (Distributed Mode)            │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ GatewayToEngineEvent / EngineToGatewayEvent
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                   ENGINE LAYER                                   │
│  apps/engine (Headless Game Engine Worker)                                       │
│  ├── RoomStore: InMemoryRoomStore (room & player memory cache)                   │
│  ├── RoomManager: Room creation, player join/leave, 60s disconnect grace         │
│  ├── RaceController: 5-state FSM (lobby→countdown→racing→grace→finished), 1Hz tick│
│  ├── Anti-Cheat Keystroke Validator: 4-tier server checks, monotonic progress    │
│  ├── Scoring: Net WPM, accuracy, finishing criteria                              │
│  └── Passage Corpus: 52 curated texts, Fisher-Yates deck shuffle                 │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Deployment and Operating Modes

The codebase natively supports three runtime topologies configured via environment variables (`MODE`, `REDIS_URL`, `ENGINE_HOST`, `ENGINE_PORT`):

### A. Unified Mode (`MODE=unified`)
- **Execution:** A single Bun process boots `apps/gateway`, which dynamically imports and instantiates `EngineWorker` and `InMemoryRoomStore` from `@typing-race/engine`.
- **Bridge:** `InMemoryEventBridge` (synchronous Node.js `EventEmitter`).
- **Use Case:** Local single-process development (`bun run dev:unified`), single-container Docker releases, and automated smoke testing (`scripts/smoke-test.sh`).

### B. Split Mode (`MODE=split`)
- **Execution:** Gateway runs on port 8080; Engine runs as an independent headless worker on port 8081 without requiring external Redis.
- **Bridge:** `LoopbackIpcClient` (in Gateway) connects to `LoopbackIpcServer` (in Engine) via local WebSocket IPC.
- **Use Case:** Local microservice emulation and testing IPC decoupling without infrastructure dependencies.

### C. Distributed Mode (`REDIS_URL=redis://...`)
- **Execution:** Gateway and Engine operate as horizontally scalable isolated services configured in `docker-compose.yml`.
- **Bridge:** `RedisEventBridge` uses Redis pub/sub channels:
  - Inbound: `typing_race:to_engine` (`GatewayToEngineEvent`)
  - Outbound: `typing_race:to_gateway` (`EngineToGatewayEvent`)
- **Use Case:** Production container clusters and multi-container cloud deployments.

---

## 3. Module Boundaries and Responsibilities

### `packages/shared`
- **Wire Protocol (`messages.ts`):** Zod 4 schemas and inferred TypeScript types defining all client-to-server (`ClientToServer`) and server-to-client (`ServerToClient`) messages. Discriminated union types enforce type-safety across both ends.
- **Domain Models (`race.ts`):** `RaceState` (`lobby`, `countdown`, `racing`, `grace`, `finished`), `Player`, `Room`, `CharState` (`pending`, `correct`, `error`).
- **Passage Corpus (`passages.ts`):** 52 public-domain texts across diverse difficulties, quote categories, and code snippets.
- **Room Codes (`codes.ts`):** 6-character collision-resistant uppercase alphanumeric codes with ambiguous character suppression.
- **EventBridge (`bridge.ts`):** Universal transport interface decoupling Gateway network handling from Engine simulation.

### `apps/gateway`
- **`index.ts`:** Entry point. Manages Bun HTTP/WebSocket listener, bridge instantiation, heartbeat interval, and graceful drain lifecycle.
- **`ws/dispatch.ts`:** Inbound WebSocket message router. Deserializes raw frames, validates against `clientToServerSchema`, executes local rate limiting (`ipRateLimiter`), answers local frames (`ping`, `clock_sync`), and forwards game messages to Engine.
- **`ws/client-manager.ts`:** Tracks active player sockets, room-to-player mappings, and gateway drain states. Provides socket lookup for targeted unicasts and room-wide multicasts.
- **`ws/handlers.ts`:** Bun WebSocket lifecycle hooks (`open`, `message`, `close`, `drain`), hello handshake issuance, and outbound bridge subscription binder (`bindBridgeToGateway`).
- **`routes.ts` & `static.ts`:** Hono HTTP routing providing `/health`, `/api/server-time`, and static asset serving for the compiled client.

### `apps/engine`
- **`engine.ts` (`EngineWorker`):** Central orchestrator. Subscribes to inbound gateway events, ticks `RaceController` every 1,000ms, and implements the graceful drain loop with active-race polling.
- **`rooms/manager.ts` (`RoomManager`):** Room lifecycle, player additions, 60s disconnect grace management, host departures, and automatic host migration.
- **`rooms/store.ts` (`RoomStore`):** Storage abstraction interface with `InMemoryRoomStore` implementation.
- **`race/controller.ts` (`RaceController`):** Deterministic 5-state FSM controller managing countdown timers, race start broadcasts, first-finisher grace window initiation, and results compilation.
- **`race/validate-keystroke.ts`:** Anti-cheat pipeline executing 4 strict validation checks before accepting any typed character.
- **`race/scoring.ts`:** Net WPM formula (`max(0, (correct/5 - uncorrected/5)) / minutesElapsed`) and accuracy calculations.
- **`race/corpus.ts`:** Fisher-Yates deck shuffle and non-repeating passage dealer.

### `apps/web`
- **`core/typing-engine.ts`:** Client typing logic. Processes keydown events, evaluates character states, prevents backspacing over fully correct words, and emits keystroke/correction callbacks.
- **`core/layout.ts` (`PassageLayout`):** Pretext wrapper measuring subpixel character widths and line wraps for monospace fonts on canvas.
- **`core/cursor-manager.ts` (`CursorManager`):** 60fps render loop rendering remote opponent cursors. Uses 100ms snapshot buffer interpolation, linear extrapolation up to 150ms, distance-based fading beyond 5 words, and hardware-accelerated CSS `translate3d` transforms.
- **`net/ws.ts`:** Resilient browser WebSocket wrapper featuring exponential backoff, cookie-backed session storage (`typing_race_session_<CODE>`), and auto-reconnect.
- **`net/clock.ts`:** 2-phase NTP clock synchronization measuring roundtrip latency and calculating server time offset.
- **`store/`:** Specialized Zustand stores (`race.ts`, `cursor.ts`, `connection.ts`, `clock.ts`, `toast.ts`).

---

## 4. State Machines and Critical Lifecycles

### Race Finite State Machine (FSM)

```text
     ┌───────────┐
     │   lobby   │ ◄────────────────────────┐
     └─────┬─────┘                          │
           │ Host triggers start_race       │ Rematch /
           ▼                                │ Return to Lobby
     ┌───────────┐                          │
     │ countdown │ (3 seconds)              │
     └─────┬─────┘                          │
           │ Timer expires                  │
           ▼                                │
     ┌───────────┐                          │
     │  racing   │                          │
     └─────┬─────┘                          │
           │ First player finishes passage  │
           ▼                                │
     ┌───────────┐                          │
     │   grace   │ (default 5-10 seconds)   │
     └─────┬─────┘                          │
           │ Grace timer expires or all finish
           ▼                                │
     ┌───────────┐                          │
     │ finished  │ ─────────────────────────┘
     └───────────┘
```

- **Transitions:** Strictly guarded in `apps/engine/src/race/controller.ts` via `ALLOWED` lookup table. Invalid transitions throw `InvalidTransitionError`.
- **Authoritative Ticking:** Driven at 1Hz (`RaceController.tick(now)`). Pure time dependency injection ensures deterministic tests.

---

## 5. Anti-Cheat and Keystroke Validation Pipeline

Every typed character submitted via `keystroke` frame must pass 4 consecutive checks in [validate-keystroke.ts](file:///home/nacs/Documents/git/typing-race/apps/engine/src/race/validate-keystroke.ts):

1. **Server Timestamp Verification:** Frame's `clientTs` is ignored; server's own `Date.now()` (`now`) is authoritative.
2. **Race Timing & Grace Guards:**
   - Room state must be `"racing"` or `"grace"`.
   - `now >= startsAtServerMs + 50ms` (blocks start-countdown cheating).
   - Reconnected players must respect a 500ms post-reconnect throttle.
   - Finished players cannot submit further keystrokes.
3. **Minimum Interval Guard:**
   - `now - player.lastKeystrokeAt >= 20ms` (enforces max typing speed cap of 50 keystrokes/sec; blocks automated autoclickers).
4. **Character Match and Boundaries:**
   - Index must fall within passage bounds.
   - Space character boundaries are strictly enforced (no submitting spaces over characters, or characters over spaces).
   - Anti-gibberish spam guard: players cannot submit more than 5 consecutive uncorrected errors.

**Post-Validation:** Computes an immutable `charStates` snapshot (last-write-wins per position), calculates instantaneous net WPM, updates progress, and timestamps race completion if the final character is correct and accuracy $\ge 50\%$.

---

## 6. Disconnect, Reconnect, and Session Management

1. **Session Cookies:** Upon room creation or join, the client stores a session token in a scoped browser cookie (`typing_race_session_<CODE>`).
2. **Disconnect Grace Window:** When a WebSocket closes, Engine starts a 60-second grace timer instead of immediate removal. Opponents receive `player_disconnected` with the remaining timeout.
3. **Seamless Reconnection:** If the player re-opens or refreshes the tab within 60s, `rejoin_room` matches the session token and restores full player progress, character states, and WPM. Opponents receive `player_reconnected`.
4. **Host Migration:** If the room host leaves or disconnects and their 60s grace expires, the room automatically promotes the earliest joined remaining guest to host.
5. **Multi-Tab Session Takeover:** If a user opens the same room in another tab, the older connection is marked `session_taken_over` and its input is evicted. Clicking or focusing the inactive tab triggers session reclamation.

---

## 7. Graceful Drain and Shutdown Coordination

To guarantee that ongoing races finish before container restart (e.g. rolling deployments on Fly.io or Docker Compose restarts):

1. **Engine Drain Loop:** `EngineWorker.drain(timeoutMs = 90_000)` publishes `"draining"`, marks worker state, and polls active rooms every 500ms. It resolves when all active races reach `"finished"` or when the 90s hard timeout triggers. Once finished, it publishes `"drained"`.
2. **Gateway Latch Coordination:**
   - Inbound `"draining"` causes Gateway to reject new `create_room`, `join_room`, and `start_race` commands with `SERVER_SHUTTING_DOWN`.
   - Gateway tracks its own drain cycle via `markOwnDrainStarted()` and `announceShuttingDownOnce()`.
   - Standalone Engine restarts in Split/Redis mode do not cause a stale `"drained"` latch to wedge subsequent Gateway drain cycles (`setDrained(false)` on Gateway shutdown).
