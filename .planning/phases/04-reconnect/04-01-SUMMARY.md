---
phase: 04-reconnect
plan: 01
subsystem: reconnect-handshake
tags: [reconnect, sessionToken, handshake, dispatch]
status: completed
completed_at: 2026-09-02

# Dependency graph
requires:
  - phase: 02-race-engine
    provides: "Room manager + WS dispatch infrastructure"
  - phase: 03-race-track
    provides: "Full race track & char-state model"
provides:
  - "joinedRoomSchema carries sessionToken (UUID v4) on room create/join"
  - "rejoinRoomSchema validates { type: 'rejoin_room', roomCode, sessionToken }"
  - "SESSION_INVALID added to errorSchema"
  - "Player.sessionToken generated via crypto.randomUUID() on addPlayer"
  - "findPlayerBySessionToken helper in apps/server/src/rooms/manager.ts"
  - "rebindPlayerSocket helper in apps/server/src/rooms/manager.ts"
  - "dispatch.ts handles rejoin_room, validates sessionToken, and re-binds WebSocket"
  - "apps/server/src/__tests__/reconnect.test.ts (6 unit tests pass)"
affects:
  - 02 (rejoined_room snapshot hydration will use re-bound player socket)
  - 04 (disconnect timeout will check if player reconnected via sessionToken)

actuals:
  tasks: 3
  tests: 6

key-files:
  created:
    - apps/server/src/__tests__/reconnect.test.ts
  modified:
    - packages/shared/src/messages.ts
    - apps/server/src/race/types.ts
    - apps/server/src/ws/handlers.ts
    - apps/server/src/ws/broadcast.ts
    - apps/server/src/rooms/manager.ts
    - apps/server/src/ws/dispatch.ts
---

# Plan 04-01 Summary: sessionToken Issuance & Reconnect Handshake

Implemented sessionToken generation and the `rejoin_room` reconnect handshake for Phase 4:
1. **Wire Schemas**: Extended `joinedRoomSchema` with `sessionToken: z.string().uuid()`. Added `rejoinRoomSchema` to `clientToServerSchema` and `SESSION_INVALID` to `errorSchema`.
2. **Server Types & Manager**: Added `sessionToken` to `Player` interface and `WsData`. `addPlayer` generates a UUID v4 sessionToken. Added `findPlayerBySessionToken` and `rebindPlayerSocket` in `manager.ts`.
3. **Dispatch & Validation**: Added `case "rejoin_room"` in `dispatch.ts` to re-bind the new WebSocket connection to the existing player slot and send back confirmation.
4. **Verification**: 6 new unit tests in `apps/server/src/__tests__/reconnect.test.ts` pass, plus all existing 71 server tests and 9 web tests pass.
