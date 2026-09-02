# Phase 5: Frontend Polish - Research

**Researched:** 2026-09-03  
**Domain:** Realtime Canvas/DOM text measurement, 60fps rAF cursor interpolation, CSS GPU-accelerated translation, Tailwind CSS v4 design system, UI-agnostic core engine  
**Confidence:** HIGH  

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Core Modularity & Architecture (UI Decoupling)
- **D-01: UI-agnostic core library.** Extract core typing and race engine logic into a headless, UI-agnostic module (`apps/web/src/core/` or `packages/core`) with event emitter and store adapters, decoupled from any React view hierarchy. — **Reversibility:** costly — touches all frontend call sites and component boundaries.
- **D-02: Centralized RaceClient singleton.** Dedicated service (`apps/web/src/net/race-client.ts`) that owns WebSocket lifecycle, auto-rejoin, heartbeats, and incoming message dispatch into stores; components only read stores or call client actions.
- **D-03: Headless CursorManager.** Dedicated animation controller running a `requestAnimationFrame` lerp loop that mutates opponent cursor DOM elements directly via CSS `transform: translate3d()`, bypassing React renders entirely (0 per-frame React re-renders). — **Reversibility:** costly — decouples cursor motion completely from React state.
- **D-04: Dedicated initial refactor pass in Plan 05-01.** Perform the core modularity extraction as the very first plan in Phase 5 so that downstream polish plans (cursor interpolation, HUD, styling) build directly on clean, decoupled architecture without rework.

#### Visual Theme & Styling Foundation
- **D-05: Tailwind CSS v4 integration.** Adopt Tailwind CSS v4 via `@tailwindcss/vite` with custom design tokens defined in `@theme`.
- **D-06: Custom earth/botanical palette.** Configure five semantic color scales in Tailwind:
  - **Olive Leaf:** `--color-olive-leaf-50: #f4f6ee` to `--color-olive-leaf-950: #15180c`
  - **Black Forest:** `--color-black-forest-50: #f3f7ed` to `--color-black-forest-950: #12190b` (deep organic dark surfaces & backgrounds)
  - **Cornsilk:** `--color-cornsilk-50: #fefbe6` to `--color-cornsilk-950: #231e01` (warm passage text & neutral readable contrast)
  - **Sunlit Clay:** `--color-sunlit-clay-50: #fbf3ea` to `--color-sunlit-clay-950: #1d1306` (warm highlights, primary accents, rank badges)
  - **Copperwood:** `--color-copperwood-50: #fbf2ea` to `--color-copperwood-950: #1e1106` (secondary interactive elements & borders)
- **D-07: Monospace typography.** Premium monospace font stack (`JetBrains Mono`, `Fira Code`, `SF Mono`, `ui-monospace`) for crisp character alignment and smooth cursor tracking.
- **D-08: Centered fixed-width race track.** Centered track container (approx 760px–800px) optimized for comfortable eye span and desktop focus.

#### Opponent Cursor Aesthetics & Player Tags
- **D-09: Deterministic pastel rainbow cursor colors.** Deterministic assignment based on player slot:
  1. Red: `#DA2C38`
  2. Coral/Rose: `#DF6873`
  3. Orange: `#EE7B30`
  4. Amber: `#FBD24B`
  5. Bright Yellow: `#F8F862`
  6. Pastel Green: `#87C38F`
  7. Cyan: `#99FFFC`
  8. Lavender/Purple: `#BE98D7`
- **D-10: Floating micro-tag.** Each opponent cursor features a small pill above the caret displaying the player's name (e.g. "Alice") so competitors immediately recognize who is passing them.
- **D-11: Caret visual style & ghost wake.** 2px wide vertical caret with subtle glow matching player color, combined with a soft fading ghost wake / trail particle effect behind the current race leader.
- **D-12: Own player cursor priority.** Local player's own cursor is styled distinctly and has the highest z-index, ensuring it is always on top and never obscured by opponent tags.

#### Lobby Ready Check & Countdown Flow
- **D-13: Per-player Ready toggle.** Guests toggle "Ready" in the lobby with visible checkmarks; Host "Start Race" button activates once players are ready (Host retains force-start override).
- **D-14: Dramatic 3-2-1 GO overlay.** Centered dramatic countdown animation with large motion-blurred numbers (3... 2... 1... GO!) that fades smoothly as typing unlocks at `startAtServerMs - clockOffset`.
- **D-15: Passage customization in lobby.** Passages are randomized from corpus by default, but Host can filter by length (short, medium, long) and details (punctuation, short words, paragraph style) via toggle pills.
- **D-16: Top-right stacking toast notifications.** Disconnect grace periods and reconnect notices appear in top-right floating toasts, with newer toasts spawning neatly below older ones.

#### Live Race HUD & Results Board
- **D-17: Compact status bar above track.** Live Net WPM (large integer), current rank badge (e.g. "#1"), and clean race progress percentage bar.
- **D-18: Sleek WPM hover tooltip.** Hovering over WPM reveals a popover breakdown: Net WPM, Raw WPM, Accuracy %, and uncorrected error count.
- **D-19: Non-intrusive glowing grace banner.** Pinned banner ("Alice finished 1st! 5s remaining...") with a countdown progress bar that leaves the passage text 100% in focus.
- **D-20: Ranked results table with podium accents.** Full ranked list of all players in clean rows, decorated with Gold/Silver/Bronze badges for top 3, finish time delta (`+1.2s to winner`), WPM, accuracy, and a prominent Rematch button.

### Claude's Discretion
- Exact rAF lerp smoothing math and buffer window (default 100ms buffer, 150ms max extrapolation).
- CSS transition easings for the 3-2-1 GO overlay and ghost wake opacity decay.
- Internal event emitter implementation details in the UI-agnostic core library.

