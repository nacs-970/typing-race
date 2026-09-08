---
status: complete
phase: 06-deploy-hardening
source: [.planning/phases/06-deploy-hardening/06-01-SUMMARY.md, .planning/phases/06-deploy-hardening/06-02-SUMMARY.md, .planning/phases/06-deploy-hardening/06-03-SUMMARY.md, .planning/phases/06-deploy-hardening/06-04-SUMMARY.md]
started: 2026-09-09T00:00:00Z
updated: 2026-09-09T00:05:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server/service. Clear ephemeral state. Start from scratch. Server boots without errors and a health check / basic connection succeeds.
result: pass

### 2. Graceful Shutdown Protects In-Progress Race
expected: Start a race between two clients. Send SIGTERM to the server mid-race. The in-progress race keeps running to completion (not killed). Any new room-creation/join attempt during shutdown is rejected. Server exits within 90s once the race finishes.
result: issue
reported: "Automated probe (2/2 runs reproduced): sent SIGTERM mid-race with two live WS clients. Race state machine DID run to completion server-side (log shows 'race grace started' -> 'race ended reason=all_finished'), and a new create_room attempt during drain correctly got SERVER_SHUTTING_DOWN. But neither client ever received the race_end frame — both sockets closed with code 1006 (abnormal closure) at the exact moment the race ended, and the server process exited ~2s later. Root cause hypothesis: apps/gateway/src/index.ts's stop() calls server.stop(true) (Bun's force-close-active-connections flag) right after drain() resolves; drain() resolves as soon as the room count hits zero, which happens synchronously with (or just after) broadcasting race_end, so the force-close can race ahead of the socket actually flushing the final message to the client. This defeats the phase's core promise ('in-progress race keeps running to completion') from the player's perspective — the race finishes on the server but the client never sees the result, just a dropped connection."
severity: major

### 3. Server Restarting Toast Shown to Clients
expected: While connected, trigger a server shutdown (SIGTERM). Connected clients see a distinct "Server Restarting" toast (not a generic "Error" toast).
result: pass

## Summary

total: 3
passed: 2
issues: 1
pending: 0
skipped: 0

## Gaps

- gap_id: G-06-2
  truth: "In-progress race keeps running to completion and clients receive the final race_end/results before the server exits"
  status: failed
  reason: "User reported: Automated probe (2/2 runs reproduced): both clients' sockets close with code 1006 (abnormal) at the moment the race ends; race_end frame never received. Server exits ~2s later. Hypothesis: server.stop(true) force-closes connections right after drain() resolves, racing ahead of the final broadcast's flush."
  severity: major
  test: 2
  artifacts: []
  missing: []
