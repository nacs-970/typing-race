---
# Phase 4: Reconnect & Room Lifecycle - Context

**Gathered:** 2026-09-02
**Status:** Ready for execution (Discussed with user)

<domain>

## Phase Boundary

Phase 4 makes the multiplayer typing game resilient to real-world network fluctuations, tab reloads, and multi-tab browser usage. It provides:
1. Mid-race reconnection without loss of progress or state corruption (`sessionToken`).
2. Cookie-based session storage and seamless multi-tab takeover.
3. Full state snapshot recovery on rejoin (passage, progress, charStates, live cursors, timers).
4. Live race flow during disconnect: opponents keep typing while toast warns "X disconnected — waiting 60s".
5. Temporary disconnect grace period (60s) before permanent player eviction.
6. WebSocket heartbeat ping/pong (15s/5s) and per-IP rate limiting on room creation (10 rooms/hour).

User explicit exclusions:
- **NO idle room sweeper**: Rooms do not expire or evict after X minutes of inactivity. Rooms remain active until all players permanently leave.

</domain>

<decisions>

## Implementation Decisions

### Session tokens & Cookie persistence (User-defined)

- **D-01: `sessionToken` stored in Cookie.** When a player creates or joins a room, server issues `sessionToken` (UUID v4). Client saves it in `document.cookie` (`typing_race_${roomCode}=${sessionToken}; path=/; SameSite=Lax`).
- **D-02: Multi-tab takeover.** When a user opens a new tab with the same room URL, the new tab reads the cookie, connects to the existing session, and takes over. The old tab is sent a `session_taken_over` notice and disconnected.
- **D-03: `rejoin_room` wire schema.** Client sends `{ type: "rejoin_room", roomCode: string, sessionToken: string }`. Server re-binds WebSocket to existing Player slot, sets `player.reconnectedAt = Date.now()`, and clears `player.disconnectedAt`.

### Live race flow & Disconnect grace

- **D-04: Race continues live during disconnect.** When a player drops mid-race, the race is NOT paused. Opponents keep typing without interruption. An amber toast warns: `Player [Name] disconnected — waiting 60s`.
- **D-05: 60-second reconnect window.** Disconnected player has 60 seconds to reconnect. If they reconnect, they immediately resume typing where they left off. If the race ends before they reconnect, the results board includes their last progress.
- **D-06: Eviction after 60s.** If a player fails to reconnect within 60s, they are permanently removed (`removePlayer`), host is migrated if applicable, and `player_left` is broadcast.

### Rejoin experience & Anti-cheat

- **D-07: Instant UI restore.** Rejoining player immediately receives `rejoined_room` snapshot with full room state, passage, their own typed char states, and opponent cursors. They can type immediately.
- **D-08: 500ms server anti-burst guard.** Server rejects keystrokes for 500ms after reconnection to prevent burst replay attacks and clock skew.

### Room Lifecycle (Sweeper excluded)

- **D-09: No idle room sweeper.** User explicitly requested no idle eviction. Rooms remain alive until empty.
- **D-10: WS Heartbeat ping/pong (15s/5s).** Server sends WS ping every 15s. If client does not respond within 5s, socket is terminated cleanly, triggering the 60s disconnect grace flow.
- **D-11: Per-IP room creation rate limit.** In-memory limiter restricting each IP to 10 `create_room` calls per hour. Returns `RATE_LIMITED` error when exceeded.

</decisions>

<canonical_refs>

## Canonical References

### Project context
- `.planning/PROJECT.md` — Core value, REQ-07 (reconnect mid-race), REQ-09 (rematch polish / room lifecycle).
- `.planning/ROADMAP.md` §Phase 4 — 5 success criteria, 4 plan boundaries.
- `.planning/STATE.md` — Phase 3 completion status and accumulated architectural decisions.

### Existing code
- `packages/shared/src/messages.ts` — Wire schemas. Extend with `rejoin_room`, `rejoined_room`, `player_disconnected`, `player_reconnected`, `session_taken_over`.
- `apps/server/src/race/types.ts` — `Player` interface. Add `sessionToken`, `disconnectedAt`, `reconnectedAt`.
- `apps/server/src/rooms/manager.ts` — Room & player lifecycle. Add reconnect rebinding and IpRateLimiter.
- `apps/server/src/ws/dispatch.ts` — Inbound WS routing. Add `rejoin_room` handler.
- `apps/web/src/net/ws.ts` — WebSocket client connection manager. Add cookie reading/writing, auto-rejoin logic.
- `apps/web/src/App.tsx` — App state. Handle `rejoined_room` hydration and disconnect toasts.

</canonical_refs>
