# Phase 5: Frontend Polish - Context

**Gathered:** 2026-09-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 delivers the "two-laptop demo wow" moment: smooth 60fps opponent cursors with 30Hz server broadcast, 100ms client interpolation buffer, rAF lerp, translate3d cursor rendering outside the React render tree, server-synced 3-2-1 countdown overlay, per-player lobby readiness, custom passage filters, top-right stacked notifications, and a polished race HUD and results board.

Crucially, Phase 5 begins with a dedicated modularity pass: extracting the core typing engine and WebSocket client into a UI-agnostic core library with store adapters so that all future UI/UX refactors can swap components seamlessly without touching race engine logic.

</domain>

<decisions>
## Implementation Decisions

### Core Modularity & Architecture (UI Decoupling)
- **D-01: UI-agnostic core library.** Extract core typing and race engine logic into a headless, UI-agnostic module (`apps/web/src/core/` or `packages/core`) with event emitter and store adapters, decoupled from any React view hierarchy. — **Reversibility:** costly — touches all frontend call sites and component boundaries.
- **D-02: Centralized RaceClient singleton.** Dedicated service (`apps/web/src/net/race-client.ts`) that owns WebSocket lifecycle, auto-rejoin, heartbeats, and incoming message dispatch into stores; components only read stores or call client actions.
- **D-03: Headless CursorManager.** Dedicated animation controller running a `requestAnimationFrame` lerp loop that mutates opponent cursor DOM elements directly via CSS `transform: translate3d()`, bypassing React renders entirely (0 per-frame React re-renders). — **Reversibility:** costly — decouples cursor motion completely from React state.
- **D-04: Dedicated initial refactor pass in Plan 05-01.** Perform the core modularity extraction as the very first plan in Phase 5 so that downstream polish plans (cursor interpolation, HUD, styling) build directly on clean, decoupled architecture without rework.

### Visual Theme & Styling Foundation
- **D-05: Tailwind CSS v4 integration.** Adopt Tailwind CSS v4 via `@tailwindcss/vite` with custom design tokens defined in `@theme`.
- **D-06: Custom earth/botanical palette.** Configure five semantic color scales in Tailwind:
  - **Olive Leaf:** `--color-olive-leaf-50: #f4f6ee` to `--color-olive-leaf-950: #15180c`
  - **Black Forest:** `--color-black-forest-50: #f3f7ed` to `--color-black-forest-950: #12190b` (deep organic dark surfaces & backgrounds)
  - **Cornsilk:** `--color-cornsilk-50: #fefbe6` to `--color-cornsilk-950: #231e01` (warm passage text & neutral readable contrast)
  - **Sunlit Clay:** `--color-sunlit-clay-50: #fbf3ea` to `--color-sunlit-clay-950: #1d1306` (warm highlights, primary accents, rank badges)
  - **Copperwood:** `--color-copperwood-50: #fbf2ea` to `--color-copperwood-950: #1e1106` (secondary interactive elements & borders)
- **D-07: Monospace typography.** Premium monospace font stack (`JetBrains Mono`, `Fira Code`, `SF Mono`, `ui-monospace`) for crisp character alignment and smooth cursor tracking.
- **D-08: Centered fixed-width race track.** Centered track container (approx 760px–800px) optimized for comfortable eye span and desktop focus.

### Opponent Cursor Aesthetics & Player Tags
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

### Lobby Ready Check & Countdown Flow
- **D-13: Per-player Ready toggle.** Guests toggle "Ready" in the lobby with visible checkmarks; Host "Start Race" button activates once players are ready (Host retains force-start override).
- **D-14: Dramatic 3-2-1 GO overlay.** Centered dramatic countdown animation with large motion-blurred numbers (3... 2... 1... GO!) that fades smoothly as typing unlocks at `startAtServerMs - clockOffset`.
- **D-15: Passage customization in lobby.** Passages are randomized from corpus by default, but Host can filter by length (short, medium, long) and details (punctuation, short words, paragraph style) via toggle pills.
- **D-16: Top-right stacking toast notifications.** Disconnect grace periods and reconnect notices appear in top-right floating toasts, with newer toasts spawning neatly below older ones.

