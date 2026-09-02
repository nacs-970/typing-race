---
# Phase 4: Reconnect & Room Lifecycle - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning

<domain>

## Phase Boundary

Phase 4 makes the multiplayer typing game resilient to real-world network fluctuations, tab reloads, and server resource leakage. It provides:
1. Mid-race reconnection without loss of progress or state corruption (`sessionToken`).
2. Full state snapshot recovery on rejoin (passage, progress, charStates, live cursors, timers).
3. Temporary disconnect grace period (60s) before permanent player eviction.
4. Room lifecycle management: idle room sweeper (10 min timeout) and heartbeat ping/pong.
5. Per-IP rate limiting for room creation (10 rooms/hour) to protect server resources.

Out of scope for Phase 4:
- Interpolated 60fps cursor animation (Phase 5).
- Audio effects / UI theme switcher (Phase 5 or v2).
- Fly.io multi-region deploy & production SSL configuration (Phase 6).

</domain>

<decisions>

## Implementation Decisions

### Session tokens & Rejoin handshake

- **D-01: `sessionToken` issued on room join/create.** When a player creates or joins a room, the server issues a random `sessionToken` (UUID v4) alongside `playerId`. The token is stored in the browser's `sessionStorage` mapped by `roomCode`.
- **D-02: `rejoin_room` wire schema.** New client-to-server message `{ type: "rejoin_room", roomCode: string, sessionToken: string }`.
- **D-03: Server re-binds WebSocket to existing Player slot.** On valid `rejoin_room`, the server attaches the new `ws` connection to the existing `player`, clears `player.disconnectedAt`, and marks the player active. If `sessionToken` does not match, returns `SESSION_INVALID`.

### Disconnect grace & Reconnect snapshot

- **D-04: 60-second disconnect grace period.** When a WebSocket closes, if the room is active (`countdown`, `racing`, `grace`, or `lobby`), the player is NOT immediately removed. The server records `player.disconnectedAt = Date.now()` and broadcasts `player_disconnected` to opponents.
- **D-05: Eviction after 60s.** If the player does not rejoin within 60 seconds, the server permanently removes the player, triggers host promotion if necessary, and broadcasts `player_left`.
- **D-06: `rejoined_room` snapshot frame.** Server sends full authoritative race state to the rejoining client:
  - Room state (`state`, `passageId`, `passageText`, `startsAtServerMs`, `graceEndsAtServerMs`)
  - Own progress (`progress`, `charStates`, `wpm`, `totalKeystrokes`)
  - Opponents (`playerId`, `nickname`, `progress`, `charStates`, `wpm`, `isHost`, `isDisconnected`)
  - Server clock offset (`clockOffsetMs`).
- **D-07: 500ms anti-cheat grace period on reconnect.** Server rejects keystrokes for 500ms after reconnection to prevent burst replay attacks and clock desync.

### Opponent notifications

- **D-08: Opponent toasts / status pills.** When a player drops, opponents receive `player_disconnected` with `{ playerId, nickname, timeoutMs: 60000 }`. When they reconnect, opponents receive `player_reconnected` with `{ playerId, nickname }`.

### Room sweeper & Heartbeat

- **D-09: Idle room sweeper (10 min).** Periodic timer (runs every 60s) evicts any room where `Date.now() - room.lastActivityAt > 600_000`. Cleanly notifies connected sockets and frees memory.
- **D-10: WS Heartbeat ping/pong (15s/5s).** Server sends WS ping every 15s. If client does not respond within 5s, connection is terminated cleanly, triggering the disconnect flow.
- **D-11: Per-IP room creation rate limit.** In-memory sliding window or bucket limiting IPs to 10 `create_room` calls per hour. Returns `RATE_LIMITED` when exceeded.

</decisions>

<canonical_refs>

## Canonical References

### Project context
- `.planning/PROJECT.md` — Core value, REQ-07 (reconnect mid-race), REQ-09 (rematch polish / room lifecycle).
- `.planning/ROADMAP.md` §Phase 4 — 5 success criteria, 4 plan boundaries.
- `.planning/STATE.md` — Phase 3 completion status and accumulated architectural decisions.

### Existing code
- `packages/shared/src/messages.ts` — Wire schemas. Extend with `rejoin_room`, `rejoined_room`, `player_disconnected`, `player_reconnected`.
- `apps/server/src/race/types.ts` — `Player` and `Room` types. Add `sessionToken`, `disconnectedAt`, `reconnectedAt`.
- `apps/server/src/rooms/manager.ts` — Room & player lifecycle. Add reconnect rebinding and sweeper.
- `apps/server/src/ws/dispatch.ts` — Inbound WS routing. Add `rejoin_room` handler.
- `apps/web/src/net/ws.ts` — WebSocket client connection manager. Add auto-reconnect logic and `sessionStorage` caching.
- `apps/web/src/App.tsx` — App state. Handle `rejoined_room` hydration and disconnect toasts.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets
- `apps/server/src/ws/broadcast.ts`: Pattern for broadcasting to room members with error swallowing.
- `apps/web/src/store/race.ts` and `connection.ts`: Zustand stores ready to receive hydrated snapshot data.
- `apps/server/src/race/controller.ts`: FSM transitions and 1Hz `tick()` loop. The sweeper and disconnect timeouts can be integrated directly into the ticker or a dedicated interval.

</code_context>
