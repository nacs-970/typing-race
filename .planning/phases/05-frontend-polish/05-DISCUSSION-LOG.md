# Phase 5: Frontend Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-03
**Phase:** 05-frontend-polish
**Areas discussed:** Core Modularity (UI Decoupling), Visual Theme & Styling Foundation, Opponent Cursor Aesthetics & Player Tags, Lobby Ready Check & Countdown Flow, Live Race HUD & Results Polish

---

## Core Modularity (UI Decoupling)

| Option | Description | Selected |
|--------|-------------|----------|
| Headless React hooks | useTypingEngine, useRaceRoom hooks | |
| UI-agnostic core library | Dedicated library (apps/web/src/core or packages/core) with event emitter and store adapters | ✓ |
| Custom React Context Provider | RaceEngineProvider wrapping app | |
| Centralized singleton service | RaceClient managing WS and stores | ✓ |
| Headless rAF CursorManager | CursorManager running rAF and mutating translate3d | ✓ |
| Dedicated initial refactor pass | Plan 05-01 dedicated to extracting core before polish features | ✓ |

**User's choice:** UI-agnostic core library with store adapters, centralized RaceClient singleton service, headless rAF CursorManager, and dedicated initial refactoring pass (Option 1).
**Notes:** User specifically requested the possibility of making existing core feature code into a module for future UI/UX refactors/revamps.

---

## Visual Theme & Styling Foundation

| Option | Description | Selected |
|--------|-------------|----------|
| Modern plain CSS | Design tokens with CSS variables | |
| Tailwind CSS v4 | Atomic utility classes via @tailwindcss/vite | ✓ |
| CSS Modules | Scoped component CSS | |
| Custom earth/botanical palette | 5 custom scales: Olive leaf, Black forest, Cornsilk, Sunlit clay, Copperwood | ✓ |
| Premium monospace font stack | JetBrains Mono / SF Mono / Fira Code / ui-monospace | ✓ |
| Centered fixed-width track | ~760px-800px width for desktop focus | ✓ |

**User's choice:** Tailwind CSS v4 configured with custom earth/botanical color palette tokens, monospace typography, and centered fixed-width track.
**Notes:** User asked if Tailwind could be aesthetic and provided custom CSS variables for Olive Leaf, Black Forest, Cornsilk, Sunlit Clay, and Copperwood scales.

---

## Opponent Cursor Aesthetics & Player Tags

| Option | Description | Selected |
|--------|-------------|----------|
| Pastel rainbow palette | User-specified hex colors ordered in rainbow | ✓ |
| Floating micro-tag | Pill above caret with player name | ✓ |
| Smooth sliding caret with glow + leader ghost wake | 2px caret with player glow + ghost wake behind leader (1 + 3) | ✓ |
| Own cursor on top | Local player cursor has highest z-index | ✓ |

**User's choice:** Pastel rainbow ordered palette (#DA2C38, #DF6873, #EE7B30, #FBD24B, #F8F862, #87C38F, #99FFFC, #BE98D7), floating player name tags, smooth sliding caret + ghost wake behind fastest player, and own cursor always on top.

---

## Lobby Ready Check & Countdown Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Per-player Ready toggle | Guests toggle Ready, Host sees checkmarks and activates Start (with force-start override) | ✓ |
| Dramatic 3-2-1 GO overlay | Large animated numbers with motion blur fading into typing view | ✓ |
| Passage customization | Random by default, Host selects length and details (punctuation, short words, paragraph) | ✓ |
| Top-right stacking toasts | Toasts in top-right corner, newer toasts spawn below older ones | ✓ |

**User's choice:** Ready toggle with host override, dramatic 3-2-1 GO overlay, Monkeytype-style passage filters in lobby, and top-right stacked toasts.

---

## Live Race HUD & Results Polish

| Option | Description | Selected |
|--------|-------------|----------|
| Compact status bar | Large integer Live Net WPM, rank badge (#1), progress percentage | ✓ |
| Sleek WPM hover tooltip | Hover popover showing Net WPM, Raw WPM, Accuracy %, errors | ✓ |
| Non-intrusive grace banner | Glowing top banner with countdown bar | ✓ |
| Ranked table with podium details | Full ranked table with rows, decorated with Gold/Silver/Bronze badges, time delta, and Rematch | ✓ |

**User's choice:** Compact status bar above track, hover tooltip for detailed WPM breakdown, non-intrusive grace banner, and ranked table with podium badges and finish time delta to winner.

---

## Agent Discretion
- Exact rAF lerp parameters (100ms buffer, 150ms extrapolation cap).
- CSS animation easing curves for 3-2-1 countdown overlay and ghost wake.
- Internal event emitter design within the UI-agnostic core library.

## Deferred Ideas
None — discussion stayed within phase scope.