### Deferred Ideas
None — discussion stayed within phase scope.

---

## Summary

Phase 5 delivers the "two-laptop demo wow" moment: buttery-smooth 60fps opponent cursors running on hardware-accelerated GPU translation (`translate3d`), with zero React reconciler commits during motion, an elegant earth/botanical dark theme, server-synced countdowns, lobby readiness checks, passage customization filters, and a polished race HUD and results board.

Currently in `apps/web/src/components/RaceView.tsx:141-150`, opponent cursors are rendered as inline React child spans inside individual character spans:
```tsx
<span key={i} className={`char char-${state}${isOwnCursor ? " own-cursor" : ""}`}>
  {ch}
  {opponentCursors.map((pid) => (
    <span key={pid} className="opponent-cursor" data-pid={pid} />
  ))}
</span>
```
Every incoming cursor update forces React to re-render character spans, creating severe layout thrashing and stuttering.

To achieve 60fps silky-smooth motion and modular code:
1. **Core Modularity:** Extract engine logic into `TypingEngine`, network transport into `RaceClient`, and animation into `CursorManager`.
2. **DOM-Free Multiline Text Layout (`@chenglou/pretext`):** Use Cheng Lou's `@chenglou/pretext` library to measure and wrap passage text into multiline layouts using HTML5 Canvas 2D and `Intl.Segmenter` without DOM reflows (`getBoundingClientRect()` or `offsetWidth/offsetHeight`).
3. **Hardware-Accelerated Cursor Overlay:** Opponent cursors live in a decoupled DOM container mutated directly via `translate3d(x, y, 0)` in a `requestAnimationFrame` loop driven by a 100ms snapshot interpolation buffer with lerp and 150ms extrapolation clamping.
4. **Visual & Styling Polish:** Modernize the app using Tailwind CSS v4 (`@tailwindcss/vite`), a custom botanical color palette, monospace typography, a synchronized 3-2-1 countdown overlay, per-player lobby readiness, passage filters, stacked top-right toasts, and a ranked results table with podium medals and time deltas.

---

## Architectural Responsibility Map

| Module / Component | Path | Responsibility | State / I/O Boundary |
|---|---|---|---|
| `TypingEngine` | `apps/web/src/core/typing-engine.ts` | Headless typing mechanics: keystroke input matching against passage, optimistic progress, char states (`pending`, `correct`, `error`), backspace logic, live raw & net WPM computation, uncorrected error tracking | Emits typed events (`keystroke`, `correction`, `stats_updated`, `finished`). Pure logic, 0 React dependencies. |
| `RaceClient` | `apps/web/src/net/race-client.ts` | Centralized WebSocket client singleton: socket lifecycle, auto-rejoin with cookie `sessionToken`, NTP clock sync, heartbeat, dispatching validated wire frames into stores | Singleton wrapping browser `WebSocket`. Interacts with `connectionStore`, `clockStore`, `raceStore`, `cursorStore`. |
| `CursorManager` | `apps/web/src/core/cursor-manager.ts` | Animation controller: maintains 100ms ring buffer of cursor positions per opponent, runs 60fps `requestAnimationFrame` lerp loop, maps progress to (x, y) via `pretext`, updates DOM via `translate3d` | Mounts to overlay DOM container. Mutates DOM directly outside React tree. 0 React renders per frame. |
| `PassageLayout` | `apps/web/src/core/layout.ts` | Multiline passage layout calculation: invokes `@chenglou/pretext` `prepareWithSegments` and `layoutWithLines`, calculates line wrapping, line offsets, and character (x, y) coordinates | Invoked on passage load or container resize via `ResizeObserver`. Pure arithmetic coordinate lookups. |
| `RaceStore` | `apps/web/src/store/race.ts` | Reactive state for room lifecycle, passage text, own char states, WPM stats, grace banner, results board | Zustand 5 store read by React UI components. |
| `CursorStore` | `apps/web/src/store/cursor.ts` | Minimal reactive store for discrete cursor events (e.g. ownIndex, backspace echoes, disconnects) | Zustand 5 store isolated from slow room state. |
| `RaceView` | `apps/web/src/components/RaceView.tsx` | Presentational typing surface: renders passage text with character states, hosts the cursor overlay container ref for `CursorManager`, captures keyboard events | React component listening to `TypingEngine` and `RaceClient`. |
| `LobbyView` | `apps/web/src/components/LobbyView.tsx` | Pre-race lobby: room code, player list, per-player ready checkmarks, passage category/length filters, host controls | React component sending `set_ready` and `start_race` frames. |
| `CountdownView` | `apps/web/src/components/CountdownView.tsx` | Dramatic 3-2-1 GO overlay: countdown anchored to `startsAtServerMs - clockOffsetMs`, motion blur / scale animations | React component overlaid on the track during countdown. |
| `ResultsBoard` | `apps/web/src/components/ResultsBoard.tsx` | Post-race standings: podium medals (🥇🥈🥉), finish time delta to winner, net WPM, accuracy, rematch button | React component displayed on `race_end`. |
| `ToastQueue` | `apps/web/src/components/ToastQueue.tsx` | Top-right stacked floating notifications: disconnect grace progress bar (60s/5s), reconnect notices, error banners | React portal / top-right container. |

---

## Phase Requirements

Addressing **REQ-06 (live opponent cursors — interpolation polish)** and the 5 Success Criteria from `ROADMAP.md §Phase 5`:

- **Success Criterion 1:** Two side-by-side browser windows show opponent cursor moving smoothly across the passage with no visible jitter at 60fps (cursor interpolation verified under simulated 100ms RTT).
- **Success Criterion 2:** CSS `transform: translate3d()` used for cursor positioning outside the React tree — React DevTools profile shows no per-frame React renders for cursor motion.
- **Success Criterion 3:** Lobby shows per-player "ready" indicator; countdown UI ticks down based on `startAtServerMs - clockOffset` (not local clock).
- **Success Criterion 4:** Disconnect shows "Reconnecting… (5s)" progress bar; reconnect success restores prior view; reconnect failure shows distinct toast ("Lost connection — room lost" vs "Server restarted").
- **Success Criterion 5:** WPM displayed rounded to integer with raw + net breakdown on hover; time-delta-to-winner shown on results.

---

## Standard Stack

### Core Technologies
- **Runtime & Package Manager:** Bun 1.3.2 [VERIFIED: package.json]
- **Frontend Framework:** React 19.2.8 & React DOM 19.2.8 [VERIFIED: apps/web/package.json:14-15]
- **State Management:** Zustand 5.0.15 [VERIFIED: apps/web/package.json:17]
- **Type Validation:** Zod 4.5.4 [VERIFIED: apps/web/package.json:16]
- **Build Tool:** Vite 8.2.2 [VERIFIED: apps/web/package.json:28]
- **Test Runners:** Vitest 4.1.11 with `@testing-library/react` 16.3.3 and `happy-dom` 20.12.0 [VERIFIED: apps/web/package.json:20-30]

### Added Technologies (Phase 5 Polish)
- **Styling:** `tailwindcss` 4.3.3 and `@tailwindcss/vite` 4.3.3 [VERIFIED: npm registry]
- **Utility:** `clsx` 2.1.1 for conditional CSS class composition [VERIFIED: npm registry]
- **Layout & Text Measurement:** `@chenglou/pretext` 0.0.8 [VERIFIED: npm registry] — zero-dependency DOM-free multiline text measurement engine by Cheng Lou.

---

## Package Legitimacy Audit

### 1. `@chenglou/pretext`
- **Registry:** npm (`@chenglou/pretext`) [VERIFIED: npm registry]
- **Version:** `0.0.8` (latest, published 2 months ago) [VERIFIED: npm registry]
- **License:** MIT [VERIFIED: npm registry]
- **Dependencies:** 0 dependencies (`deps: none`) [VERIFIED: npm registry]
- **Unpacked Size:** 902.2 kB (includes Unicode segmentation tables and precompiled bidi / emoji tables) [VERIFIED: npm registry]
- **Author:** Cheng Lou (former React core team member, creator of React Motion and ReScript) [VERIFIED: github.com/chenglou/pretext]
- **Primary Exports:**
  - `.` (`./dist/layout.js`, `./dist/layout.d.ts`): `prepare`, `prepareWithSegments`, `layout`, `layoutWithLines`, `walkLineRanges`, `measureLineStats` [VERIFIED: npm registry]
  - `./rich-inline`: helper for inline chips/mentions [VERIFIED: npm registry]
- **Fit for Typing Race:** Directly solves the multiline character-to-(x, y) coordinate mapping problem without forced DOM reflows (`getBoundingClientRect()` / `offsetWidth`).
- **Environment Requirement:** Requires Canvas 2D API (`OffscreenCanvas` or `document.createElement("canvas")`). Natively supported in all modern browsers (Chrome, Safari, Firefox, Edge). In headless test runners (Vitest with `happy-dom`), requires a lightweight 2D canvas context mock [VERIFIED: empirical test in apps/web].

### 2. `tailwindcss` & `@tailwindcss/vite`
- **Registry:** npm (`tailwindcss`, `@tailwindcss/vite`) [VERIFIED: npm registry]
- **Version:** `4.3.3` [VERIFIED: npm registry]
- **License:** MIT [VERIFIED: npm registry]
- **Architecture:** Tailwind CSS v4 is a CSS-first engine powered by Lightning CSS. It eliminates `tailwind.config.js` and `@tailwind` directives in favor of `@import "tailwindcss";` and `@theme { ... }` blocks directly in CSS [CITED: tailwindcss.com].
- **Vite Integration:** Configured via `tailwindcss()` plugin in `vite.config.ts`. Automatically discovers classes across JSX/TSX files without manual `content` glob configuration [CITED: tailwindcss.com].

### 3. `clsx`
- **Registry:** npm (`clsx`) [VERIFIED: npm registry]
- **Version:** `2.1.1` [VERIFIED: npm registry]
- **License:** MIT [VERIFIED: npm registry]
- **Size:** <1 kB [VERIFIED: npm registry]
- **Purpose:** Clean, fast concatenation of conditional Tailwind classes for character states, cursor colors, and badge tiers.

---

## Architecture Patterns

### Pattern 1: DOM-Free Multiline Coordinate Calculation via `@chenglou/pretext`

In a multiline passage layout, mapping a player's character progress index (e.g. index 37.4) to pixel coordinates $(x, y)$ traditionally requires either:
- Querying DOM nodes: `charSpan.offsetLeft` and `charSpan.offsetTop`, or `getBoundingClientRect()`. When called at 60fps across multiple opponents, this triggers **forced synchronous layout reflow** (layout thrashing), causing massive jank and 30ms+ frame drops.
- Approximating with arbitrary line-wrap guesses, which fails when punctuation hangs, words break across lines, or container width changes.

`@chenglou/pretext` solves this by using the browser's own font engine via Canvas 2D and `Intl.Segmenter` in a two-phase process:
1. **Prepare Phase (Cold path):** Run once when the passage text or font changes:
   ```ts
   const prepared = prepareWithSegments(passageText, font);
   ```
   Pretext segments words, measures grapheme advances via canvas, and caches word metrics.
