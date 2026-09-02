# Coding Conventions

**Analysis Date:** 2026-09-02

## Naming Patterns

**Files:**
- React components: `PascalCase.tsx` (`RaceView.tsx`, `ResultsBoard.tsx`)
- Logic modules & utilities: `kebab-case.ts` (`validate-keystroke.ts`, `store-bridge.ts`, `scoring.ts`)
- Unit tests: `*.test.ts` or `*.test.tsx` located in a local `__tests__/` directory

**Functions:**
- camelCase with descriptive action prefixes (`computeNetWpm`, `validateKeystroke`, `dealNextPassage`, `broadcastToRoom`)
- Predicate functions prefixed with `is` or `has` (`isValidRoomCode`, `isValidPassageId`, `isWordCorrect`)

**Variables:**
- camelCase (`currentWpm`, `lastKeystrokeAt`, `countdownStartsAtServerMs`)
- Constants: UPPER_SNAKE_CASE (`MAX_PLAYERS_PER_ROOM`, `MIN_INTERVAL_MS`, `ROOM_CODE_REGEX`)

**Types & Schemas:**
- Types & Interfaces: PascalCase (`Player`, `Room`, `CharState`, `WsData`)
- Zod Schemas: camelCase ending in `Schema` (`keystrokeSchema`, `rejoinedRoomSchema`, `cursorUpdateSchema`)
- Inferred Types: PascalCase matching schema name (`Keystroke`, `RejoinedRoom`, `CursorUpdate`)

## Code Style

**Formatting:**
- Prettier configuration standard: 2-space indentation, semicolons required, double quotes or single quotes consistent per package.

**Linting:**
- Strict TypeScript configuration (`strict: true`, `noImplicitAny: true`).
- `allowImportingTsExtensions: true` with explicit `.ts` extensions in import paths across Bun workspace.

## Import Organization

**Order:**
1. External / library dependencies (`zod`, `react`, `hono`, `nanoid`, `bun:test`)
2. Monorepo shared packages (`@typing-race/shared`)
3. Internal domain modules and stores (`../race/scoring.ts`, `../store/race.ts`)
4. Types-only imports explicitly designated with `import type { ... }`

**Path Aliases:**
- Monorepo package workspace references (`@typing-race/shared` mapped via `package.json` workspaces).
- Relative imports (`./`, `../`) with explicit `.ts`/`.tsx` file extensions for Bun runtime compatibility.

## Error Handling

**Patterns:**
- **Wire Messages:** Discriminated union error frames:
  ```typescript
  ws.send(JSON.stringify({
    type: "error",
    code: "RATE_LIMITED",
    message: "Human-readable description"
  }));
  ```
- **Domain Errors:** Typed custom error subclasses for illegal operations (e.g. `InvalidTransitionError` in `apps/server/src/race/controller.ts`).
- **Validation Results:** Discriminated union return values (`{ ok: true, ... } | { ok: false, reason: ServerErrorCode }`) avoiding exception throwing on normal validation failures (`apps/server/src/race/validate-keystroke.ts`).

## Logging

**Framework:**
- Pino (`pino` `^9.6.0`) configured in `apps/server/src/logger.ts`.

**Patterns:**
- Structured JSON logging with metadata object passed as the first argument:
  ```typescript
  logger.info({ playerId: player.playerId, roomCode: room.code }, "[ws] rejoin_room successful");
  ```
- Informational tags in brackets (`[ws]`, `[race]`, `[rooms]`, `[controller]`).

## Comments

**When to Comment:**
- Decision records (cross-referencing project decisions like `D-05`, `D-11`).
- Anti-cheat logic and non-obvious mathematical nuances (e.g., net WPM clamp at zero, clock offset formula).
- Explaining design trade-offs (e.g. why `now` is injected into `tick(now)` for testability).

**JSDoc/TSDoc:**
- Used on exported public API functions and type definitions to describe parameter contracts and return shapes.

## Function Design

**Size:**
- Small, single-purpose functions (scoring calculations, string manipulations, array shuffles).

**Parameters:**
- Object destructuring for functions with 3+ arguments (`validateKeystroke({ room, player, frame, passageText, now })`).
- Time dependency injection (`now: number = Date.now()`) to enable fast, deterministic unit testing without mocking real system clocks.

**Return Values:**
- Immutable transformations: functions produce new objects or arrays rather than mutating inputs in-place (e.g. `shuffle` in `corpus.ts`, `computeAccuracy` in `scoring.ts`).

## Module Design

**Exports:**
- Named exports preferred over default exports across all shared and server code.
- Default exports reserved for route handlers (`routes.ts`, `static.ts`).

**Barrel Files:**
- Single barrel file `packages/shared/src/index.ts` re-exporting all messages, race types, codes, and passage corpus.

---

*Convention analysis: 2026-09-02*
