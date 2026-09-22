# Phase 5: Frontend Polish - Pattern Map

**Mapped:** 2026-09-03  
**Files analyzed:** 23  
**Analogs found:** 22 / 23  

---

## File Classification

| File Path | Role | Data Flow | Status | Closest Analog |
|---|---|---|---|---|
| `apps/web/src/core/typing-engine.ts` | Headless Core Engine | Listens to raw keydown -> matches passage char -> emits typed events (`keystroke`, `correction`, `stats_updated`, `finished`) | NEW | `apps/web/src/components/RaceView.tsx:66-129` & `apps/server/src/race/scoring.ts:98-143` |
| `apps/web/src/net/race-client.ts` | Centralized Network Client | Singleton managing WS lifecycle, cookie auto-rejoin, NTP sync, heartbeat, and store dispatch | NEW | `apps/web/src/net/ws.ts:39-339` & `apps/web/src/App.tsx:61-87, 143-183` |
| `apps/web/src/core/cursor-manager.ts` | Animation Controller | Receives position snapshots -> 100ms ring buffer -> 60fps rAF lerp loop -> mutates overlay DOM via `translate3d` | NEW | `apps/web/src/store/cursor.ts:10-40` & `apps/web/src/components/RaceView.tsx:135-151` |
| `apps/web/src/core/layout.ts` | Text Layout Engine | Multiline text layout using `@chenglou/pretext` (`prepareWithSegments`, `layoutWithLines`) -> maps progress to (x, y) | NEW | *No Direct Internal Analog* (`@chenglou/pretext` external; `apps/web/src/net/clock.ts` for pure math/mocking) |
| `apps/web/src/components/ToastQueue.tsx` | UI Presentation / Portal | Reads disconnect grace timers, reconnect notices, and error events -> renders stacked top-right toasts | NEW | `apps/web/src/App.tsx:274-309` & `apps/web/src/components/GraceBanner.tsx:9-33` |
| `apps/web/src/store/race.ts` | State Store | UI state store for race lifecycle, passage text, char states, WPM stats, lobby readiness, passage filters | MODIFIED | `apps/web/src/store/race.ts:1-67` |
| `apps/web/src/store/cursor.ts` | State Store | Isolated reactive store for discrete cursor events (ownIndex, backspace echoes, disconnects) | MODIFIED | `apps/web/src/store/cursor.ts:1-40` |
| `apps/web/src/components/RaceView.tsx` | UI Component | Presentational typing surface: renders passage text with char accents, hosts cursor overlay ref, displays HUD | MODIFIED | `apps/web/src/components/RaceView.tsx:1-156` |
| `apps/web/src/components/LobbyView.tsx` | UI Component | Pre-race lobby interface: per-player ready checkmarks, passage category/length filters, host controls | MODIFIED | `apps/web/src/components/LobbyView.tsx:1-103` |
| `apps/web/src/components/CountdownView.tsx` | UI Component | Synchronized countdown overlay: dramatic motion-blurred 3-2-1 GO animation anchored to server time | MODIFIED | `apps/web/src/components/CountdownView.tsx:1-44` |
| `apps/web/src/components/ResultsBoard.tsx` | UI Component | Post-race standings: podium medals (🥇🥈🥉), finish time delta to winner, WPM breakdown, rematch button | MODIFIED | `apps/web/src/components/ResultsBoard.tsx:1-89` |
| `apps/web/src/components/GraceBanner.tsx` | UI Component | Pinned glowing grace countdown banner with animated progress bar | MODIFIED | `apps/web/src/components/GraceBanner.tsx:1-33` |
| `apps/web/src/styles.css` | Stylesheet | Tailwind CSS v4 `@import "tailwindcss";`, `@theme` botanical palette tokens, typography, cursor carets | MODIFIED | `apps/web/src/styles.css:1-324` |
| `apps/web/vite.config.ts` | Build Tooling | Integrates `@tailwindcss/vite` plugin alongside React and compression plugins | MODIFIED | `apps/web/vite.config.ts:1-123` |
| `packages/shared/src/messages.ts` | Wire Protocol | Adds `set_ready` schema, extends `PLAYER_SUMMARY` with optional `isReady?: boolean` | MODIFIED | `packages/shared/src/messages.ts:17-23, 63-68, 108-120` |
| `apps/server/src/ws/dispatch.ts` | Server Dispatch | Routes `set_ready` frame, mutates player readiness, broadcasts `lobby_state` | MODIFIED | `apps/server/src/ws/dispatch.ts:194-218, 464-468` |
| `apps/web/src/__tests__/cursor-manager.test.ts` | Unit Test | Verifies 100ms snapshot buffer insertion, lerp interpolation, 150ms clamped extrapolation, rewind snap | NEW | `apps/web/src/__tests__/clock.test.ts:1-85` |
| `apps/web/src/__tests__/layout.test.ts` | Unit Test | Verifies Pretext layout line wrapping, line ranges, and monotonic (x, y) coordinate resolution | NEW | `apps/web/src/__tests__/clock.test.ts:1-85` |
| `apps/web/src/__tests__/typing-engine.test.ts` | Unit Test | Verifies keystroke matching, char-state transitions, backspace handling, raw/net WPM computation | NEW | `apps/server/src/__tests__/validate-keystroke.test.ts:1-80` |
| `apps/web/src/__tests__/race-client.test.ts` | Unit Test | Verifies WebSocket event dispatch, store synchronization, and cookie session handling | NEW | `apps/web/src/__tests__/clock.test.ts:1-85` |
| `apps/web/src/__tests__/RaceView.test.tsx` | Component Test | Verifies presentational passage character rendering and DOM container mount without React cursor commits | MODIFIED | `apps/web/src/__tests__/RaceView.test.tsx:1-66` |
| `apps/web/src/__tests__/LobbyView.test.tsx` | Component Test | Verifies per-player ready toggle display, host start button state, and passage filter toggles | NEW | `apps/web/src/__tests__/RaceView.test.tsx:68-89` |
| `apps/web/src/__tests__/ResultsBoard.test.tsx` | Component Test | Verifies ranking order, podium medal display, and finish time delta relative to winner | NEW | `apps/web/src/__tests__/RaceView.test.tsx:68-89` |

