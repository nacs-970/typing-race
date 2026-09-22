# Phase 2: Race Engine — Research

**Researched:** 2026-08-30
**Confidence:** HIGH (Phase 1 patterns proven; wire contract exists)
**Inherits from:** `.planning/research/{SUMMARY,STACK,PITFALLS,ARCHITECTURE}.md` + Phase 1 implementation

---

## User Constraints (from PROJECT.md + ROADMAP Phase 2)

### Locked (NON-NEGOTIABLE)
- Server-authoritative keystroke validation (4 anti-cheat checks per ROADMAP)
- NTP-style two-phase clock sync, all clients start within 50ms of each other
- 6-char room codes, no `I/O/0/1` (regex `/^[A-HJ-NP-Z2-9]{6}$/` already in Phase 1 wire contract)
- In-memory `Map<code, Room>`, no Redis
- Race FSM: lobby → countdown → racing → finished

### Claude's Discretion
- WS broadcasting strategy: `ws.publish(topic)` vs manual `Set<WebSocket>` per room
- Cursor broadcast rate (10Hz vs 30Hz trade-off)
- Clock sync sample count (1 vs 3 samples averaged)
- Race countdown duration (3s vs 5s)

### Out of Scope for Phase 2
- Per-character state model + backspace correctness (Phase 3)
- WPM/accuracy calculation (Phase 3)
- Race-end results board (Phase 3)
- Reconnect/sessionToken (Phase 4)
- Rate limiting (Phase 4)
- Rematch (Phase 4)

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary | Rationale |
|---|---|---|---|
| Wire schemas (Zod discriminated unions) | `packages/shared` | — | REQ-13 single source of truth. Both client + server import. |
| Room Manager (Map<code, Room>, 8-player cap, evict) | `apps/server/src/rooms/` | — | In-memory state. Honest tradeoff. |
| Race Controller FSM | `apps/server/src/race/` | — | State transitions, allowed messages per state, server `tick()`. |
| Clock sync (NTP-style) | `apps/server/src/clock/` + `apps/web/src/net/clock.ts` | — | Server returns t1+t2; client computes offset = ((t1-t0) + (t2-t3)) / 2 |
| Anti-cheat validation | `apps/server/src/race/validate-keystroke.ts` | — | 4 checks, server-timestamp-on-receipt is the source of truth. |
| Cursor broadcasting | `apps/server/src/ws/broadcast.ts` | — | Use `ws.publish(topic, data)` per room code — simpler than manual Set tracking. |
| UI: lobby + countdown + race start | `apps/web/src/components/` | — | React 19 + Zustand for client state. |

---

## Summary

Phase 1 already shipped 70% of the wire plumbing:
- `clientToServerSchema` already has `ping`, `join_room`, `leave_room`
- `serverToClientSchema` already has `hello`, `pong`, `error`
- 6-char code regex `^[A-HJ-NP-Z2-9]{6}$` is enforced on join
- Bun-native WS handler with typed `ws.data = { playerId, roomCode }`

Phase 2 ADDS:
1. **Server→Client frames**: `joined_room`, `lobby_state`, `countdown`, `race_start`, `cursor_update`, `player_left`, `race_end` (state stub only — full results board is Phase 3)
2. **Client→Server frames**: `create_room`, `clock_sync`, `start_race`, `keystroke`, `cursor_position`
3. **Server modules**: `rooms/manager.ts`, `race/controller.ts`, `race/validate-keystroke.ts`, `clock/sync.ts`, `ws/broadcast.ts`
4. **Client modules**: `net/clock.ts` (NTP math), `components/LobbyView.tsx`, `components/CountdownView.tsx`, `components/RaceView.tsx`, `store/room.ts` (Zustand)
5. **Shared domain types**: `Player`, `Room`, `RaceState`, `CharState`

**Primary recommendation:** Use `ws.publish(roomCode, JSON.stringify(frame))` for broadcasting. Bun supports topic-based pub/sub natively; no manual Set tracking needed. Code looks like `ws.subscribe(roomCode)` on room join + `ws.publish(roomCode, ...)` to broadcast. Topic = room code.

---

