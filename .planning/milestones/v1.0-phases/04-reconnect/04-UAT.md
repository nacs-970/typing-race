---
status: complete
phase: 04-reconnect
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md, 04-04-SUMMARY.md, 04-05-SUMMARY.md]
started: 2026-09-02
updated: 2026-09-03
---

## Current Test
<!-- All tests complete -->
awaiting: none

## Tests

### 1. Mid-race disconnect & seamless reconnect
expected: |
  Start a race between two tabs (Host and Guest).
  While typing, close or refresh Guest's tab.
  Host screen immediately displays amber toast: "Guest disconnected — waiting up to 60s for reconnect...".
  Race continues without interruption on Host's screen.
  Guest re-opens or reloads the room URL (#ABCDEF) within 60s.
  Guest immediately rejoins the race at their exact progress and typed characters (cursor at the latest character typed, NOT reset to the first character).
  Host sees green toast: "Guest reconnected!".
result: pass

### 2. Multi-tab session takeover
expected: |
  Join a room in Tab 1.
  Open the same room URL (#ABCDEF) in a new Tab 2 in the same browser.
  Tab 2 claims the session using the room's session cookie and renders the room/race state.
  Tab 1 receives session_taken_over notice and displays banner:
  "Session active in another tab: This room is currently open in another browser tab. This window has been disconnected."
  When the race finishes and players return to the lobby, opening a new tab cleanly renders the Lobby view (not a stuck 0s race view).
result: pass

### 3. 60-second eviction & host promotion
expected: |
  Host and Guest in room.
  Host closes tab or disconnects.
  Guest sees toast that Host disconnected.
  Wait 60s without Host reconnecting.
  Server evicts Host; Guest receives player_left and is automatically promoted to Host.
  Guest now sees host controls (passage picker / Start Race button).
  Refreshing the page (F5) within 60s does not destroy the room.
result: pass

### 4. Per-IP rate limiting
expected: |
  Creating up to 10 rooms within an hour succeeds.
  An 11th creation attempt from the same IP is rejected with error:
  "Too many rooms created from this IP. Limit is 10 per hour."
result: pass
source: automated

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0

## Gaps

- gap_id: G-04-1
  truth: "Guest immediately rejoins the race at their exact progress and typed characters with cursor positioned at the latest char typed, not reset to the first char."
  status: resolved
  resolved_by: 04-05-PLAN.md
  resolved_at: "2026-09-03"
  reason: "User reported: guest reconnect, reconnected person cursor start at the first char, not the lastest char of they typing"
  severity: major
  test: 1
  root_cause: "RaceView.tsx useEffect on [passageText] unconditionally resets ownIndex to 0 on mount"
  artifacts:
    - path: "apps/web/src/components/RaceView.tsx"
      issue: "useEffect on [passageText] resets ownIndex to 0 on mount, wiping reconnected progress"
  missing:
    - "Do not reset ownIndex to 0 on mount when rejoining an active race"
    - "Preserve useCursorStore ownIndex on RaceView mount"
  debug_session: .planning/debug/reconnect-cursor-reset.md

- gap_id: G-04-2
  truth: "When room returns to lobby or finishes, opening a new tab properly restores the lobby view (or results view if finished), resetting passageText and race view state if in lobby."
  status: resolved
  resolved_by: 04-05-PLAN.md
  resolved_at: "2026-09-03"
  reason: "User reported: when finished and back to lobby, new tab in host, it show finished 0s and typing view"
  severity: major
  test: 2
  root_cause: "rejoined_room snapshot retains passageText in lobby state; App.tsx uses passageText != null to render RaceView"
  artifacts:
    - path: "apps/server/src/ws/broadcast.ts"
      issue: "buildRejoinedRoomFrame sends passageText from prior race even when room is in lobby"
    - path: "apps/web/src/net/ws.ts"
      issue: "rejoined_room handler sets passageText unconditionally without checking roomState"
    - path: "apps/web/src/App.tsx"
      issue: "App.tsx routes to RaceView whenever passageText is not null"
  missing:
    - "Clear passageText and reset race state in rejoined_room when roomState is lobby"
    - "Deliver results in rejoined_room and set raceEndResults when roomState is finished"
  debug_session: .planning/debug/lobby-rejoin-renders-race-view.md

- gap_id: G-04-3
  truth: "When host disconnects and is evicted after 60s, guest is promoted to host with visible host controls in UI; refreshing does not destroy the room prematurely."
  status: resolved
  resolved_by: 04-05-PLAN.md
  resolved_at: "2026-09-03"
  reason: "User reported: 60s passed no host control, f5 back to create room/ join room view"
  severity: major
  test: 3
  root_cause: "App.tsx does not update isHost from lobby_state; manager.ts immediately evicts solo player on disconnect in lobby deleting the room"
  artifacts:
    - path: "apps/web/src/App.tsx"
      issue: "App.tsx ignores lobby_state broadcast and fails to update isHost upon host promotion"
    - path: "apps/server/src/rooms/manager.ts"
      issue: "handlePlayerDisconnect immediately removes solo player in lobby, destroying room on F5 reload"
  missing:
    - "Listen to lobby_state in App.tsx and update isHost for local player"
    - "Provide 60s disconnect grace window in lobby for players with active sessionToken"
  debug_session: .planning/debug/host-promotion-and-solo-disconnect.md
