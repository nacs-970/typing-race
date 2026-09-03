---
phase: 05-frontend-polish
plan: 02
subsystem: text-layout-and-cursor-overlay
tags: [tailwind, botanical-palette, pretext, layout, translate3d, cursor-overlay, 60fps]
status: completed
completed_at: 2026-09-03

# Dependency graph
requires:
  - phase: 05-01
    provides: "Headless CursorManager and TypingEngine"
provides:
  - "Tailwind CSS v4 integration with 5 custom botanical scales and monospace typography"
  - "PassageLayout class powered by @chenglou/pretext with O(1) arithmetic coordinate lookup"
  - "Hardware-accelerated translate3d cursor overlay container with 0 per-frame React reconciler commits"
  - "Deterministic 8-color pastel rainbow palette and floating player name micro-tags"
  - "Local player cursor with Sunlit Clay accent and leader caret glow effect"
  - "apps/web/src/__tests__/layout.test.ts (4 unit tests pass)"
  - "apps/web/src/__tests__/RaceView.test.tsx (7 component tests pass)"
affects:
  - 05-04 (Race HUD and ResultsBoard integration with RaceView)

actuals:
  tasks: 3
  tests: 11

key-files:
  created:
    - apps/web/src/core/layout.ts
    - apps/web/src/__tests__/layout.test.ts
  modified:
    - apps/web/src/styles.css
    - apps/web/src/core/cursor-manager.ts
    - apps/web/src/components/RaceView.tsx
    - apps/web/src/__tests__/RaceView.test.tsx
    - apps/web/package.json
    - apps/web/vite.config.ts
---

# Plan 05-02 Summary: Pretext Multiline Layout & Hardware-Accelerated translate3d Cursor Overlay

Delivered the core visual presentation and 60fps cursor animation layer for Phase 5 (Wave 2):
1. **Tailwind CSS v4 & Botanical Design System**: Integrated `@tailwindcss/vite` and Tailwind v4 with the 5 semantic botanical scales (Olive Leaf, Black Forest, Cornsilk, Sunlit Clay, Copperwood) and JetBrains Mono monospace typography. Preserved existing view classes while defining `.passage-track`, `.char-pending`, `.char-correct`, `.char-error`, `.leader-glow`, and `.local-cursor`.
2. **DOM-Free Multiline Text Layout (`PassageLayout`)**: Built `PassageLayout` using `@chenglou/pretext` (`prepareWithSegments` and `layoutWithLines`). Measures monospace character advance once and caches contiguous line ranges, delivering $O(1)$ arithmetic coordinate lookup without any forced synchronous layout reflows or DOM reads.
3. **Hardware-Accelerated `translate3d` Cursor Overlay**: Decoupled `RaceView` from per-frame cursor positioning. `CursorManager` mounts to an isolated DOM overlay container, assigns deterministic 8-color pastel rainbow carets (`PASTEL_RAINBOW_COLORS`), adds floating player name micro-tags (truncated at 16 chars), applies `.leader-glow` pulse to the lead racer, and mutates `transform: translate3d(x, y, 0)` in `requestAnimationFrame` with 0 React reconciler renders.
4. **Verification**: 4 new layout tests and 7 RaceView component tests pass with 100% green assertions. `tsc --noEmit` and `vite build` compile with zero errors.

## Self-Check: PASSED
- `apps/web/src/core/layout.ts`: on disk, verified.
- `apps/web/src/__tests__/layout.test.ts`: on disk, verified.
- Git commit `f9effaa` contains production code and tests.
- All unit and component tests pass.