2. **Layout Phase (Warm path):** Run on container mount or resize (`ResizeObserver`):
   ```ts
   const { lines } = layoutWithLines(prepared, trackWidth, lineHeight);
   ```
   Pretext runs pure arithmetic over cached segment widths to determine the exact line breaks that the browser CSS engine produces.
3. **Coordinate Lookup (Hot path - 60fps in rAF):**
   Given `lines` and a monospace font advance `charWidth`:
   ```ts
   // Precomputed line index boundaries: [{ startChar, endChar, y }]
   function getCoordinatesForProgress(progressIndex: number): { x: number; y: number } {
     for (let lineIdx = 0; lineIdx < lineRanges.length; lineIdx++) {
       const range = lineRanges[lineIdx];
       if (progressIndex >= range.start && (progressIndex < range.end || lineIdx === lineRanges.length - 1)) {
         const col = progressIndex - range.start;
         return {
           x: col * charWidth,
           y: lineIdx * lineHeight,
         };
       }
     }
     return { x: 0, y: 0 };
   }
   ```
   **Execution cost:** ~0.0005ms per frame. Zero DOM reads. Zero layout reflow.

```
+-----------------------------------------------------------------------------------+
| PRETEXT PIPELINE                                                                  |
|                                                                                   |
| 1. Passage Text  --> prepareWithSegments(text, font) [Canvas measure once]        |
| 2. Track Width   --> layoutWithLines(prepared, width, lineH) [Pure arithmetic]   |
| 3. Line Ranges   --> Cached: [{ start: 0, end: 24 }, { start: 24, end: 48 }]     |
| 4. In rAF (60fps)--> getCoordinates(progress) --> translate3d(x, y, 0)           |
+-----------------------------------------------------------------------------------+
```

### Pattern 2: Headless `CursorManager` with Hardware-Accelerated Overlay

To satisfy **REQ-06** and **Success Criterion 2** (0 per-frame React re-renders), cursor DOM manipulation is decoupled completely from React state:

1. React renders a static container `<div ref={overlayRef} className="cursors-overlay" />`.
2. `RaceView` calls `cursorManager.mount(overlayRef.current)`.
3. `CursorManager` maintains native DOM elements for each opponent cursor:
   ```ts
   class CursorManager {
     private cursors = new Map<string, OpponentCursorEntry>();
     private rafId: number | null = null;
     private container: HTMLElement | null = null;
     // ...
   }
   ```
4. Each frame in `requestAnimationFrame(this.renderLoop)`:
   - Evaluates current time `now = performance.now()`.
   - Computes render time `renderTs = now - bufferDurationMs (100ms)`.
   - For each active player, computes `interpolatedIndex` from snapshot buffer.
   - Computes `(x, y)` via Pretext layout arithmetic.
   - Sets `cursorEl.style.transform = `translate3d(${x}px, ${y}px, 0)``.
5. React DevTools profiler shows **ZERO commits** during cursor motion because React's reconciler is never invoked.

### Pattern 3: 100ms Client Interpolation Buffer Math

Network packets (`cursor_update`) arrive at irregular intervals (~5–15Hz per typing player, subject to network jitter and latency). To display smooth 60fps linear motion:

1. **Snapshot Ring Buffer:** For each player, maintain an array of recent position snapshots:
   `Snapshot: { index: number, localReceivedAt: number }`.
2. **Target Render Timestamp:**
   $t_{\text{target}} = \text{now} - 100\text{ms}$.
3. **Interpolation (Lerp):**
   Find snapshots $S_0$ and $S_1$ such that:
   $S_0.localReceivedAt \le t_{\text{target}} \le S_1.localReceivedAt$.
   Calculate interpolation factor:
   $$\alpha = \frac{t_{\text{target}} - S_0.localReceivedAt}{S_1.localReceivedAt - S_0.localReceivedAt}, \quad \alpha \in [0, 1]$$
   $$\text{interpolatedProgress} = S_0.index + \alpha \cdot (S_1.index - S_0.index)$$
4. **Extrapolation Clamping:**
   If $t_{\text{target}} > S_{\text{latest}}.localReceivedAt$ (e.g. packet delay or network hiccup):
   Extrapolate forward using the velocity between the last two snapshots:
   $$\text{elapsedSinceLatest} = t_{\text{target}} - S_{\text{latest}}.localReceivedAt$$
   If $\text{elapsedSinceLatest} \le 150\text{ms}$:
   $$\text{extrapolatedProgress} = S_{\text{latest}}.index + \text{velocity} \cdot \text{elapsedSinceLatest}$$
   If $\text{elapsedSinceLatest} > 150\text{ms}$:
   Clamp and freeze progress at $S_{\text{latest}}.index$ to avoid runaway overshoot into untyped text.
5. **Rewind Snapping (Backspace):**
   If $S_1.index < S_0.index$ (player backspaced or corrected), do NOT lerp backward smoothly. Immediately snap to the lower index to reflect the correction accurately.
6. **Finish Snapping:**
   When player progress reaches `passageText.length`, snap immediately to the passage end.

### Pattern 4: Lobby Ready Check Wire Protocol Extension

To implement **D-13** (Per-player Ready toggle in lobby), extend the wire contract in `packages/shared/src/messages.ts`:

1. **Client → Server:** Add `set_ready` frame:
   ```ts
   export const setReadySchema = z.object({
     type: z.literal("set_ready"),
     ready: z.boolean(),
   });
   ```
2. **Shared Model:** Add optional `isReady?: boolean` to `PLAYER_SUMMARY`:
   ```ts
   const PLAYER_SUMMARY = z.object({
     playerId: z.string().uuid(),
     nickname: z.string(),
     isHost: z.boolean(),
     progress: z.number().int().nonnegative(),
     isReady: z.boolean().optional(),
   });
   ```
   Making `isReady` optional preserves 100% backward compatibility with all existing Phase 1–4 test fixtures and snapshots.