## Wire Contract Extensions

### Client → Server (extend existing `clientToServerSchema`)

```ts
export const createRoomSchema = z.object({
  type: z.literal("create_room"),
  nickname: z.string().min(1).max(20),
});

export const clockSyncSchema = z.object({
  type: z.literal("clock_sync"),
  t0: z.number().int().nonnegative(), // client send time
  t3: z.number().int().nonnegative(), // client receive time of response
});

export const startRaceSchema = z.object({
  type: z.literal("start_race"),
});

export const keystrokeSchema = z.object({
  type: z.literal("keystroke"),
  index: z.number().int().nonnegative(),   // char index in passage
  char: z.string().length(1),             // typed char
  clientTs: z.number().int().nonnegative(),
});

export const cursorPositionSchema = z.object({
  type: z.literal("cursor_position"),
  index: z.number().int().nonnegative(),
  clientTs: z.number().int().nonnegative(),
});
```

### Server → Client (extend existing `serverToClientSchema`)

```ts
export const joinedRoomSchema = z.object({
  type: z.literal("joined_room"),
  playerId: z.string().uuid(),
  roomCode: z.string().regex(/^[A-HJ-NP-Z2-9]{6}$/),
  you: z.object({ nickname: z.string(), isHost: z.boolean() }),
  players: z.array(z.object({
    playerId: z.string().uuid(),
    nickname: z.string(),
    isHost: z.boolean(),
    progress: z.number().int().nonnegative(),
  })),
  clockOffsetMs: z.number(), // server-computed offset for this client
});

export const lobbyStateSchema = joinedRoomSchema.extend({
  state: z.literal("lobby"),
});

export const countdownSchema = z.object({
  type: z.literal("countdown"),
  startsAtServerMs: z.number().int(),     // when race begins (server clock)
  secondsRemaining: z.number().int().min(0).max(10),
});

export const raceStartSchema = z.object({
  type: z.literal("race_start"),
  startsAtServerMs: z.number().int(),     // exact start moment
  passageId: z.string(),                  // which passage
  passageText: z.string(),                // the text to type
});

export const cursorUpdateSchema = z.object({
  type: z.literal("cursor_update"),
  playerId: z.string().uuid(),
  index: z.number().int().nonnegative(),
  serverTs: z.number().int(),             // when server received
});

export const playerLeftSchema = z.object({
  type: z.literal("player_left"),
  playerId: z.string().uuid(),
});

export const raceEndSchema = z.object({
  type: z.literal("race_end"),
  reason: z.enum(["finished", "abandoned"]),
  finishedPlayerIds: z.array(z.string().uuid()),
});
```

---

## Clock Sync Algorithm (NTP-style, two-phase)

Standard NTP computation (RFC 5905):
```
offset = ((t1 - t0) + (t2 - t3)) / 2
roundtrip = (t3 - t0) - (t2 - t1)
```

Where:
- t0 = client send time
- t1 = server receive time
- t2 = server send time
- t3 = client receive time

For typing-race: ONE round trip is enough (we just need ms-level sync, not sub-ms). Three samples averaged to reduce noise is overkill; one good sample suffices given LAN/localhost deployment. Keep it simple:

```ts
// Client (apps/web/src/net/clock.ts)
export async function syncClock(serverUrl: string): Promise<{ offsetMs: number }> {
  const t0 = Date.now();
  const res = await fetch(`${serverUrl}/api/clock-sync`);
  const { t1, t2 } = await res.json();  // server receive + send times
  const t3 = Date.now();
  const offsetMs = ((t1 - t0) + (t2 - t3)) / 2;
  return { offsetMs };
}
```

Server endpoint: trivial — record t1 on receipt, t2 on send, both via `Date.now()`. HTTP (not WS) so the round trip is precisely measured.

If roundtrip > 500ms, retry once. Reject as offline if still > 500ms.

---

## Room Manager (in-memory Map)

