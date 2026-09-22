---
phase: 04-reconnect
plan: 02
subsystem: state-snapshot-takeover
tags: [reconnect, snapshot, cookie, takeover, anti-cheat]
status: completed
completed_at: 2026-09-02

# Dependency graph
requires:
  - plan: 04-01
    provides: "sessionToken issuance & rejoin_room wire schema"
provides:
  - "rejoinedRoomSchema defines authoritative race snapshot sent on rejoin_room"
  - "sessionTakenOverSchema notifies disconnected tab when a new tab claims the session"
  - "buildRejoinedRoomFrame helper in apps/server/src/ws/broadcast.ts"
  - "500ms server anti-burst grace period enforced in validateKeystroke"
  - "Cookie persistence via getSessionCookie/setSessionCookie in apps/web/src/net/ws.ts"
  - "Multi-tab takeover & UI hydration in apps/web/src/App.tsx"
  - "apps/server/src/__tests__/reconnect.test.ts (tests 7 & 8 verify takeover and 500ms grace)"
affects:
  - 04 (disconnect timeout and notification UX builds upon rebind & snapshot)

actuals:
  tasks: 3
  tests: 8

key-files:
  modified:
    - packages/shared/src/messages.ts
    - apps/server/src/race/types.ts
    - apps/server/src/rooms/manager.ts
    - apps/server/src/race/validate-keystroke.ts
    - apps/server/src/ws/broadcast.ts
    - apps/server/src/ws/dispatch.ts
    - apps/web/src/net/ws.ts
    - apps/web/src/App.tsx
    - apps/server/src/__tests__/reconnect.test.ts
---

# Plan 04-02 Summary: Race Snapshot Replay & Multi-Tab Cookie Takeover

Implemented authoritative race snapshot replay on reconnect, multi-tab takeover, cookie caching, and a 500ms anti-cheat grace period:
1. **Wire Schemas**: Added `rejoinedRoomSchema` (complete snapshot with room state, passage, player progress, char states, live cursors) and `sessionTakenOverSchema`.
2. **Server Snapshot & Multi-Tab Takeover**:
   - `buildRejoinedRoomFrame` builds full race state for the rejoining client.
   - `rebindPlayerSocket` notifies any previous socket with `session_taken_over` and closes it cleanly.
   - `validateKeystroke` enforces a 500ms `RATE_LIMITED` grace period after `player.reconnectedAt`.
3. **Web Client Integration**:
   - Implemented `getSessionCookie`, `setSessionCookie`, and `clearSessionCookie` in `apps/web/src/net/ws.ts`.
   - `App.tsx` auto-rejoins when URL hash and cookie match on mount.
   - Handled `rejoined_room` to hydrate stores (connection, race, cursors).
   - Handled `session_taken_over` to render a friendly takeover notice banner.
4. **Verification**: 8 unit tests in `reconnect.test.ts` pass, plus all 71 existing server tests and 9 web tests pass.
