# Codebase Structure

**Analysis Date:** 2026-09-02

## Directory Layout

```
typing-race/
├── apps/
│   ├── server/                   # Bun WebSocket & HTTP backend service
│   │   ├── src/
│   │   │   ├── race/             # Core race game engine (FSM, scoring, validation, corpus)
│   │   │   ├── rooms/            # Room lifecycle, player management, IP rate limiting
│   │   │   ├── ws/               # WebSocket handlers, dispatch, broadcasting
│   │   │   ├── __tests__/        # Backend unit & integration test suites
│   │   │   ├── env.ts            # Environment variable validation
│   │   │   ├── index.ts          # Server entry point & Bun.serve setup
│   │   │   ├── logger.ts         # Pino logger configuration
│   │   │   ├── routes.ts         # HTTP routes (health check, clock sync API)
│   │   │   └── static.ts         # Static asset serving for production
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/                      # React 19 single-page application
│       ├── src/
│       │   ├── components/       # UI views (LobbyView, RaceView, CountdownView, ResultsBoard, GraceBanner)
│       │   ├── net/              # WebSocket client & NTP clock synchronization
│       │   ├── store/            # Zustand reactive client stores (race, cursor, clock, connection)
│       │   ├── __tests__/        # Frontend component & unit tests (Vitest)
│       │   ├── App.tsx           # Main application root orchestrating race states
│       │   ├── index.css         # Global stylesheets & typing accent styles
│       │   └── main.tsx          # React DOM entry point
│       ├── package.json
│       ├── tsconfig.json
│       └── vite.config.ts
├── packages/
│   └── shared/                   # Universal contracts shared across server & web
│       ├── src/
│       │   ├── codes.ts          # Room code generator & validator (nanoid)
│       │   ├── messages.ts       # Zod schemas for all client/server wire messages
│       │   ├── passages.ts       # Hand-curated 52-passage corpus & deck helpers
│       │   ├── race.ts           # Shared race domain types & RaceState enum
│       │   ├── index.ts          # Barrel export for shared package
│       │   └── __tests__/        # Shared schema & logic tests
│       ├── package.json
│       └── tsconfig.json
├── .planning/                    # GSD workflow state, phases, and codebase maps
├── package.json                  # Root monorepo workspace configuration
└── tsconfig.json                 # Base TypeScript compiler settings
```

## Directory Purposes

**`apps/server/src/race/`:**
- Purpose: Pure domain logic for race execution.
- Contains: FSM controller (`controller.ts`), anti-cheat validation (`validate-keystroke.ts`), net WPM and accuracy algorithms (`scoring.ts`), passage deck shuffling (`corpus.ts`), domain types (`types.ts`).
- Key files: `controller.ts`, `validate-keystroke.ts`, `scoring.ts`.

**`apps/server/src/rooms/`:**
- Purpose: Multiplayer room lifecycle and rate limiting.
- Contains: In-memory room store, player join/leave logic, socket re-binding on reconnect, IP rate limiter.
- Key files: `manager.ts`.

**`apps/server/src/ws/`:**
- Purpose: Real-time network transport.
- Contains: Inbound frame dispatch (`dispatch.ts`), outbound broadcast utilities (`broadcast.ts`), WebSocket metadata handlers (`handlers.ts`).
- Key files: `dispatch.ts`, `broadcast.ts`.

**`apps/web/src/components/`:**
- Purpose: Render game stages.
- Contains: `LobbyView.tsx`, `CountdownView.tsx`, `RaceView.tsx`, `ResultsBoard.tsx`, `GraceBanner.tsx`.
- Key files: `RaceView.tsx`, `ResultsBoard.tsx`.

**`apps/web/src/store/`:**
- Purpose: Client state management using Zustand.
- Contains: `race.ts` (passage text, char states, WPM), `cursor.ts` (opponent cursors, own index), `clock.ts` (NTP offset), `connection.ts` (status, playerId), `store-bridge.ts`.
- Key files: `race.ts`, `cursor.ts`.

**`packages/shared/src/`:**
- Purpose: Shared types, contracts, and constants.
- Contains: Wire message schemas (`messages.ts`), race states (`race.ts`), passage database (`passages.ts`), room code generator (`codes.ts`).
- Key files: `messages.ts`, `passages.ts`.

## Key File Locations

**Entry Points:**
- Server: `apps/server/src/index.ts`
- Client: `apps/web/src/main.tsx`
- App Component: `apps/web/src/App.tsx`

**Configuration:**
- Root dependencies: `package.json`
- Server port/env: `apps/server/src/env.ts`
- Vite proxy: `apps/web/vite.config.ts`

**Core Logic:**
- Anti-cheat keystroke verification: `apps/server/src/race/validate-keystroke.ts`
- WPM & accuracy scoring: `apps/server/src/race/scoring.ts`
- Room FSM transitions: `apps/server/src/race/controller.ts`

**Testing:**
- Server tests: `apps/server/src/__tests__/*.test.ts`
- Web tests: `apps/web/src/__tests__/*.test.ts`
- Shared tests: `packages/shared/src/__tests__/*.test.ts`

## Naming Conventions

**Files:**
- React components: PascalCase with `.tsx` (`RaceView.tsx`, `ResultsBoard.tsx`)
- Server modules & utilities: kebab-case with `.ts` (`validate-keystroke.ts`, `store-bridge.ts`)
- Tests: `[subject].test.ts` or `[Component].test.tsx` located in `__tests__/`

**Directories:**
- Plural or functional lowercase (`components/`, `store/`, `race/`, `rooms/`, `ws/`)

## Where to Add New Code

**New UI Feature / Modal:**
- Primary code: `apps/web/src/components/NewFeatureView.tsx`
- State: Extend or add store in `apps/web/src/store/`
- Tests: `apps/web/src/__tests__/NewFeatureView.test.tsx`

**New WebSocket Message Type:**
- Schema: Add schema to `packages/shared/src/messages.ts` and include in `clientToServerSchema` or `serverToClientSchema`
- Server Dispatch: Add handler in `apps/server/src/ws/dispatch.ts`
- Client Handler: Add frame branch in `apps/web/src/net/ws.ts`
- Tests: Add round-trip test in `packages/shared/src/__tests__/messages.test.ts`

**New Game Rule / Calculation:**
- Implementation: `apps/server/src/race/`
- Unit tests: `apps/server/src/__tests__/`

## Special Directories

**`.planning/`:**
- Purpose: GSD workflow artifacts, phase execution plans, research notes, and codebase maps.
- Generated: No (managed via GSD).
- Committed: Yes.

**`apps/web/dist/`:**
- Purpose: Compiled production frontend bundle.
- Generated: Yes (`bun run build`).
- Committed: No (in `.gitignore`).

---

*Structure analysis: 2026-09-02*
