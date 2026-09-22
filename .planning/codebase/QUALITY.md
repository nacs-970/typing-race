# Code Quality Signals

**Analysis Date:** 2026-09-21  
**Project:** `typing-race`  
**Quality Scorecard:** Comprehensive test coverage (241 passing tests), strict static typing across monorepo, zero type errors, standardized structured logging, and automated smoke verification.

---

## 1. Test Suite Summary and Health

The codebase maintains automated testing across backend, shared contracts, and client React UI.

| Package | Test Runner | Framework / Environment | Test Files | Total Tests | Status |
|---------|-------------|-------------------------|------------|-------------|--------|
| `packages/shared` | Bun Test (`bun:test`) | Native Bun runtime | 5 | 25 | **Passing** |
| `apps/gateway` | Bun Test (`bun:test`) | Native Bun runtime | 5 | 40 | **Passing** |
| `apps/engine` | Bun Test (`bun:test`) | Native Bun runtime | 13 | 88 | **Passing** |
| `apps/web` | Vitest (`vitest run`) | Happy DOM + React Testing Library | 13 | 88 | **Passing** |
| **Total** | | | **36** | **241** | **100% Pass** |

### Test Inventory by Domain

#### Shared Domain (`packages/shared/src/__tests__/`)
- `messages.test.ts`: Zod schema validation for all client and server wire frames.
- `codes.test.ts`: 6-character room code randomness, regex conformance, and collision resistance.
- `passages.test.ts`: Corpus integrity, word count, character bounds, and quote lookups.
- `bridge.test.ts`: `InMemoryEventBridge` and `RedisEventBridge` pub/sub delivery.
- `bun-version-pin.test.ts`: Enforces Bun version pinning consistency.

#### Gateway Transport (`apps/gateway/src/__tests__/`)
- `gateway.test.ts`: Bun HTTP server startup, `/health` endpoint, static routing.
- `ws-lifecycle.test.ts`: WebSocket upgrade, `hello` handshake frame, ping/pong echo.
- `rate-limit.test.ts`: Per-IP room creation rate limiting (10 rooms/hour).
- `clock.test.ts`: NTP clock sync frame handling and offset stamping.
- `drain.test.ts`: Gateway shutdown latching, drain coordination, and connection termination.

#### Game Engine (`apps/engine/src/__tests__/`)
- `validate-keystroke.test.ts`: 4-tier anti-cheat pipeline, monotonic indices, space boundaries, spam caps.
- `scoring.test.ts`: Net WPM formulas, negative clamping, error penalties, accuracy math.
- `race-controller.test.ts`: FSM state transitions, 3s countdown duration, 1Hz ticker.
- `race-end.test.ts`: First-finisher trigger, grace duration timing, results aggregation.
- `rooms.test.ts`: Room creation, player join/leave, capacity limits, host migration.
- `char-states.test.ts`: Character state evaluation (`pending`, `correct`, `error`).
- `corpus.test.ts`: Fisher-Yates deck shuffle and non-repeating passage dealer.
- `disconnect.test.ts`: 60-second disconnect grace window and automatic eviction.
- `reconnect.test.ts`: Session token validation, state recovery, and player re-attachment.
- `loopback-ipc.test.ts`: WebSocket loopback IPC server/client bridge communication.
- `drain.test.ts`: Engine worker active-race polling and graceful shutdown timeout.
- `engine.test.ts`: Inbound message dispatching and room manager integration.

#### Web Frontend (`apps/web/src/__tests__/`)
- `typing-engine.test.ts`: Local keyboard handling, backspace locking on error-free words, error correction.
- `cursor-manager.test.ts`: Snapshot buffering, linear interpolation, 150ms extrapolation, distance fading.
- `layout.test.ts`: Canvas monospace text measurement and Pretext line-wrapping coordinates.
- `race-client.test.ts`: WebSocket connection state and message dispatching.
- `clock.test.ts`: Client-side 2-phase NTP algorithm and roundtrip latency estimation.
- `App.test.tsx`: Top-level SPA view switching and session takeover handling.
- `LobbyView.test.tsx`: Host controls, player list, ready states, passage selection.
- `CountdownView.test.tsx`: 3-2-1 visual countdown animation.
- `RaceView.test.tsx`: Race HUD, typing passage display, cursor overlay integration.
- `RaceHud.test.tsx`: Real-time WPM, accuracy, progress metrics rendering.
- `ResultsBoard.test.tsx`: Leaderboard placement, rematch triggers, lobby return.
- `GraceBanner.test.tsx`: Active grace window countdown display.
- `ReconnectBanner.test.tsx` & `ToastQueue.test.tsx`: Disconnect warnings, notifications, and banners.

