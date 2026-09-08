---
status: complete
phase: 06-deploy-hardening
source: [.planning/phases/06-deploy-hardening/06-01-SUMMARY.md, .planning/phases/06-deploy-hardening/06-02-SUMMARY.md, .planning/phases/06-deploy-hardening/06-03-SUMMARY.md, .planning/phases/06-deploy-hardening/06-04-SUMMARY.md]
started: 2026-09-09T00:00:00Z
updated: 2026-09-09T00:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server/service. Clear ephemeral state. Start from scratch. Server boots without errors and a health check / basic connection succeeds.
result: pass

### 2. Graceful Shutdown Protects In-Progress Race
expected: Start a race between two clients. Send SIGTERM to the server mid-race. The in-progress race keeps running to completion (not killed). Any new room-creation/join attempt during shutdown is rejected. Server exits within 90s once the race finishes.
result: pass
note: "Automated probe, 2/2 clean runs: SIGTERM mid-race -> race ran to completion server-side ('race ended reason=all_finished'), new create_room during drain correctly rejected with SERVER_SHUTTING_DOWN, both clients received race_end ~400-800ms before the server process actually exited. An earlier probe run (superseded) reported this as failing — that was a bug in the test harness itself (it registered its race_end listener only after typing finished, missing the frame if it had already arrived), not a server defect. Confirmed via raw-frame logging that the server delivers race_end correctly in the original, unmodified code; no source change was needed or made."

### 3. Server Restarting Toast Shown to Clients
expected: While connected, trigger a server shutdown (SIGTERM). Connected clients see a distinct "Server Restarting" toast (not a generic "Error" toast).
result: pass

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0

## Gaps

[none — G-06-2 (race_end delivery on shutdown) was a false positive from a test-harness bug, retracted after re-verification with a corrected probe; see Test 2 note]
