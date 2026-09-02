<!-- refreshed: 2026-09-02 -->
# Architecture

**Analysis Date:** 2026-09-02

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                           Client UI Layer                               │
│  `apps/web/src/App.tsx`                                                 │
│  ├── `components/LobbyView.tsx`      ├── `components/RaceView.tsx`       │
│  ├── `components/CountdownView.tsx`  ├── `components/ResultsBoard.tsx`   │
│  └── `components/GraceBanner.tsx`                                       │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ React Hooks & Store Subscriptions
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       Client Store & Net Layer                          │
│  `apps/web/src/store/` (race, cursor, clock, connection, store-bridge)   │
│  `apps/web/src/net/ws.ts` (WebSocket client, cookie session cache)      │
│  `apps/web/src/net/clock.ts` (2-phase NTP clock synchronization)        │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ JSON WebSocket Frames
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Shared Wire Contract (Zod 4)                         │
│  `packages/shared/src/messages.ts` (Discriminated union C→S and S→C)    │
│  `packages/shared/src/race.ts` (RaceState FSM, Player types)            │
│  `packages/shared/src/passages.ts` (Curated corpus & deck helpers)      │
│  `packages/shared/src/codes.ts` (Custom alphabet room code generator)   │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Type-safe validated payloads
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       Server Transport Layer                            │
│  `apps/server/src/index.ts` (Bun.serve, WS heartbeat, upgrade)          │
│  `apps/server/src/ws/dispatch.ts` (Inbound message validator/router)    │
│  `apps/server/src/ws/broadcast.ts` (Outbound room broadcaster)          │
│  `apps/server/src/ws/handlers.ts` (Connection metadata & hello/pong)    │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Authoritative mutations
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      Server Race Engine & State                         │
│  `apps/server/src/race/controller.ts` (1Hz FSM ticker: countdown/race)  │
│  `apps/server/src/race/validate-keystroke.ts` (Anti-cheat validator)    │
│  `apps/server/src/race/scoring.ts` (Net WPM & accuracy formulas)        │
│  `apps/server/src/race/corpus.ts` (Fisher-Yates shuffle & deck walk)    │
│  `apps/server/src/rooms/manager.ts` (In-memory rooms & IpRateLimiter)   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| **WS Server** | Native Bun WebSocket lifecycle, heartbeat, and connection upgrades | `apps/server/src/index.ts` |
| **WS Dispatcher** | Validates inbound frames via Zod and routes to domain actions | `apps/server/src/ws/dispatch.ts` |
| **Room Manager** | In-memory room CRUD, player joins/leaves, session rebinding, IP rate limit | `apps/server/src/rooms/manager.ts` |
| **Race Controller** | 5-state FSM transitions (lobby/countdown/racing/grace/finished), 1Hz ticker | `apps/server/src/race/controller.ts` |
| **Keystroke Validator** | 4-step anti-cheat checks (state guard, rate limits, char match, 500ms grace) | `apps/server/src/race/validate-keystroke.ts` |
| **Scoring Engine** | Standard net WPM (`(correctChars / 5) - uncorrectedErrors`) and accuracy | `apps/server/src/race/scoring.ts` |
| **Passage Corpus** | 52 public-domain texts, Fisher-Yates deck shuffle, and no-repeat dealing | `packages/shared/src/passages.ts`, `apps/server/src/race/corpus.ts` |
| **Shared Schemas** | Single source of truth for all wire protocol types using Zod 4 | `packages/shared/src/messages.ts` |
| **WS Client** | Browser WebSocket wrapper, frame parsing, store synchronization, cookies | `apps/web/src/net/ws.ts` |
| **Clock Sync** | Client-side 2-phase NTP algorithm measuring server time offset | `apps/web/src/net/clock.ts` |
| **RaceView** | Typing interaction, optimistic own cursor, live char-level accents, opponent cursors | `apps/web/src/components/RaceView.tsx` |

## Pattern Overview

**Overall:** Server-Authoritative State Synchronization with Optimistic Client Rendering.

**Key Characteristics:**
- **Server Authoritative:** The server validates every keystroke, calculates WPM/accuracy, advances monotonic progress, and owns race state timers.
- **Optimistic Local Echo:** The typing client moves its local cursor forward immediately on keypress, while the server validates asynchronously and broadcasts verified progress to opponents at 10Hz.
- **Contract-First Wire Protocol:** Outbound and inbound messages are validated at both boundaries using shared Zod schemas (`packages/shared/src/messages.ts`).

## Layers

**UI Layer (`apps/web/src/components/`):**
- Purpose: Render game stages (lobby, countdown, race track, results) and capture player input.
- Location: `apps/web/src/components/`, `apps/web/src/App.tsx`
- Contains: React components, keyboard event handlers.
- Depends on: Zustand stores (`apps/web/src/store/`), shared types.
- Used by: End user browser.

**Client Network & State (`apps/web/src/net/`, `apps/web/src/store/`):**
- Purpose: Maintain reactive client state, manage WebSocket connection, handle cookies and reconnection.
- Location: `apps/web/src/net/`, `apps/web/src/store/`
- Contains: Zustand stores, `WsConnection`, `syncClock`.
- Depends on: Shared message schemas.
- Used by: React UI layer.

**Shared Domain (`packages/shared/src/`):**
- Purpose: Universal types, wire message contracts, passage database, room code generation.
- Location: `packages/shared/src/`
- Contains: Zod schemas, TypeScript types, static constants.
- Depends on: `zod`, `nanoid`.
- Used by: Both `apps/server` and `apps/web`.