3. **Server Dispatch:** In `apps/server/src/ws/dispatch.ts`:
   When `set_ready` is received:
   Update `player.isReady = msg.ready`.
   Broadcast updated `lobby_state` to all players in the room.
   Reset `isReady = false` when returning to lobby or initiating a rematch.
4. **Host Controls:**
   In `LobbyView`, the "Start Race" button is visually styled as "All Ready — Start Race" when all guests are ready, or "Force Start Race" with a subtle warning if some guests are not ready (host retains override).

---

## Don't Hand-Roll

| Problem | Don't Hand-Roll | Use Instead | Why |
|---|---|---|---|
| Multiline text measurement & wrapping | Measuring DOM spans via `getBoundingClientRect()` or `offsetWidth/offsetHeight` | `@chenglou/pretext` (`prepareWithSegments` + `layoutWithLines`) | DOM reads force browser layout reflows. Pretext runs pure arithmetic over Canvas 2D metrics in 0.0002ms without reflows. |
| Cursor movement loop | React state updates (`useState`, `useEffect`) triggered by incoming WebSocket frames | Headless `CursorManager` with `requestAnimationFrame` + `translate3d` | React state updates at 60fps cause render storms and garbage collection pauses. rAF + `translate3d` runs on the GPU compositor thread. |
| Design tokens & styling | Hand-written custom CSS utility classes and hex-code stylesheets | Tailwind CSS v4 `@theme` with custom color scales | Centralizes palette tokens, guarantees uniform dark theme contrast, eliminates custom CSS bloat. |
| Time synchronization | Local browser `Date.now()` or `performance.now()` for countdowns | `startsAtServerMs - clockOffsetMs` via Phase 2 NTP clock sync | Client system clocks drift by seconds; server-authoritative timestamps prevent early/late race starts across machines. |
| Passage filtering | Complex backend database queries or server filter routes | Frontend filter predicate over bundled `PASSAGES` array | All 50 curated passages are bundled client-side in `@typing-race/shared`. Filtering by length or punctuation is instant in-memory. |

---

## Common Pitfalls

### Pitfall 1: Layout Thrashing via DOM Reading in the Animation Loop
**Symptom:** Stuttering frames, dropped frames in Chrome DevTools Performance panel, warnings about "Forced synchronous layout".  
**Root Cause:** Calling `element.offsetLeft`, `element.getBoundingClientRect()`, or `window.getComputedStyle()` inside the `requestAnimationFrame` loop before or after setting `element.style.transform`.  
**Prevention:** Never query the DOM in the rAF loop. Measure passage layout once via Pretext when the track mounts or resizes. In the rAF loop, only perform arithmetic and write to `element.style.transform`.

### Pitfall 2: React Re-Render Storms from Cursor Store Updates
**Symptom:** React DevTools Profiler highlights `RaceView` re-rendering 30–60 times per second.  
**Root Cause:** Component subscribes to `useCursorStore((s) => s.cursors)` or updating React state on every incoming cursor packet.  
**Prevention:** Decouple cursor positions from React component state. `RaceClient` feeds raw packets into `CursorManager`'s memory buffer. React components only render the passage characters and UI shell.

### Pitfall 3: Extrapolation Overshoot / Runaway Cursors
**Symptom:** An opponent stops typing or experiences packet loss, and their cursor continues gliding forward past the text they actually typed.  
**Root Cause:** Unbounded linear extrapolation using the last measured typing velocity.  
**Prevention:** Hard-cap extrapolation to 150ms. If no new snapshot arrives within 150ms of the target render timestamp, clamp progress at the last known snapshot position.

### Pitfall 4: Smooth Rewind on Backspace / Correction
**Symptom:** When a player backspaces 5 characters, their opponent sees the cursor glide backward smoothly across the screen like a tape rewinding.  
**Root Cause:** Applying positive lerp interpolation across a snapshot boundary where $S_1.index < S_0.index$.  
**Prevention:** Detect correction echoes ($S_{\text{new}}.index < S_{\text{prev}}.index$) and immediately snap the player's interpolation buffer and current rendered progress to the corrected index without lerping.

### Pitfall 5: Pretext in Headless Test Environments (Vitest / Happy-DOM)
**Symptom:** `TypeError: null is not an object (evaluating 'ctx.font = font')` or `Text measurement requires OffscreenCanvas or a DOM canvas context` when running Vitest [VERIFIED: empirical test in apps/web].  
**Root Cause:** `happy-dom` does not provide an active Canvas 2D rendering context by default.  
**Prevention:** In `vitest.setup.ts` or test helpers, mock `HTMLCanvasElement.prototype.getContext("2d")`:
```ts
if (typeof window !== "undefined") {
  window.HTMLCanvasElement.prototype.getContext = function (type: string) {
    if (type === "2d") {
      return {
        font: "",
        measureText: (text: string) => ({
          width: text.length * 9.6, // standard 16px monospace character width
          actualBoundingBoxAscent: 12,
          actualBoundingBoxDescent: 4,
        }),
      } as unknown as CanvasRenderingContext2D;
    }
    return null;
  };
}
```

### Pitfall 6: Font Mismatch between Pretext Measurement and CSS Rendering
**Symptom:** Pretext wraps a line at 42 characters, but the browser DOM wraps it at 41 characters, causing the cursor to drift out of alignment.  
**Root Cause:** Passing a generic font string to `prepareWithSegments` (e.g. `"monospace"`) while CSS uses a specific font (e.g. `"JetBrains Mono"`), or line-height / letter-spacing differences.  
**Prevention:**
1. Pin the font family stack in Tailwind `@theme`:
   `--font-mono: "JetBrains Mono", "Fira Code", "SF Mono", ui-monospace, monospace;`
