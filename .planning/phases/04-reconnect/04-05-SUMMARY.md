---
phase: 04-reconnect
plan: 05
subsystem: gap-closure
tags: [reconnect, cursor, lobby, takeover, host-promotion, eviction]
status: completed
completed_at: 2026-09-03
gap_closure: true
gap_ids: [G-04-1, G-04-2, G-04-3]

# Dependency graph
requires:
  - plan: 04-04
    provides: "disconnect UX and 60s grace period"
provides:
  - "Preserved ownIndex on RaceView mount during mid-race reconnect"
  - "Sanitized passage fields in buildRejoinedRoomFrame when roomState is lobby"
  - "resetRaceUi called on rejoined_room when roomState is lobby"
  - "App.tsx dynamic isHost update on lobby_state broadcasts"
  - "60s disconnect grace period for solo lobby players preventing room destruction on F5"
affects:
  - Phase 4 UAT verification & completion

actuals:
  tasks: 3
  tests: 88 server + 9 web + 25 shared = 122 passing

key-files:
  modified:
    - apps/web/src/components/RaceView.tsx
    - apps/server/src/race/controller.ts
    - apps/server/src/ws/broadcast.ts
    - apps/server/src/rooms/manager.ts
    - apps/server/src/__tests__/disconnect.test.ts
    - apps/web/src/net/ws.ts
    - apps/web/src/App.tsx
---

# Plan 04-05 Summary: Gap Closure for UAT Gaps G-04-1, G-04-2, and G-04-3

Resolved all 3 user-reported UAT gaps from Phase 4 verification:
1. **G-04-1 (Cursor Reset to 0 on Reconnect)**:
   - Removed `useEffect(() => updateOwnIndex(0), [passageText])` in `RaceView.tsx` which was unconditionally resetting cursor position to 0 on initial mount.
   - Preserved `initialIndex` from `useCursorStore.getState().ownIndex` and kept the `storeOwnIndex` subscription to correctly track reconnected typing progress.
2. **G-04-2 (Lobby / Finished Rejoin Stale Race View)**:
   - In `apps/server/src/race/controller.ts`, transitioning to `"lobby"` now nulls out `passageId`, `passageText`, `startsAtServerMs`, and resets player race stats.
   - In `apps/server/src/ws/broadcast.ts`, `buildRejoinedRoomFrame` sets passage fields to `null` if `room.state === "lobby"`.
   - In `apps/web/src/net/ws.ts`, `rejoined_room` calls `resetRaceUi()` when `msg.roomState === "lobby"` to cleanly render `LobbyView`.
3. **G-04-3 (Host Promotion in UI & Solo Lobby Disconnect Grace)**:
   - In `apps/web/src/App.tsx`, added a listener for `lobby_state` that matches the local player by ID and updates `isHost` state dynamically. When host is evicted after 60s, guest immediately receives host controls.
   - In `apps/server/src/rooms/manager.ts`, removed instant player eviction for solo lobby players in `handlePlayerDisconnect`, granting the standard 60s grace period instead. Page reloads (F5) no longer destroy the room before reconnection.
   - Updated `disconnect.test.ts` to assert that solo lobby players are granted 60s grace on disconnect and evicted only after 60s expires.