**Server Domain & Game Logic (`apps/server/src/race/`, `apps/server/src/rooms/`):**
- Purpose: Execute game rules, state transitions, anti-cheat validation, scoring, and room lifecycle.
- Location: `apps/server/src/race/`, `apps/server/src/rooms/`
- Contains: Pure scoring math, FSM controller, keystroke validation, in-memory room store.
- Depends on: Shared domain types.
- Used by: Server WS handlers and HTTP routes.

## Data Flow

### Primary Request Path: Keystroke to Opponent Cursor Update

1. **User Keypress:** User types character in `RaceView` (`apps/web/src/components/RaceView.tsx`).
2. **Local Echo:** `RaceView` advances local index optimistically and applies local color accent.
3. **Outbound Frame:** Sends `{ type: "keystroke", index, char, clientTs }` over WS (`apps/web/src/App.tsx`).
4. **Server Ingestion:** `Bun.serve` invokes `dispatch` (`apps/server/src/ws/dispatch.ts`).
5. **Anti-Cheat Validation:** `validateKeystroke` verifies state is racing/grace, rate limit >=20ms, reconnect grace >=500ms, and char matches expected (`apps/server/src/race/validate-keystroke.ts`).
6. **State Mutation:** Updates player's `progress`, `charStates`, `lastKeystrokeAt`, `uncorrectedErrors`, and `currentWpm`.
7. **Broadcast:** Server sends throttled (10Hz) `cursor_update` with verified `charStates` and `wpm` to opponents (`apps/server/src/ws/broadcast.ts`).
8. **Opponent Render:** Opponents receive frame and update cursor map (`apps/web/src/store/cursor.ts`), rendering opponent position on the track.

### Secondary Flow: Reconnection & Multi-Tab Takeover

1. **Disconnect:** Client socket drops. Server starts 60s grace (`apps/server/src/rooms/manager.ts:handlePlayerDisconnect`) and broadcasts `player_disconnected`.
2. **Rejoin Request:** Reopened tab reads `typing_race_${roomCode}` cookie and sends `{ type: "rejoin_room", roomCode, sessionToken }` (`apps/web/src/net/ws.ts`).
3. **Session Rebind:** Server validates session token, closes any previous socket with `session_taken_over`, re-binds player to new socket, and cancels disconnect timer (`apps/server/src/rooms/manager.ts:rebindPlayerSocket`).
4. **Authoritative Snapshot:** Server sends `rejoined_room` containing full room state, passage, player progress, char states, and opponent list.
5. **Client Hydration:** Client restores all Zustand stores, resuming race without UI desync.

## Key Abstractions

**Player:**
- Purpose: Represents an active or reconnecting participant in a room with timing and scoring telemetry.
- Examples: `apps/server/src/race/types.ts:Player`
- Pattern: In-memory domain entity.

**Room:**
- Purpose: Aggregate root managing room code, player collection, passage deck, and race FSM state.
- Examples: `apps/server/src/race/types.ts:Room`
- Pattern: Aggregate root.

**Discriminated Union Wire Message:**
- Purpose: Type-safe, runtime-validated message passing over WebSockets.
- Examples: `packages/shared/src/messages.ts:serverToClientSchema`, `clientToServerSchema`
- Pattern: Discriminated union on `"type"`.

## Entry Points

**Server Entry:**
- Location: `apps/server/src/index.ts`
- Triggers: `bun run dev` or `bun run start`.
- Responsibilities: Launches HTTP server, handles WebSocket upgrades, runs 15s heartbeat and 1Hz race ticker.

**Client Entry:**
- Location: `apps/web/src/main.tsx`
- Triggers: Browser loading `index.html`.
- Responsibilities: Mounts React root, renders `App.tsx`, establishes WebSocket connection, runs NTP clock sync.

## Architectural Constraints

- **Threading:** Single-threaded asynchronous event loop (Bun / JavaScript runtime). No locks required for in-memory room mutations.
- **Global State:** Room collection `rooms` (`Map<string, Room>`) and `ipRateLimiter` (`IpRateLimiter`) live in server process memory (`apps/server/src/rooms/manager.ts`). Data does not persist across server restarts.
- **Stateless Client:** Client Zustand stores can be reconstructed entirely from server state frames (`joined_room` or `rejoined_room`).

## Anti-Patterns

### Trusting Client-Supplied Timestamps

**What happens:** Client sends `clientTs` on keystroke or clock sync frames.
**Why it's wrong:** Client device clocks can be altered, drifted, or malicious.
**Do this instead:** Server always uses server-local monotonic timestamps (`Date.now()`) for race duration and interval checks (`apps/server/src/race/validate-keystroke.ts`).

### Instant Eviction on Socket Drop

**What happens:** Removing player immediately on WebSocket close during a live race.
**Why it's wrong:** Causes race disruptions, lost progress, and broken multiplayer games on brief mobile network blips.
**Do this instead:** 60-second graceful disconnect window (`apps/server/src/rooms/manager.ts:handlePlayerDisconnect`) allowing session resumption.

## Error Handling

**Strategy:** Fail closed on security/validation bounds; graceful recovery on network interruptions.

**Patterns:**
- Schema validation: Inbound frames failing `safeParse` are rejected or dropped with `{ type: "error", code, message }`.
- Broadcast resilience: Errors sending to individual sockets in `broadcastToRoom` are trapped so one faulty connection cannot crash the server or block other players.

## Cross-Cutting Concerns

**Logging:** Pino structured logging with contextual metadata (`playerId`, `roomCode`, `wpm`).
**Validation:** Zod schemas applied at all network boundaries.
**Authentication:** UUID session tokens cached in browser cookies.

---

*Architecture analysis: 2026-09-02*
