---
phase: 04-reconnect
plan: 03
subsystem: heartbeat-and-rate-limit
tags: [heartbeat, ping, pong, rate-limit, ip]
status: completed
completed_at: 2026-09-02

# Dependency graph
requires:
  - phase: 02-race-engine
    provides: "WebSocket server & manager infrastructure"
provides:
  - "15s WS heartbeat ping with 20s timeout in apps/server/src/index.ts"
  - "pong message handler in websocket configuration"
  - "IpRateLimiter sliding-window implementation in apps/server/src/rooms/manager.ts"
  - "Per-IP rate limit of 10 room creations per hour in dispatch.ts"
  - "apps/server/src/__tests__/rate-limit.test.ts (4 unit tests pass)"
affects:
  - 04 (heartbeat terminates dead sockets so 60s disconnect grace begins)

actuals:
  tasks: 2
  tests: 4

key-files:
  created:
    - apps/server/src/__tests__/rate-limit.test.ts
  modified:
    - apps/server/src/index.ts
    - apps/server/src/ws/handlers.ts
    - apps/server/src/rooms/manager.ts
    - apps/server/src/ws/dispatch.ts
---

# Plan 04-03 Summary: Heartbeat Ping/Pong & Per-IP Rate Limiting

Implemented WebSocket heartbeat connection monitoring and per-IP room creation rate limiting:
1. **Heartbeat Monitoring**:
   - `apps/server/src/index.ts` tracks active sockets and sends ping frames every 15s.
   - Sockets failing to respond with pong within 20s (15s ping interval + 5s timeout) are closed with code 1001 ("Heartbeat timeout").
   - Added `pong` callback and `lastPongAt` tracking on `WsData`.
2. **Per-IP Rate Limiting**:
   - Implemented `IpRateLimiter` sliding window class in `apps/server/src/rooms/manager.ts` (10 rooms/hour default).
   - Inbound `create_room` in `dispatch.ts` checks client IP; returns `RATE_LIMITED` error when quota is exhausted.
3. **Verification**: 4 new unit tests in `rate-limit.test.ts` pass, plus all 79 existing server tests and 9 web tests pass.