---

## Pattern Assignments

### 1. `apps/web/src/core/typing-engine.ts`
**Role:** Headless Core Typing Engine  
**Analogs:** `apps/web/src/components/RaceView.tsx:66-129` (keystroke parsing, backspace, optimistic charStates) and `apps/server/src/race/scoring.ts:98-143` (net WPM and accuracy formulas).

#### Imports Pattern
```typescript
import type { CharState } from "../store/race.ts";
```

#### Core Logic & Event Emitter Pattern
```typescript
export interface TypingEngineEvents {
  keystroke: (index: number, char: string, clientTs: number) => void;
  correction: (backspaces: number, clientTs: number) => void;
  stats_updated: (stats: { rawWpm: number; netWpm: number; accuracy: number; uncorrectedErrors: number }) => void;
  finished: (finishTimeMs: number) => void;
}

export class TypingEngine {
  private passageText = "";
  private ownIndex = 0;
  private charStates: CharState[] = [];
  private totalKeystrokes = 0;
  private startTimeMs: number | null = null;
  private listeners: { [K in keyof TypingEngineEvents]?: Set<TypingEngineEvents[K]> } = {};

  init(passageText: string): void {
    this.passageText = passageText;
    this.ownIndex = 0;
    this.charStates = new Array(passageText.length).fill("pending");
    this.totalKeystrokes = 0;
    this.startTimeMs = null;
  }

  handleKeyDown(ev: KeyboardEvent): boolean {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return false;

    if (ev.key === "Backspace") {
      ev.preventDefault();
      if (this.ownIndex <= 0) return false;
      this.ownIndex--;
      this.charStates[this.ownIndex] = "pending";
      const now = Date.now();
      this.emit("correction", 1, now);
      this.updateStats(now);
      return true;
    }

    const ch = ev.key === "Spacebar" ? " " : ev.key;
    if (ch.length !== 1) return false;
    if (this.ownIndex >= this.passageText.length) return false;

    ev.preventDefault();
    const now = Date.now();
    if (this.startTimeMs === null) this.startTimeMs = now;

    this.totalKeystrokes++;
    const expected = this.passageText[this.ownIndex];
    const isCorrect = ch === expected;
    this.charStates[this.ownIndex] = isCorrect ? "correct" : "error";
    
    const currentIndex = this.ownIndex;
    this.ownIndex++;
    
    this.emit("keystroke", currentIndex, ch, now);
    this.updateStats(now);

    if (this.ownIndex === this.passageText.length) {
      this.emit("finished", now - this.startTimeMs);
    }
    return true;
  }

  subscribe<K extends keyof TypingEngineEvents>(event: K, handler: TypingEngineEvents[K]): () => void {
    if (!this.listeners[event]) this.listeners[event] = new Set();
    this.listeners[event]!.add(handler);
    return () => this.listeners[event]?.delete(handler);
  }

  private emit<K extends keyof TypingEngineEvents>(event: K, ...args: Parameters<TypingEngineEvents[K]>): void {
    const handlers = this.listeners[event];
    if (!handlers) return;
    for (const fn of handlers) {
      (fn as Function)(...args);
    }
  }

  // Pure scoring formulas copied from apps/server/src/race/scoring.ts:98-143
  private updateStats(now: number): void {
    if (!this.startTimeMs) return;
    const elapsedMinutes = (now - this.startTimeMs) / 60_000;
    if (elapsedMinutes <= 0) return;

    let correctChars = 0;
    let uncorrectedErrors = 0;
    for (let i = 0; i < this.ownIndex; i++) {
      if (this.charStates[i] === "correct") correctChars++;
      else if (this.charStates[i] === "error") uncorrectedErrors++;
    }

    const rawWpm = (this.totalKeystrokes / 5) / elapsedMinutes;
    const netWpm = Math.max(0, (correctChars / 5 - uncorrectedErrors / 5) / elapsedMinutes);
    const accuracy = this.totalKeystrokes > 0 ? correctChars / this.totalKeystrokes : 1;

    this.emit("stats_updated", { rawWpm, netWpm, accuracy, uncorrectedErrors });
  }
}
```