```ts
// apps/server/src/rooms/manager.ts
export type Room = {
  code: string;                              // 6-char code
  hostId: string;                            // playerId of creator
  state: "lobby" | "countdown" | "racing" | "finished";
  passageId: string | null;                  // selected passage (Phase 3 has corpus)
  passageText: string | null;                // the text to type (Phase 3 picks)
  startsAtServerMs: number | null;           // server-time when race starts
  players: Map<string, Player>;              // playerId -> Player
  lastActivityAt: number;                    // for idle sweeper (Phase 4)
};

export type Player = {
  playerId: string;
  nickname: string;
  isHost: boolean;
  wsRef: ServerWebSocket<WsData>;           // for direct messaging
  progress: number;                          // current cursor index
  lastKeystrokeAt: number;                   // server-timestamp, for min-interval
  clientOffsetMs: number;                    // from clock sync
};

export const rooms = new Map<string, Room>();
const MAX_PLAYERS_PER_ROOM = 8;
```

Operations:
- `createRoom(hostId, nickname) -> { code, room }` — generates code via nanoid customAlphabet
- `getRoom(code) -> Room | null`
- `addPlayer(code, playerId, nickname) -> { room, player } | error`
- `removePlayer(code, playerId)`
- `evictIfEmpty(code)` — called on player leave

Code generation:
```ts
import { customAlphabet } from "nanoid";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 31 chars (no I/O/0/1)
const genCode = () => customAlphabet(ALPHABET, 6)();
```

Collision retry: if `rooms.has(code)` after generate, retry up to 3 times, else fail.

---

## Race Controller FSM

```ts
// apps/server/src/race/controller.ts
type State = Room["state"];

const transitions: Record<State, State[]> = {
  lobby: ["countdown"],
  countdown: ["racing", "lobby"],  // cancel back to lobby if player leaves
  racing: ["finished"],
  finished: ["lobby"],  // rematch → lobby (Phase 4)
};

export function transition(room: Room, target: State): boolean {
  if (!transitions[room.state].includes(target)) return false;
  room.state = target;
  return true;
}
```

State messages:
- `lobby`: only `create_room` / `join_room` / `leave_room` / `start_race`
- `countdown`: server `tick()` broadcasts `countdown` every 1s; no client messages except `leave_room`
- `racing`: `keystroke`, `cursor_position`, `leave_room`; server broadcasts `cursor_update` to other players
- `finished`: no input (Phase 4 adds `rematch`)

Server `tick()` runs every 1s for countdown → racing transition:
```ts
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.state !== "countdown") continue;
    if (room.startsAtServerMs && now >= room.startsAtServerMs) {
      transition(room, "racing");
      broadcast(room, { type: "race_start", startsAtServerMs: room.startsAtServerMs, ... });
    }
  }
}, 1000);
```

`start_race` from host: `room.startsAtServerMs = Date.now() + 3000` (3s countdown). Transition lobby→countdown, broadcast `countdown`.

---

## Anti-Cheat: 4 Checks

```ts
// apps/server/src/race/validate-keystroke.ts
export function validateKeystroke(args: {
  room: Room;
  player: Player;
  frame: Keystroke;
  passageText: string;
}): { ok: true } | { ok: false; reason: ServerErrorCode } {
  const now = Date.now();

  // 1. Server-timestamp on receipt (already in 'now')
  // Implicit — we use `now`, not `frame.clientTs`, for all subsequent checks.

  // 2. Pre-start reject
  if (room.state !== "racing") return { ok: false, reason: "NOT_IN_ROOM" };
  if (room.startsAtServerMs && now < room.startsAtServerMs + 50) {
    return { ok: false, reason: "RATE_LIMITED" }; // closest error code
  }

  // 3. Min-interval (≥20ms between accepted keystrokes)
  if (now - player.lastKeystrokeAt < 20) {
    return { ok: false, reason: "RATE_LIMITED" };
  }
  player.lastKeystrokeAt = now;

  // 4. Char-match against passage
  const expected = passageText[frame.index];
  if (frame.char !== expected) {
    return { ok: false, reason: "INVALID_FRAME" }; // wrong char
  }

  return { ok: true };
}
```