2. Pass the exact CSS font definition to Pretext:
   `prepareWithSegments(passageText, '18px "JetBrains Mono", "Fira Code", monospace')`.
3. Set CSS `white-space: pre-wrap; word-break: normal;` on the passage container to match Pretext's layout options.

---

## Code Examples

### 1. Pretext Multiline Layout Helper (`apps/web/src/core/layout.ts`)

```typescript
import { prepareWithSegments, layoutWithLines, type PreparedTextWithSegments } from "@chenglou/pretext";

export interface LineRange {
  start: number; // inclusive char index in passageText
  end: number;   // exclusive char index in passageText
  width: number;
  y: number;
}

export class PassageLayout {
  private prepared: PreparedTextWithSegments | null = null;
  private lineRanges: LineRange[] = [];
  private charWidth: number = 9.6; // default fallback
  private lineHeight: number = 32;

  init(passageText: string, font: string, lineHeight: number): void {
    this.lineHeight = lineHeight;
    this.prepared = prepareWithSegments(passageText, font);
    
    // Measure single character advance for monospace font
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
      return {
        start,
        end: runningCharIndex,
        width: line.width,
        y: idx * this.lineHeight,
      };
    });
    return this.lineRanges;
  }

  getCoordinates(progressIndex: number): { x: number; y: number } {
    if (this.lineRanges.length === 0) return { x: 0, y: 0 };
    
    for (let i = 0; i < this.lineRanges.length; i++) {
      const range = this.lineRanges[i];
      if (progressIndex >= range.start && (progressIndex < range.end || i === this.lineRanges.length - 1)) {
        const col = progressIndex - range.start;
        return {
          x: col * this.charWidth,
          y: range.y,
        };
      }
    }
    const last = this.lineRanges[this.lineRanges.length - 1];
    return { x: (last.end - last.start) * this.charWidth, y: last.y };
  }
}
```

### 2. Headless `CursorManager` Animation Loop (`apps/web/src/core/cursor-manager.ts`)

```typescript
import type { PassageLayout } from "./layout.ts";

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
  private playerColors = new Map<string, string>();
  private leaderId: string | null = null;
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

  registerPlayer(playerId: string, nickname: string, color: string): void {
    if (!this.container) return;
    this.playerColors.set(playerId, color);

    const root = document.createElement("div");
    root.className = "opponent-cursor-root pointer-events-none absolute top-0 left-0 will-change-transform";
    root.style.zIndex = "10";

    const tag = document.createElement("div");
    tag.className = "cursor-micro-tag absolute bottom-full left-0 mb-1 px-1.5 py-0.5 rounded text-[10px] font-bold shadow-md whitespace-nowrap";
    tag.style.backgroundColor = color;
    tag.style.color = "#12190b";
    tag.textContent = nickname;

    const caret = document.createElement("div");
    caret.className = "cursor-caret w-[2px] h-[1.3em] rounded-full transition-shadow duration-300";
    caret.style.backgroundColor = color;
    caret.style.boxShadow = `0 0 8px ${color}`;

    root.appendChild(tag);
    root.appendChild(caret);
    this.container.appendChild(root);

    this.elements.set(playerId, { root, tag, caret });
    this.buffers.set(playerId, []);
  }

  removePlayer(playerId: string): void {
    const entry = this.elements.get(playerId);
    if (entry) {
      entry.root.remove();
      this.elements.delete(playerId);
    }
    this.buffers.delete(playerId);
  }

  onCursorUpdate(playerId: string, index: number, serverTs: number): void {
    const buf = this.buffers.get(playerId);
    if (!buf) return;
    
    const now = performance.now();
    // Rewind snap on backspace
    if (buf.length > 0 && index < buf[buf.length - 1].index) {
      buf.length = 0;
    }
    buf.push({ index, receivedAt: now });
    // Keep max 10 recent snapshots
    if (buf.length > 10) buf.shift();
  }

  private startLoop(): void {
    const tick = (now: number) => {
      this.renderFrame(now);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private renderFrame(now: number): void {
    if (!this.layout) return;
    const targetTime = now - BUFFER_MS;

    let currentLeaderId: string | null = null;
    let maxProgress = -1;

    for (const [playerId, buf] of this.buffers.entries()) {
      if (buf.length === 0) continue;
      const dom = this.elements.get(playerId);
      if (!dom) continue;

      let renderIndex = buf[buf.length - 1].index;

      if (buf.length === 1) {
        renderIndex = buf[0].index;
      } else {
        const first = buf[0];
        const last = buf[buf.length - 1];

        if (targetTime <= first.receivedAt) {
          renderIndex = first.index;
        } else if (targetTime >= last.receivedAt) {
          // Extrapolation clamp
          const dt = targetTime - last.receivedAt;
          if (dt <= MAX_EXTRAPOLATE_MS) {
            const prev = buf[buf.length - 2];
            const rate = (last.index - prev.index) / Math.max(1, last.receivedAt - prev.receivedAt);
            renderIndex = last.index + rate * dt;
          } else {
            renderIndex = last.index;
          }
        } else {
          // Interpolation between two snapshots
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

      if (renderIndex > maxProgress) {
        maxProgress = renderIndex;
        currentLeaderId = playerId;
      }

      const { x, y } = this.layout.getCoordinates(renderIndex);
      dom.root.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    }

    // Ghost wake on race leader (D-11)
    if (currentLeaderId !== this.leaderId) {
      if (this.leaderId) {
        this.elements.get(this.leaderId)?.caret.classList.remove("leader-glow");
      }
      if (currentLeaderId) {
        this.elements.get(currentLeaderId)?.caret.classList.add("leader-glow");
      }
      this.leaderId = currentLeaderId;
    }
  }
}
```