---

### 2. `apps/web/src/net/race-client.ts`
**Role:** Centralized WebSocket Client Singleton  
**Analog:** `apps/web/src/net/ws.ts:39-339` (connection lifecycle, session tokens, store dispatch).

#### Imports Pattern
```typescript
import {
  serverToClientSchema,
  type ServerToClient,
  type ClientToServer,
} from "@typing-race/shared";
import { setConnectionStore } from "../store/store-bridge.ts";
import { setCursorState } from "../store/cursor.ts";
import { setClockState } from "../store/clock.ts";
import { setRaceState, resetRaceUi, useRaceStore, type CharState } from "../store/race.ts";
import { useConnectionStore } from "../store/connection.ts";
```

#### Core Logic Pattern (Singleton Dispatch & Cookie Lifecycle)
```typescript
export class RaceClient {
  private socket: WebSocket | null = null;
  private subscribers = new Set<(frame: ServerToClient) => void>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private explicitlyClosed = false;

  constructor(private url: string) {}

  connect(force = false): void {
    if (!force && this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }
    // Clean prior socket listeners before reconnecting (ws.ts:63-74)
    if (this.socket) {
      try {
        this.socket.onclose = null;
        this.socket.onerror = null;
        this.socket.onmessage = null;
        this.socket.onopen = null;
        this.socket.close();
      } catch {}
      this.socket = null;
    }

    setConnectionStore({ status: "connecting" });
    const ws = new WebSocket(this.url);
    this.socket = ws;

    ws.addEventListener("open", () => {
      setConnectionStore({ status: "open" });
    });

    ws.addEventListener("message", (ev) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(typeof ev.data === "string" ? ev.data : "");
      } catch {
        return;
      }
      const result = serverToClientSchema.safeParse(parsed);
      if (!result.success) return; // Drop unparseable frame safely (ws.ts:95-97)

      this.dispatch(result.data);
    });

    ws.addEventListener("close", () => {
      setConnectionStore({ status: "closed" });
      if (!this.explicitlyClosed) {
        this.reconnectTimer = setTimeout(() => this.connect(), 1000);
      }
    });
  }

  send(frame: ClientToServer): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify(frame));
    return true;
  }

  private dispatch(msg: ServerToClient): void {
    // Notify custom listeners (CursorManager, UI controllers)
    for (const sub of this.subscribers) {
      try { sub(msg); } catch {}
    }

    // Direct store sync based on frame type (ws.ts:98-246)
    switch (msg.type) {
      case "hello":
        setConnectionStore({ playerId: msg.playerId, serverTs: msg.serverTs });
        break;
      case "joined_room":
        setConnectionStore({ playerId: msg.playerId });
        setClockState({ offsetMs: msg.clockOffsetMs });
        if (msg.sessionToken) setSessionCookie(msg.roomCode, msg.sessionToken);
        break;
      // ... handling countdown, race_start, cursor_update, race_end
    }
  }
}
```

