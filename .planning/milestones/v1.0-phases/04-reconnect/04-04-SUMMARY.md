---
phase: 04-reconnect
plan: 04
subsystem: disconnect-ux-grace
tags: [disconnect, reconnect, grace, eviction, toast]
status: completed
completed_at: 2026-09-02

# Dependency graph
requires:
  - plan: 04-01
    provides: "sessionToken issuance & rejoin_room handshake"
  - plan: 04-02
    provides: "rejoined_room snapshot & multi-tab takeover"
  - plan: 04-03
    provides: "15s heartbeat ping/pong"
provides:
  - "playerDisconnectedSchema and playerReconnectedSchema wire schemas"
  - "broadcastPlayerDisconnected and broadcastPlayerReconnected helpers"
  - "handlePlayerDisconnect initiates 60s grace period instead of abrupt removal"
  - "tick() evicts disconnected players after 60s with host migration"
  - "rejoin_room broadcasts player_reconnected"
  - "RaceView initializes ownIndex from useCursorStore for reconnect resumption"
  - "App.tsx renders real-time disconnect toasts and reconnected banner"
  - "apps/server/src/__tests__/disconnect.test.ts (5 unit tests pass)"
affects:
  - Phase 4 milestone completion & verification

actuals:
  tasks: 3
  tests: 5

key-files:
  created:
    - apps/server/src/__tests__/disconnect.test.ts
  modified:
    - packages/shared/src/messages.ts
    - apps/server/src/ws/broadcast.ts
    - apps/server/src/rooms/manager.ts
    - apps/server/src/index.ts
    - apps/server/src/ws/dispatch.ts
    - apps/server/src/race/controller.ts
    - apps/web/src/components/RaceView.tsx
    - apps/web/src/App.tsx
---

# Plan 04-04 Summary: Graceful Disconnect UX & 60s Grace Window

Implemented graceful disconnect handling, 60s reconnect grace window, opponent toast notifications, and ticker-driven eviction:
1. **Wire Schemas & Broadcasts**: Added `playerDisconnectedSchema` and `playerReconnectedSchema`. Implemented `broadcastPlayerDisconnected` and `broadcastPlayerReconnected` in `apps/server/src/ws/broadcast.ts`.
2. **Grace Period & Eviction**:
   - `handlePlayerDisconnect` in `rooms/manager.ts` starts 60s disconnect grace on socket drops in active rooms.
   - 1Hz `tick()` in `race/controller.ts` tracks disconnected players and evicts them after 60s (with automatic host migration).
   - `dispatch.ts` `rejoin_room` clears disconnect state and broadcasts `player_reconnected`.
3. **Web Client Polish**:
   - `RaceView` initializes `ownIndex` from `useCursorStore.getState().ownIndex` so reconnected players resume typing at their exact progress.
   - `App.tsx` listens for `player_disconnected`, `player_reconnected`, and `player_left`, rendering non-intrusive opponent waiting toasts and a green reconnect confirmation.
4. **Verification**: 5 new unit tests in `disconnect.test.ts` pass, plus all 83 existing server tests and 9 web tests pass.
