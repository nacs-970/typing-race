---
phase: 05-frontend-polish
plan: 01
subsystem: core-engine-architecture
tags: [typing-engine, cursor-manager, race-client, lerp, interpolation, architecture]
status: completed
completed_at: 2026-09-03

# Dependency graph
requires:
  - phase: 04-reconnect
    provides: "Auto-rejoin protocol, sessionToken cookies, and reconnection state hydration"
provides:
  - "Headless TypingEngine with pure event emitter API, optimistic char-states, and scoring calculations"
  - "Headless CursorManager with 100ms snapshot buffer, linear lerp math, 150ms extrapolation clamping, and rewind snapping"
  - "Centralized RaceClient singleton managing WebSocket lifecycle, sessionToken cookies, and store dispatch"
  - "Backward-compatible WsConnection wrapper in ws.ts"
  - "apps/web/src/__tests__/typing-engine.test.ts (8 unit tests pass)"
  - "apps/web/src/__tests__/cursor-manager.test.ts (9 unit tests pass)"
  - "apps/web/src/__tests__/race-client.test.ts (6 unit tests pass)"
affects:
  - 05-02 (Pretext multiline layout & translate3d cursor overlay mount)
  - 05-03 (Lobby readiness and countdown)
  - 05-04 (Race HUD and results board)

actuals:
  tasks: 3
  tests: 23

key-files:
  created:
    - apps/web/src/core/typing-engine.ts
    - apps/web/src/core/cursor-manager.ts
    - apps/web/src/net/race-client.ts
    - apps/web/src/__tests__/typing-engine.test.ts
    - apps/web/src/__tests__/cursor-manager.test.ts
    - apps/web/src/__tests__/race-client.test.ts
  modified:
    - apps/web/src/net/ws.ts
---

# Plan 05-01 Summary: Core Engine Modularity & Interpolation Math

Delivered the architectural refactoring pass for Phase 5 (Tracer Slice Wave 1):
1. **Headless TypingEngine**: Extracted pure TypeScript `TypingEngine` decoupling typing mechanics, keystroke normalization, backspace corrections, optimistic charStates, and scoring calculations from React component state. Emits `keystroke`, `correction`, `stats_updated`, and `finished` events.
2. **Headless CursorManager**: Implemented `CursorManager` featuring a 100ms fixed-delay snapshot buffer (`BUFFER_MS = 100`), clamped extrapolation (`MAX_EXTRAPOLATE_MS = 150`), linear lerp interpolation between snapshots, and immediate rewind snapping on backspace to eliminate backward lerp artifacts.
3. **Centralized RaceClient**: Created `RaceClient` singleton class handling WebSocket connection lifecycle, automatic rejoining, sessionToken cookie helpers (`typing_race_${roomCode}` with 24h max-age, SameSite=Lax), and state dispatch into Zustand stores. Integrated cleanly into `apps/web/src/net/ws.ts` to preserve 100% backward compatibility with all existing Phase 1–4 code.
4. **Verification**: 23 new unit tests across 3 test suites pass with 100% green assertions. All 122 existing tests across the monorepo continue to pass without regression.

## Self-Check: PASSED
- `apps/web/src/core/typing-engine.ts`: on disk, verified.
- `apps/web/src/core/cursor-manager.ts`: on disk, verified.
- `apps/web/src/net/race-client.ts`: on disk, verified.
- `apps/web/src/net/ws.ts`: on disk, verified.
- Git commit `9c74041` contains production code and tests.
- All unit tests pass.