---

### 3. `apps/web/src/core/cursor-manager.ts`
**Role:** Hardware-Accelerated Animation Controller  
**Analog:** `apps/web/src/store/cursor.ts:10-40` & `apps/web/src/components/RaceView.tsx:135-151`.

#### Imports Pattern
```typescript
import type { PassageLayout } from "./layout.ts";
```

#### Snapshot Interpolation & Extrapolation Clamping Pattern
```typescript
export interface CursorSnapshot {
  index: number;
  receivedAt: number;
}

const BUFFER_MS = 100;
const MAX_EXTRAPOLATE_MS = 150;

export class CursorManager {
  private container: HTMLElement | null = null;
  private layout: PassageLayout | null = null;
  private buffers = new Map<string, CursorSnapshot[]>();
  private elements = new Map<string, { root: HTMLElement; tag: HTMLElement; caret: HTMLElement }>();
  private rafId: number | null = null;

  mount(container: HTMLElement, layout: PassageLayout): void {
    this.container = container;
    this.layout = layout;
    this.startLoop();
  }

  unmount(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.elements.forEach(({ root }) => root.remove());
    this.elements.clear();
    this.buffers.clear();
    this.container = null;
  }

  onCursorUpdate(playerId: string, index: number): void {
    const buf = this.buffers.get(playerId);
    if (!buf) return;
    const now = performance.now();
    // Rewind snap on backspace correction
    if (buf.length > 0 && index < buf[buf.length - 1].index) {
      buf.length = 0;
    }
    buf.push({ index, receivedAt: now });
    if (buf.length > 10) buf.shift();
  }

  private renderFrame(now: number): void {
    if (!this.layout) return;
    const targetTime = now - BUFFER_MS;

    for (const [playerId, buf] of this.buffers.entries()) {
      if (buf.length === 0) continue;
      const dom = this.elements.get(playerId);
      if (!dom) continue;

      let renderIndex = buf[buf.length - 1].index;

      if (buf.length > 1) {
        const first = buf[0];
        const last = buf[buf.length - 1];

        if (targetTime <= first.receivedAt) {
          renderIndex = first.index;
        } else if (targetTime >= last.receivedAt) {
          // Extrapolation clamping: cap to 150ms
          const dt = targetTime - last.receivedAt;
          if (dt <= MAX_EXTRAPOLATE_MS) {
            const prev = buf[buf.length - 2];
            const rate = (last.index - prev.index) / Math.max(1, last.receivedAt - prev.receivedAt);
            renderIndex = last.index + rate * dt;
          } else {
            renderIndex = last.index;
          }
        } else {
          // Linear interpolation between snapshots
          for (let i = 0; i < buf.length - 1; i++) {
            const s0 = buf[i];
            const s1 = buf[i + 1];
            if (targetTime >= s0.receivedAt && targetTime <= s1.receivedAt) {
              const alpha = (targetTime - s0.receivedAt) / (s1.receivedAt - s0.receivedAt);
              renderIndex = s0.index + alpha * (s1.index - s0.index);
              break;
            }
          }
        }
      }

      // 0 React commit: mutate DOM directly via translate3d
      const { x, y } = this.layout.getCoordinates(renderIndex);
      dom.root.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    }
  }
}
```