---

## 2. Static Analysis and Type Safety

### TypeScript Configuration
- Root configuration in [tsconfig.base.json](file:///home/nacs/Documents/git/typing-race/tsconfig.base.json) extends strict flags:
  ```json
  {
    "compilerOptions": {
      "target": "ESNext",
      "module": "ESNext",
      "moduleResolution": "bundler",
      "strict": true,
      "noImplicitAny": true,
      "strictNullChecks": true,
      "skipLibCheck": true,
      "allowImportingTsExtensions": true
    }
  }
  ```
- **Monorepo Typecheck:** Executed via `bun run typecheck`. All 4 packages compile with zero errors and zero warnings.

### Linting and Formatting
- **ESLint (`.eslintrc.json`):** Configured with `@typescript-eslint/parser` and `@typescript-eslint/recommended`.
- **Prettier (`.prettierrc`):** Standardized formatting with `printWidth: 100`, double quotes (`singleQuote: false`), semicolons required, and trailing commas on multiline structures (`trailingComma: "all"`).

---

## 3. Architecture and Coding Patterns

### Pure Functional Logic with Deterministic Time Injection
- Critical math and validation algorithms (`computeNetWpm`, `validateKeystroke`, `tick`, `calculateInterpolatedIndex`) avoid reading ambient clocks directly (`Date.now()` or `performance.now()`).
- By accepting an injected timestamp parameter (`now: number = Date.now()`), time-dependent race and ticker logic is tested deterministically without sleep delays or brittle timers.

### Discriminated Unions and Contract Enforcement
- WebSocket wire frames are defined as tagged discriminated unions in `messages.ts` with runtime validation via Zod schemas.
- Invalid incoming payloads are rejected at the edge in `apps/gateway/src/ws/dispatch.ts` prior to reaching the domain engine.

### Zero-Commit Cursor Rendering
- Rather than driving high-frequency opponent cursor coordinates through React state (which would trigger 60fps re-renders across the component tree), `CursorManager` mounts absolute HTML elements outside React.
- An independent `requestAnimationFrame` loop applies CSS hardware-accelerated transforms (`translate3d(x, y, 0)`), achieving smooth 60fps cursor animation with zero React render overhead.

### Structured Logging
- Pino JSON logger with subsystem prefixes:
  - `[gateway]`: Connection lifecycle, HTTP request logs, drain status.
  - `[ws]`: Socket connections, frame errors, rate limiting.
  - `[engine]`: Worker lifecycle, active race polling.
  - `[race]`: Race starts, completions, FSM transitions.
  - `[rooms]`: Room creation, player join/disconnect/reconnect events, host migration.

---

## 4. Automated Verification and Smoke Testing

### Local Smoke Pipeline (`scripts/smoke-test.sh`)
Automates full integration verification:
1. Compiles frontend client bundle via `bun run build`.
2. Boots unified server in the background (`PORT=8080 MODE=unified bun run start`).
3. Polls HTTP endpoint `GET /health` until 200 OK received.
4. Opens WebSocket connection to `ws://localhost:8080/ws` and confirms receipt of authoritative `hello` frame.
5. Cleans up server background process on exit trap.

### Deployment Pre-flight (`scripts/deploy.sh`)
Verifies deployment prerequisites before initiating container or cloud deployments:
- Validates Docker and Bun CLI availability.
- Confirms presence of `Dockerfile`, `fly.toml`, and built client bundle (`apps/web/dist/index.html`).