### 3. Tailwind CSS v4 Theme Configuration (`apps/web/src/styles.css`)

```css
@import "tailwindcss";

@theme {
  --font-mono: "JetBrains Mono", "Fira Code", "SF Mono", ui-monospace, monospace;

  /* Olive Leaf scale */
  --color-olive-leaf-50: #f4f6ee;
  --color-olive-leaf-100: #e7ebd9;
  --color-olive-leaf-200: #d1dab5;
  --color-olive-leaf-300: #b5c48b;
  --color-olive-leaf-400: #9bad67;
  --color-olive-leaf-500: #7e914a;
  --color-olive-leaf-600: #627338;
  --color-olive-leaf-700: #4a572c;
  --color-olive-leaf-800: #3c4626;
  --color-olive-leaf-900: #343d23;
  --color-olive-leaf-950: #15180c;

  /* Black Forest scale */
  --color-black-forest-50: #f3f7ed;
  --color-black-forest-100: #e4eed8;
  --color-black-forest-200: #c9deb3;
  --color-black-forest-300: #a4c785;
  --color-black-forest-400: #7ea859;
  --color-black-forest-500: #618c3d;
  --color-black-forest-600: #4b6f2e;
  --color-black-forest-700: #3a5626;
  --color-black-forest-800: #314622;
  --color-black-forest-900: #2a3c1f;
  --color-black-forest-950: #12190b;

  /* Cornsilk scale */
  --color-cornsilk-50: #fefbe6;
  --color-cornsilk-100: #fcf6c0;
  --color-cornsilk-200: #faed85;
  --color-cornsilk-300: #f6dc44;
  --color-cornsilk-400: #f3cb16;
  --color-cornsilk-500: #dbad0b;
  --color-cornsilk-600: #bd8607;
  --color-cornsilk-700: #96610a;
  --color-cornsilk-800: #7d4d0f;
  --color-cornsilk-900: #6a4012;
  --color-cornsilk-950: #231e01;

  /* Sunlit Clay scale */
  --color-sunlit-clay-50: #fbf3ea;
  --color-sunlit-clay-100: #f5e4ce;
  --color-sunlit-clay-200: #ebc69f;
  --color-sunlit-clay-300: #dea26a;
  --color-sunlit-clay-400: #d3813e;
  --color-sunlit-clay-500: #cc6722;
  --color-sunlit-clay-600: #bd5119;
  --color-sunlit-clay-700: #9d3d17;
  --color-sunlit-clay-800: #7e3319;
  --color-sunlit-clay-900: #662c18;
  --color-sunlit-clay-950: #1d1306;

  /* Copperwood scale */
  --color-copperwood-50: #fbf2ea;
  --color-copperwood-100: #f6e1ce;
  --color-copperwood-200: #edc19f;
  --color-copperwood-300: #e19a6b;
  --color-copperwood-400: #d6743c;
  --color-copperwood-500: #cb5621;
  --color-copperwood-600: #bd4219;
  --color-copperwood-700: #9d3117;
  --color-copperwood-800: #7e2a19;
  --color-copperwood-900: #672518;
  --color-copperwood-950: #1e1106;
}
```

---

## State of the Art

| Problem / Technique | Traditional Approach | State of the Art (Phase 5) |
|---|---|---|
| Multiline text measurement | Querying DOM (`getBoundingClientRect`, `offsetHeight`) | Canvas 2D + `Intl.Segmenter` via `@chenglou/pretext` (DOM-free, 0 reflows) |
| Opponent cursor positioning | React state update per packet -> child spans inside char spans | Headless `CursorManager` -> direct `translate3d` outside React render tree |
| Latency compensation & jitter | Raw snapping to incoming packet position | 100ms fixed-delay ring buffer with linear interpolation & 150ms clamped extrapolation |
| Web styling architecture | CSS Modules / plain CSS with scattered hex colors | Tailwind CSS v4 with `@tailwindcss/vite` Lightning CSS engine and `@theme` semantic tokens |
| Race start synchronization | Client local clock countdown | Two-phase NTP clock offset (`startsAtServerMs - clockOffsetMs`) with motion-blurred 3-2-1 overlay |

---

## Assumptions Log

| # | Assumption | Status | Resolution / Validation Plan |
|---|---|---|---|
| A-01 | `@chenglou/pretext` supports browser canvas environments across Chrome, Firefox, and Safari without polyfills | Verified | Confirmed by library documentation and empirical inspection of canvas measureText usage [VERIFIED: npm registry]. |
| A-02 | Monospace fonts (`JetBrains Mono`, `Fira Code`) exhibit uniform character width across ASCII characters | Verified | Monospace font metrics are uniform by definition; verified that `charWidth = ctx.measureText("M").width` matches individual character advances. |
| A-03 | Adding `isReady?: boolean` to `PLAYER_SUMMARY` in `packages/shared/src/messages.ts` preserves backward compatibility | Verified | Zod `.optional()` schema fields allow omission in existing Phase 1–4 tests and frames without parse errors. |
| A-04 | Tailwind CSS v4 works seamlessly with Vite 8 in Bun monorepo | Verified | Verified `@tailwindcss/vite` 4.3.3 and `tailwindcss` 4.3.3 exist on npm; verified Vite plugin architecture. |
| A-05 | `CursorManager` direct DOM mutations do not interfere with React DOM reconciliation | Verified | Cursor elements are attached to a dedicated overlay container `<div ref={overlayRef} />` whose child nodes are managed strictly by `CursorManager`, leaving React's virtual DOM untouched. |