---

### 4. `apps/web/src/components/RaceView.tsx`
**Role:** Decoupled Presentational Race View  
**Analog:** `apps/web/src/components/RaceView.tsx:1-156`.

#### Refactored Component Pattern
```typescript
import { useEffect, useRef } from "react";
import { useRaceStore, type CharState } from "../store/race.ts";
import { useCursorStore } from "../store/cursor.ts";
import { CursorManager } from "../core/cursor-manager.ts";
import { PassageLayout } from "../core/layout.ts";
import { TypingEngine } from "../core/typing-engine.ts";

export function RaceView({
  passageText,
  typingEngine,
  cursorManager,
  passageLayout,
}: {
  passageText: string;
  typingEngine: TypingEngine;
  cursorManager: CursorManager;
  passageLayout: PassageLayout;
}): React.ReactElement {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const ownCharStates = useRaceStore((s) => s.ownCharStates);
  const ownIndex = useCursorStore((s) => s.ownIndex);

  // Mount cursor overlay outside React tree
  useEffect(() => {
    if (!overlayRef.current) return;
    cursorManager.mount(overlayRef.current, passageLayout);
    return () => cursorManager.unmount();
  }, [cursorManager, passageLayout]);

  // Handle keyboard events via TypingEngine
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => typingEngine.handleKeyDown(e);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [typingEngine]);

  return (
    <div className="race-view relative mx-auto w-full max-w-[800px] select-none font-mono">
      {/* HUD: Net WPM, Rank Badge, Progress Bar */}
      <div className="hud-bar flex items-center justify-between mb-4">...</div>

      {/* Track container with static passage spans and cursor overlay */}
      <div ref={trackRef} className="passage-track relative text-lg leading-relaxed">
        {passageText.split("").map((ch, i) => (
          <span key={i} className={`char char-${ownCharStates[i] ?? "pending"}`}>
            {ch}
          </span>
        ))}
        {/* Isolated DOM container mutated exclusively by CursorManager */}
        <div ref={overlayRef} className="cursor-overlay absolute inset-0 pointer-events-none" />
      </div>
    </div>
  );
}
```

---

### 5. `apps/web/src/components/LobbyView.tsx`
**Role:** Lobby View with Ready Check & Passage Filters  
**Analog:** `apps/web/src/components/LobbyView.tsx:1-103`.

