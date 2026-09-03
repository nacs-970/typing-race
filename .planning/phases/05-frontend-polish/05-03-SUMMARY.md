---
phase: 05-frontend-polish
plan: 03
subsystem: lobby-readiness-and-countdown
tags: [lobby, readiness, set-ready, passage-filters, countdown, server-sync]
status: completed
completed_at: 2026-09-03

# Dependency graph
requires:
  - phase: 05-01
    provides: "RaceClient singleton and socket message contracts"
provides:
  - "Wire protocol set_ready frame and optional isReady boolean on PLAYER_SUMMARY"
  - "filterPassages helper in @typing-race/shared with length and punctuation filtering"
  - "LobbyView with empty state 'Waiting for Competitors', player readiness checkmarks, guest Ready Up toggle, and host Start / Force Start Race controls"
  - "CountdownView with dramatic motion-blurred 3-2-1 GO overlay synchronized to startsAtServerMs - clockOffsetMs"
  - "apps/web/src/__tests__/LobbyView.test.tsx (5 unit tests pass)"
  - "apps/web/src/__tests__/CountdownView.test.tsx (5 unit tests pass)"
affects:
  - 05-04 (Race HUD and ResultsBoard integration with RaceView and LobbyView)

actuals:
  tasks: 3
  tests: 10

key-files:
  created:
    - apps/web/src/__tests__/LobbyView.test.tsx
    - apps/web/src/__tests__/CountdownView.test.tsx
  modified:
    - packages/shared/src/messages.ts
    - packages/shared/src/passages.ts
    - packages/shared/src/__tests__/messages.test.ts
    - apps/server/src/race/types.ts
    - apps/server/src/ws/broadcast.ts
    - apps/server/src/ws/dispatch.ts
    - apps/server/src/__tests__/rooms.test.ts
    - apps/web/src/store/race.ts
    - apps/web/src/net/race-client.ts
    - apps/web/src/components/LobbyView.tsx
    - apps/web/src/components/CountdownView.tsx
---

# Plan 05-03 Summary: Lobby Readiness, Passage Filters & Synchronized Countdown Overlay

Delivered the lobby readiness features, passage filtering controls, and synchronized 3-2-1 GO countdown overlay (Wave 3):
1. **Wire Protocol & Server Dispatch**:
   - Added `set_ready` frame (`{ type: "set_ready", ready: boolean }`) and optional `isReady` to `PLAYER_SUMMARY`.
   - Updated server dispatch to mutate `player.isReady` and broadcast updated `lobby_state` to all connected clients in the room.
   - Preserved 100% backward compatibility with all Phase 1–4 message schemas.
2. **Passage Filtering**:
   - Exported `filterPassages` in `@typing-race/shared` supporting length filters ("all", "short", "medium", "long") and punctuation criteria.
3. **Lobby Readiness UI**:
   - Implemented empty state container ("Waiting for Competitors" with invite link copy) when solo in room.
   - Displayed individual racer readiness checkmarks (`✓ Ready` in Olive Leaf vs `Waiting…` in Cornsilk).
   - Provided guest "Ready Up" / "Cancel Ready" toggle buttons.
   - Equipped host with passage length & punctuation filter pills, random passage selector, and dynamic "Start Race" vs "Force Start Race" (with confirmation dialog) buttons.
4. **Synchronized 3-2-1 GO Countdown Overlay**:
   - Built dramatic full-screen countdown overlay calculating `remainingMs = (startsAtServerMs - clockOffsetMs) - Date.now()`.
   - Progresses smoothly through `3`, `2`, `1`, `GO!` with scaling and drop-shadow animations before fading out and notifying completion.
5. **Verification**:
   - 5 new LobbyView unit tests and 5 new CountdownView unit tests pass with 100% green assertions.
   - All 48 Vitest web tests and 115 Bun shared/server tests pass.

## Self-Check: PASSED
- `apps/web/src/__tests__/LobbyView.test.tsx`: on disk, verified.
- `apps/web/src/__tests__/CountdownView.test.tsx`: on disk, verified.
- Git commit `f171f68` contains production code and tests.
- All unit and integration tests pass.