---

## Open Questions

1. **Passage Container Resizing:** When a user resizes their browser window mid-race, the track container width may change.  
   *Answer:* A `ResizeObserver` attached to the track container re-invokes `layoutWithLines` on Pretext and updates the line ranges. `CursorManager` automatically maps progress indices to the new line breaks on the next rAF frame.
2. **Local Cursor Representation:** Should the local player's cursor also use `translate3d` or remain CSS border on character span?  
   *Answer:* The local cursor can also use `translate3d` on the overlay (with z-index priority D-12) for visual consistency, while typing input advances local progress instantaneously without buffer delay.

---

## Environment Availability

- **Bun Version:** `bun 1.3.2 (b131639c)` [VERIFIED: bun --version]
- **Node.js:** `v20.x` compatible
- **Workspace Packages:**
  - `apps/server` (Bun + Hono + WebSocket) [VERIFIED: apps/server/package.json]
  - `apps/web` (Vite 8 + React 19) [VERIFIED: apps/web/package.json]
  - `packages/shared` (Zod schemas + passage corpus) [VERIFIED: packages/shared/package.json]
- **Installed in Web Workspace:**
  - `@chenglou/pretext` 0.0.8 [VERIFIED: apps/web/node_modules/@chenglou/pretext]
- **Existing Test Status:** 113 server/shared tests pass in Bun test; 9 web tests pass in Vitest [VERIFIED: empirical test].

---

## Validation Architecture

### Automated Verification
1. **Unit Tests (`apps/web/src/__tests__/cursor-manager.test.ts`):**
   - Verify ring buffer snapshot insertion and pruning.
   - Verify linear lerp interpolation at $t = 0.5$ between snapshot $A$ and $B$.
   - Verify extrapolation clamping to $\le 150\text{ms}$.
   - Verify rewind snapping on backspace ($S_{\text{new}}.index < S_{\text{prev}}.index$).
2. **Pretext Layout Tests (`apps/web/src/__tests__/layout.test.ts`):**
   - Mock canvas 2D context in `happy-dom`.
   - Verify line wrapping produces expected line count for known container width.
   - Verify `getCoordinates(progress)` returns monotonic $(x, y)$ coordinates.
3. **UI Component Tests (`apps/web/src/__tests__/LobbyView.test.tsx`, `ResultsBoard.test.tsx`):**
   - Verify guest "Ready" toggle toggles state and displays checkmark.
   - Verify ResultsBoard calculates finish time delta relative to winner (`+X.Xs`).
   - Verify top 3 rows display Gold, Silver, Bronze badges.

### Manual / Browser Verification
1. **Two-Browser Window Race:** Open two browser windows, join room, complete race:
   - Observe smooth 60fps opponent cursor movement across line wraps without jitter.
   - Verify opponent name micro-tag floats neatly above the caret.
   - Verify race leader shows glowing caret / ghost wake.
2. **Performance Profiling (React DevTools):**
   - Record React DevTools Profiler during active race typing.
   - Confirm **0 commits / re-renders** in `RaceView` caused by opponent cursor motion.

---

## Security Domain

- **Server-Authoritative Timing & Progress:** Interpolation and Pretext layout calculations are strictly client-side presentation layers. Keystrokes, char-state updates, and finish times remain server-validated with anti-cheat checks intact (min-interval $\ge 20\text{ms}$, pre-start rejection, monotonic progress).
- **No Client Spoofing:** Cursors are driven solely by authoritative `cursor_update` frames emitted by the server. Clients cannot inject spoofed opponent positions.
- **XSS & Injection Protection:** Player nicknames in floating micro-tags and results boards are rendered via standard React text nodes and `textContent` in DOM elements, preventing HTML/script injection.

---

## Sources

### Canonical In-Repo Sources
- `packages/shared/src/messages.ts:16-22` — `PLAYER_SUMMARY`, `ROOM_CODE_REGEX` [VERIFIED: messages.ts:16-22]
- `packages/shared/src/messages.ts:108-120` — `clientToServerSchema` discriminated union [VERIFIED: messages.ts:108-120]
- `packages/shared/src/messages.ts:215-222` — `cursorUpdateSchema` with optional `charStates` and `wpm` [VERIFIED: messages.ts:215-222]
- `packages/shared/src/passages.ts:15-19` — `Passage` interface and `PASSAGES` corpus [VERIFIED: passages.ts:15-19]
- `apps/web/src/components/RaceView.tsx:141-150` — Current passage character and cursor rendering [VERIFIED: RaceView.tsx:141-150]
- `apps/web/src/store/cursor.ts:10-20` — `CursorState` and `useCursorStore` [VERIFIED: cursor.ts:10-20]
- `apps/web/src/store/clock.ts:9-19` — `ClockState` and `useClockStore` [VERIFIED: clock.ts:9-19]
- `apps/web/src/net/ws.ts:330-338` — `WsConnection` singleton [VERIFIED: ws.ts:330-338]
- `.planning/phases/05-frontend-polish/05-CONTEXT.md:16-65` — Implementation Decisions D-01 through D-20 [VERIFIED: 05-CONTEXT.md:16-65]

### External Documentation & Registry Sources
- Pretext GitHub Repository (`chenglou/pretext`) & npm package (`@chenglou/pretext@0.0.8`) [VERIFIED: npm registry, CITED: github.com/chenglou/pretext]
- Tailwind CSS v4 Documentation (`@tailwindcss/vite`, `@theme`) [CITED: tailwindcss.com]
- Zustand v5 Documentation [CITED: github.com/pmndrs/zustand]
