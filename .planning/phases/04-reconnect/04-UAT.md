---
status: testing
phase: 04-reconnect
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md, 04-04-SUMMARY.md]
started: 2026-09-02
updated: 2026-09-02
---

## Current Test

[awaiting user verification]

## Tests

### 1. Mid-race disconnect & seamless reconnect
expected: |
  Start a race between two tabs (Host and Guest).
  While typing, close or refresh Guest's tab.
  Host screen immediately displays amber toast: "Guest disconnected — waiting up to 60s for reconnect...".
  Race continues without interruption on Host's screen.
  Guest re-opens or reloads the room URL (#ABCDEF) within 60s.
  Guest immediately rejoins the race at their exact progress and typed characters.
  Host sees green toast: "Guest reconnected!".
result: pending

### 2. Multi-tab session takeover
expected: |
  Join a room in Tab 1.
  Open the same room URL (#ABCDEF) in a new Tab 2 in the same browser.
  Tab 2 claims the session using the room's session cookie and renders the room/race state.
  Tab 1 receives session_taken_over notice and displays banner:
  "Session active in another tab: This room is currently open in another browser tab. This window has been disconnected."
result: pending

### 3. 60-second eviction & host promotion
expected: |
  Host and Guest in room.
  Host closes tab or disconnects.
  Guest sees toast that Host disconnected.
  Wait 60s without Host reconnecting.
  Server evicts Host; Guest receives player_left and is automatically promoted to Host.
  Guest now sees host controls (passage picker / Start Race button).
result: pending

### 4. Per-IP rate limiting
expected: |
  Creating up to 10 rooms within an hour succeeds.
  An 11th creation attempt from the same IP is rejected with error:
  "Too many rooms created from this IP. Limit is 10 per hour."
result: pass (verified in unit tests)