#### Pattern with Ready Check & Filter Pills
```typescript
import { useState } from "react";
import { PASSAGES, type Passage } from "@typing-race/shared";
import { useRaceStore } from "../store/race.ts";
import { useConnectionStore } from "../store/connection.ts";

export type PassageLengthFilter = "all" | "short" | "medium" | "long";

export function LobbyView({
  roomCode,
  isHost,
  players,
  onStartRace,
  onToggleReady,
}: {
  roomCode: string;
  isHost: boolean;
  players: Array<{ playerId: string; nickname: string; isReady?: boolean; isHost: boolean }>;
  onStartRace: (passageId: string, graceSeconds: number) => void;
  onToggleReady: (ready: boolean) => void;
}): React.ReactElement {
  const myId = useConnectionStore((s) => s.playerId);
  const me = players.find((p) => p.playerId === myId);
  const [filterLength, setFilterLength] = useState<PassageLengthFilter>("all");
  const [hasPunctuation, setHasPunctuation] = useState<boolean | null>(null);

  const allGuestsReady = players.filter((p) => !p.isHost).every((p) => p.isReady);

  return (
    <div className="lobby-view max-w-xl mx-auto p-6 rounded-xl bg-black-forest-900 border border-copperwood-800">
      {/* Per-player readiness list */}
      <div className="player-list mb-6">
        {players.map((p) => (
          <div key={p.playerId} className="flex items-center justify-between py-2 border-b border-copperwood-900">
            <span className="font-mono text-cornsilk-100">{p.nickname} {p.isHost && "(Host)"}</span>
            <span className={p.isReady ? "text-olive-leaf-400 font-bold" : "text-cornsilk-700"}>
              {p.isReady ? "✓ Ready" : "Waiting…"}
            </span>
          </div>
        ))}
      </div>

      {/* Guest Ready Button */}
      {!isHost && (
        <button
          type="button"
          onClick={() => onToggleReady(!me?.isReady)}
          className={`w-full py-3 rounded-lg font-bold transition-colors ${
            me?.isReady ? "bg-copperwood-700 text-cornsilk-100" : "bg-olive-leaf-500 text-black-forest-950"
          }`}
        >
          {me?.isReady ? "Cancel Ready" : "Ready Up"}
        </button>
      )}

      {/* Host Controls */}
      {isHost && (
        <div className="host-controls">
          {/* Passage Filter Controls (D-15) */}
          <div className="filters flex gap-2 mb-4">...</div>
          <button
            type="button"
            onClick={() => onStartRace(pickedId, grace)}
            className={`w-full py-3 rounded-lg font-bold ${
              allGuestsReady ? "bg-sunlit-clay-500 text-black-forest-950" : "bg-sunlit-clay-800 text-cornsilk-300"
            }`}
          >
            {allGuestsReady ? "All Ready — Start Race" : "Force Start Race"}
          </button>
        </div>
      )}
    </div>
  );
}
```

---

### 6. `apps/web/src/components/ResultsBoard.tsx`
**Role:** Ranked Results Table with Podium Accents  
**Analog:** `apps/web/src/components/ResultsBoard.tsx:1-89`.