The ROADMAP AC-2 says "clientTs set 60s in the future" — that's caught by check #1 (server ignores clientTs). AC-3 "advance < 20ms" caught by check #3. WPM cap of ~250 follows naturally (30000ms / 20ms = 1500 keystrokes / 5 chars per word = 300 WPM raw; with realistic typing this clamps at ~250 effective).

---

## WS Broadcasting Pattern

Use Bun-native topic pub/sub — no manual Set tracking:

```ts
// apps/server/src/ws/broadcast.ts
export function broadcastToRoom(room: Room, frame: ServerToClient): void {
  const data = JSON.stringify(frame);
  for (const player of room.players.values()) {
    player.wsRef.send(data);
  }
}

// In Bun.serve fetch handler, after room join:
// ws.subscribe(roomCode);

// In handlers.ts when leaving room:
// ws.unsubscribe(roomCode);
```

`ws.publish(topic, data, options)` is Bun's built-in topic broadcasting — auto-skips sender if `excludeSelf` is true. For typing-race, we need every player to see every other player's cursor. `broadcastToRoom` loop is simplest (no Set bookkeeping).

If we want true topic pub/sub: `ws.subscribe(roomCode)` on join, `ws.publish(roomCode, data, { excludeSelf: false })` for broadcast, `ws.unsubscribe(roomCode)` on leave. The loop is fine for 8-player rooms.

---

## Cursor Broadcasting Rate

- **10Hz (every 100ms)**: bandwidth-friendly, slightly laggy for fast typers
- **30Hz (every 33ms)**: smooth, matches sub-frame latency
- **On-change**: only when `cursor_index` changes — minimum traffic but inconsistent latency

**Decision: 10Hz with on-change skip.** Client throttles: only sends `cursor_position` if `index !== lastIndex`. Server broadcasts every accepted cursor update immediately. 10Hz cap on send-side, but if user is idle (no keypresses for 200ms), no traffic. With 8 players typing simultaneously, max rate = 80 msgs/s — trivial.

---

## Nyquist Experiments (Validation Architecture)

| ID | What It Proves | Command | Pass Criteria |
|----|----------------|---------|---------------|
| E1 | Clock sync round trip < 200ms | `curl -X POST localhost:8080/api/clock-sync` returns t1+t2; client computes offset | `abs(offsetMs) < 100` |
| E2 | Two clients race-start within 50ms | Open 2 browser windows, both `join_room` same code, host triggers `start_race` | Both report `race_start.startsAtServerMs` same value; client-local start times within 50ms |
| E3 | Anti-cheat rejects pre-start keystrokes | Send `keystroke` before `race_start` arrives | Server returns `error { code: NOT_IN_ROOM }` (or equivalent) |
| E4 | Anti-cheat rejects spoofed clientTs | Send `keystroke { clientTs: Date.now() + 60000 }` mid-race | Server uses `Date.now()` not `clientTs`; WPM/finish unaffected |
| E5 | Opponent cursor updates within 1s | Two clients race; one stops typing | Other client's `cursor_update` arrives within 1s of last keystroke |
| E6 | Room code excludes I/O/0/1 | `genCode()` 1000 times | No occurrence of `I`, `O`, `0`, `1` in output |
| E7 | 8-player cap enforced | 9th player tries to join | Server returns `error { code: ROOM_FULL }` |
| E8 | Cold start: create room, race, finish | Full integration test | End-to-end in <30s |

---

## Implementation Plan (4 plans, ~280k tokens total)

Per ROADMAP Phase 2:
- **02-01**: Wire schema extensions + nanoid room codes + collision retry
- **02-02**: Room Manager + Race Controller FSM + tick()
- **02-03**: HTTP clock sync endpoint + client NTP math + countdown view
- **02-04**: Keystroke handler + 4 anti-cheat checks + cursor broadcasting

---

## Open Questions / Phase 4+ items

- **Cursor interpolation** for sub-100ms smoothness — Phase 5 polish
- **React Compiler for cursor re-render perf** — Phase 5 polish
- **Race-end detection** (all finished vs one finished + others past 95%) — Phase 3
- **Session token for reconnect** — Phase 4
- **Rate limit per IP** — Phase 4
- **Idle sweeper** — Phase 4

---
*Phase 2 research complete. Planner can consume.*