### Live Race HUD & Results Board
- **D-17: Compact status bar above track.** Live Net WPM (large integer), current rank badge (e.g. "#1"), and clean race progress percentage bar.
- **D-18: Sleek WPM hover tooltip.** Hovering over WPM reveals a popover breakdown: Net WPM, Raw WPM, Accuracy %, and uncorrected error count.
- **D-19: Non-intrusive glowing grace banner.** Pinned banner ("Alice finished 1st! 5s remaining...") with a countdown progress bar that leaves the passage text 100% in focus.
- **D-20: Ranked results table with podium accents.** Full ranked list of all players in clean rows, decorated with Gold/Silver/Bronze badges for top 3, finish time delta (`+1.2s to winner`), WPM, accuracy, and a prominent Rematch button.

### Agent Discretion
- Exact rAF lerp smoothing math and buffer window (default 100ms buffer, 150ms max extrapolation).
- CSS transition easings for the 3-2-1 GO overlay and ghost wake opacity decay.
- Internal event emitter implementation details in the UI-agnostic core library.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` — Core value, REQ-06 (live opponent cursors with interpolation polish).
- `.planning/ROADMAP.md` §Phase 5 — Goal, 5 success criteria, and 4 plan boundaries.
- `.planning/STATE.md` — Architectural decisions from Phases 1–4.

### Existing code & wire
- `packages/shared/src/messages.ts` — Wire schemas (cursor_update, race_start, lobby_state, rejoined_room).
- `packages/shared/src/passages.ts` — Bundled passage corpus; source for length & punctuation filtering.
- `apps/web/src/components/RaceView.tsx` — Current passage render and cursor implementation to be modularized and polished.
- `apps/web/src/store/cursor.ts` — Isolated cursor store.
- `apps/web/src/store/clock.ts` — NTP clock sync offset store.
- `apps/web/src/net/ws.ts` — Current WebSocket connection handlers.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/shared/src/passages.ts`: 50+ curated passages ready for metadata tags (word count, punctuation count).
- `apps/web/src/store/cursor.ts`: Foundation for separating high-frequency cursor updates from slow room state.
- `apps/web/src/store/clock.ts`: NTP offset `clockOffsetMs` ready for exact millisecond-accurate countdown synchronization.

### Established Patterns
- Store-bridge pattern for outside-React event pushing.
- Cookie-based session tokens for reconnect.
- Zod 4 wire message validation.

### Integration Points
- `apps/web/src/core/`: New headless engine module (`TypingEngine`, `RaceClient`, `CursorManager`).
- `apps/web/src/components/RaceView.tsx`: Refactored to pure presentational component with translate3d cursors.
- `apps/web/src/components/LobbyView.tsx`: Ready toggle and passage filter controls.
- `apps/web/src/components/CountdownView.tsx`: Dramatic 3-2-1 GO overlay.
- `apps/web/src/components/ResultsBoard.tsx`: Ranked table with top 3 podium badges.
- `apps/web/src/styles.css` & Tailwind config: Custom botanical palette tokens.

</code_context>

<specifics>
## Specific Ideas
- Botanical dark theme palette: Black Forest deep darks (#12190b), Cornsilk warm text (#fdf7ce), Sunlit Clay & Copperwood accents.
- Opponent cursors: Pastel rainbow order (#DA2C38, #DF6873, #EE7B30, #FBD24B, #F8F862, #87C38F, #99FFFC, #BE98D7).
- Monkeytype-style passage customization filters in lobby.
- Top-right stacked notifications (newer below older).

</specifics>

<deferred>
## Deferred Ideas
None — discussion stayed within phase scope.
</deferred>

---

*Phase: 05-frontend-polish*
*Context gathered: 2026-09-03*