#### Time Delta & Podium Medal Pattern
```typescript
import { useMemo } from "react";
import type { PlayerFinalStats } from "@typing-race/shared";
import { useConnectionStore } from "../store/connection.ts";

const PODIUM_MEDALS = ["🥇", "🥈", "🥉"];

export function ResultsBoard({
  results,
  isHost,
  onRematch,
}: {
  results: PlayerFinalStats[];
  isHost: boolean;
  onRematch: () => void;
}): React.ReactElement | null {
  const myId = useConnectionStore((s) => s.playerId);

  const ranked = useMemo(() => {
    return [...results].sort((a, b) => {
      if (a.finishTimeMs !== b.finishTimeMs) return a.finishTimeMs - b.finishTimeMs;
      return b.wpm - a.wpm; // Tiebreaker
    });
  }, [results]);

  const winnerTimeMs = ranked[0]?.finishTimeMs ?? 0;

  return (
    <div className="results-board max-w-2xl mx-auto p-6 rounded-xl bg-black-forest-900 border border-copperwood-800">
      <h2 className="text-2xl font-bold text-cornsilk-100 mb-4">Race Results</h2>
      <table className="w-full text-left font-mono">
        <thead>
          <tr className="border-b border-copperwood-800 text-cornsilk-500">
            <th className="py-2">Rank</th>
            <th>Player</th>
            <th>Time</th>
            <th>Delta</th>
            <th>WPM</th>
            <th>Accuracy</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((r, i) => {
            const isMe = r.playerId === myId;
            const deltaMs = r.finishTimeMs - winnerTimeMs;
            const deltaStr = i === 0 ? "Winner" : `+${(deltaMs / 1000).toFixed(1)}s`;

            return (
              <tr key={r.playerId} className={`border-b border-copperwood-950 ${isMe ? "bg-copperwood-900/30" : ""}`}>
                <td className="py-3 font-bold">{PODIUM_MEDALS[i] ?? `#${i + 1}`}</td>
                <td>{isMe ? `${r.playerId.slice(0, 8)}… (You)` : `${r.playerId.slice(0, 8)}…`}</td>
                <td>{(r.finishTimeMs / 1000).toFixed(1)}s</td>
                <td className="text-sunlit-clay-400">{deltaStr}</td>
                <td className="font-bold text-cornsilk-100">{r.wpm.toFixed(0)}</td>
                <td>{(r.accuracy * 100).toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

---

### 7. `packages/shared/src/messages.ts`
**Role:** Shared Wire Protocol Schemas  
**Analog:** `packages/shared/src/messages.ts:17-23, 63-68, 108-120`.

#### Schema Extensions Pattern
```typescript
// 1. Extend PLAYER_SUMMARY with optional isReady (messages.ts:17-23)
const PLAYER_SUMMARY = z.object({
  playerId: z.string().uuid(),
  nickname: z.string(),
  isHost: z.boolean(),
  progress: z.number().int().nonnegative(),
  isReady: z.boolean().optional(),
});

// 2. Add set_ready schema for client -> server
export const setReadySchema = z.object({
  type: z.literal("set_ready"),
  ready: z.boolean(),
});

// 3. Include in clientToServerSchema union (messages.ts:108-120)
export const clientToServerSchema = z.discriminatedUnion("type", [
  clientPingSchema,
  joinRoomSchema,
  leaveRoomSchema,
  createRoomSchema,
  clockSyncSchema,
  startRaceSchema,
  keystrokeSchema,
  cursorPositionSchema,
  correctionSchema,
  returnToLobbySchema,
  rejoinRoomSchema,
  setReadySchema,
]);

export type SetReady = z.infer<typeof setReadySchema>;
```

---

### 8. `apps/server/src/ws/dispatch.ts`
**Role:** WebSocket Frame Router  
**Analog:** `apps/server/src/ws/dispatch.ts:194-218, 464-468`.

#### Handling `set_ready` Pattern
```typescript
case "set_ready": {
  const code = ws.data.roomCode;
  if (!code) return;
  const room = rooms.get(code);
  if (!room || room.state !== "lobby") return;
  const player = room.players.get(ws.data.playerId);
  if (!player) return;

  player.isReady = msg.ready;
  broadcastLobbyState(room);
  break;
}
```

---

## Shared Patterns

### Store Bridge & Outside-React Updates Pattern (Zustand 5)
When non-React services (`RaceClient`, `TypingEngine`, `WsConnection`) push high-frequency updates into Zustand without invoking hooks or creating component commit storms:
```typescript
// apps/web/src/store/race.ts
export const setRaceState = (
  patch: Partial<RaceUiState> | ((s: RaceUiState) => Partial<RaceUiState>),
): void => {
  useRaceStore.setState(patch);
};
```

### Zero-Commit Animation Pattern (`requestAnimationFrame` + `translate3d`)
Opponent cursors do not write to React state on every frame. Instead:
1. Component mounts `<div ref={containerRef} className="cursor-overlay absolute inset-0" />`.
2. Manager maintains internal DOM element map `<div class="opponent-cursor-root will-change-transform">`.
3. rAF callback interpolates coordinates and sets `element.style.transform = "translate3d(" + x + "px, " + y + "px, 0)"`.
4. React Profiler records 0 commits while cursor glides smoothly at 60fps.

### Vitest + Happy-DOM Canvas 2D Mocking Pattern
`happy-dom` lacks native HTML5 Canvas 2D text measurement. Unit tests for `layout.ts` and `cursor-manager.ts` mock `CanvasRenderingContext2D.measureText`:
```typescript
// apps/web/src/__tests__/layout.test.ts
import { beforeAll, vi } from "vitest";

beforeAll(() => {
  if (typeof window !== "undefined") {
    window.HTMLCanvasElement.prototype.getContext = vi.fn((type: string) => {
      if (type === "2d") {
        return {
          font: "",
          measureText: (text: string) => ({
            width: text.length * 9.6, // Monospace 16px char width advance
            actualBoundingBoxAscent: 12,
            actualBoundingBoxDescent: 4,
          }),
        } as unknown as CanvasRenderingContext2D;
      }
      return null;
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  }
});
```

---

## No Analog Found

### `apps/web/src/core/layout.ts` (Pretext DOM-Free Multiline Text Layout)
**Reason:** No file in the current repository performs Canvas 2D text layout or word segmentation without DOM queries.  
**Specification:**
- Uses `@chenglou/pretext` `prepareWithSegments(passageText, font)` to segment words and calculate grapheme advances via canvas measureText.
- Calls `layoutWithLines(prepared, containerWidth, lineHeight)` to calculate line breaks without forced DOM reflows.
- Caches line ranges: `[{ start: 0, end: 42, y: 0 }, { start: 42, end: 85, y: 32 }]`.
- Monospace character width is computed once: `ctx.measureText("M").width`.
- Provides O(1) arithmetic coordinate lookup `getCoordinates(progress: number): { x: number; y: number }`.

```typescript
import { prepareWithSegments, layoutWithLines, type PreparedTextWithSegments } from "@chenglou/pretext";

export interface LineRange {
  start: number;
  end: number;
  width: number;
  y: number;
}

export class PassageLayout {
  private prepared: PreparedTextWithSegments | null = null;
  private lineRanges: LineRange[] = [];
  private charWidth = 9.6;
  private lineHeight = 32;

  init(passageText: string, font: string, lineHeight: number): void {
    this.lineHeight = lineHeight;
    this.prepared = prepareWithSegments(passageText, font);
    if (typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.font = font;
        this.charWidth = ctx.measureText("M").width;
      }
    }
  }

  updateLayout(containerWidth: number): LineRange[] {
    if (!this.prepared) return [];
    const { lines } = layoutWithLines(this.prepared, containerWidth, this.lineHeight);
    let runningCharIndex = 0;
    this.lineRanges = lines.map((line, idx) => {
      const start = runningCharIndex;
      runningCharIndex += line.text.length;
      return { start, end: runningCharIndex, width: line.width, y: idx * this.lineHeight };
    });
    return this.lineRanges;
  }

  getCoordinates(progressIndex: number): { x: number; y: number } {
    if (this.lineRanges.length === 0) return { x: 0, y: 0 };
    for (let i = 0; i < this.lineRanges.length; i++) {
      const range = this.lineRanges[i];
      if (progressIndex >= range.start && (progressIndex < range.end || i === this.lineRanges.length - 1)) {
        const col = progressIndex - range.start;
        return { x: col * this.charWidth, y: range.y };
      }
    }
    const last = this.lineRanges[this.lineRanges.length - 1];
    return { x: (last.end - last.start) * this.charWidth, y: last.y };
  }
}
```

---

## Metadata

- **Coverage:** 22 out of 23 target files directly match established patterns in `apps/web/src`, `apps/server/src`, or `packages/shared/src`.
- **Architectural Shift:** Core modularity extraction (`TypingEngine`, `RaceClient`, `CursorManager`) decouples business logic from React views, ensuring clean testing and zero per-frame React commits.
- **Backwards Compatibility:** All wire schema extensions (`set_ready`, optional `isReady`) are additive and preserve 100% test compatibility with Phases 1–4.
