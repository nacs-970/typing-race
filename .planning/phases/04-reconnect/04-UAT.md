---
status: complete
phase: 04-reconnect
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md, 04-04-SUMMARY.md]
started: 2026-09-02
updated: 2026-09-03
---

## Current Test

[testing complete]

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
result: issue
reported: "guest reconnect, reconnected person cursor start at the first char, not the lastest char of they typing"
severity: major

### 2. Multi-tab session takeover
expected: |
  Join a room in Tab 1.
  Open the same room URL (#ABCDEF) in a new Tab 2 in the same browser.
  Tab 2 claims the session using the room's session cookie and renders the room/race state.
  Tab 1 receives session_taken_over notice and displays banner:
  "Session active in another tab: This room is currently open in another browser tab. This window has been disconnected."
result: issue
reported: "when finished and back to lobby, new tab in host, it show finished 0s and typing view"
severity: major

### 3. 60-second eviction & host promotion
expected: |
  Host and Guest in room.
  Host closes tab or disconnects.
  Guest sees toast that Host disconnected.
  Wait 60s without Host reconnecting.
  Server evicts Host; Guest receives player_left and is automatically promoted to Host.
  Guest now sees host controls (passage picker / Start Race button).
result: issue
reported: "60s passed no host control, f5 back to create room/ join room view"
severity: major

### 4. Per-IP rate limiting
expected: |
  Creating up to 10 rooms within an hour succeeds.
  An 11th creation attempt from the same IP is rejected with error:
  "Too many rooms created from this IP. Limit is 10 per hour."
result: pass
source: automated

## Summary

total: 4
passed: 1
issues: 3
pending: 0
skipped: 0

## Gaps

- gap_id: G-04-1
  truth: "Guest immediately rejoins the race at their exact progress and typed characters with cursor positioned at the latest char typed, not reset to the first char."
  status: failed
  reason: "User reported: guest reconnect, reconnected person cursor start at the first char, not the lastest char of they typing"
  severity: major
  test: 1
  artifacts: []
  missing: []

- gap_id: G-04-2
  truth: "When room returns to lobby or finishes, opening a new tab properly restores the lobby view (or results view if finished), resetting passageText and race view state if in lobby."
  status: failed
  reason: "User reported: when finished and back to lobby, new tab in host, it show finished 0s and typing view"
  severity: major
  test: 2
  artifacts: []
  missing: []

- gap_id: G-04-3
  truth: "When host disconnects and is evicted after 60s, guest is promoted to host with visible host controls in UI; refreshing does not destroy the room prematurely."
  status: failed
  reason: "User reported: 60s passed no host control, f5 back to create room/ join room view"
  severity: major
  test: 3
  artifacts: []
  missing: []
