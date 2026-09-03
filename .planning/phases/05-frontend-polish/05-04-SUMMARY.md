---
phase: 05-frontend-polish
plan: 04
subsystem: race-hud-toasts-results-board
tags: [race-hud, tooltip, toast-queue, results-board, podium-medals, grace-banner]
status: completed
completed_at: 2026-09-03

# Dependency graph
requires:
  - phase: 05-02
    provides: "Pretext layout and translate3d RaceView"
  - phase: 05-03
    provides: "Lobby readiness and synchronized countdown overlay"
provides:
  - "RaceHud component with live rounded Net WPM integer, dynamic rank badge (#1 in Sunlit Clay), track progress bar, and hover tooltip breakdown (Net WPM, Raw WPM, Accuracy %, Errors)"
  - "GraceBanner pinned glowing amber banner with shrinking timer progress bar leaving passage text in focus"
  - "ToastQueue component with top-right stacked notifications, auto-dismiss, disconnect countdown, and exact UI-SPEC copywriting contracts"
  - "ResultsBoard with 🥇🥈🥉 podium medals, winner time delta (+X.Xs), tiebreaker WPM, local player (You) highlight, and rematch / return-to-lobby CTAs"
  - "apps/web/src/__tests__/RaceHud.test.tsx (4 unit tests pass)"
  - "apps/web/src/__tests__/ToastQueue.test.tsx (4 unit tests pass)"
  - "apps/web/src/__tests__/ResultsBoard.test.tsx (6 unit tests pass)"
affects:
  - Phase 6 (Deployment & Hardening)

actuals:
  tasks: 3
  tests: 14

key-files:
  created:
    - apps/web/src/components/RaceHud.tsx
    - apps/web/src/components/ToastQueue.tsx
    - apps/web/src/store/toast.ts
    - apps/web/src/__tests__/RaceHud.test.tsx
    - apps/web/src/__tests__/ToastQueue.test.tsx
    - apps/web/src/__tests__/ResultsBoard.test.tsx
  modified:
    - apps/web/src/components/RaceView.tsx
    - apps/web/src/components/GraceBanner.tsx
    - apps/web/src/components/ResultsBoard.tsx
    - apps/web/src/core/typing-engine.ts
    - apps/web/src/App.tsx
---

# Plan 05-04 Summary: Race HUD, Toast Queue, Results Board Podium & Grace Banner

Delivered the concluding user experience and polish features for Phase 5 (Wave 3):
1. **Compact Race HUD Status Bar (`RaceHud`)**:
   - Renders directly above `.passage-track` with live rounded Net WPM integer, rank badge (`#1` in Sunlit Clay, `#2`+ in Olive/Cornsilk accents), and horizontal track progress fill.
   - Implemented hover/focus popover tooltip breakdown showing Net WPM, Raw WPM, Accuracy %, and uncorrected error count.
2. **Pinned Grace Countdown Banner (`GraceBanner`)**:
   - Refactored into a sleek, non-intrusive banner pinned above the HUD with glowing amber border and shrinking gradient timer bar from 100% to 0% over `remainingMs`.
3. **Top-Right Stacked Toast Queue (`ToastQueue`)**:
   - Created `useToastStore`, `addToast`, `dismissToast`, and `<ToastQueue />` rendered top-right with top-to-bottom stacking order (capped at 5 max).
   - Handles disconnect 60s grace, reconnect notifications, and exact UI-SPEC copywriting contracts (Room Lost, Server Restart, Rate Limit, Version Mismatch).
4. **Ranked Results Board (`ResultsBoard`)**:
   - Displays server-authoritative `PlayerFinalStats[]` ranked by `finishTimeMs` ascending with `wpm` descending tiebreaker.
   - Formats finish time deltas relative to winner (`Winner`, `+1.2s`), podium medals (`🥇`, `🥈`, `🥉`), and highlights local player with `(You)` tag.
   - Provides "Play Again" auto-deal rematch and "Return to Lobby" action buttons.
5. **Verification**:
   - 4 RaceHud tests, 4 ToastQueue tests, and 6 ResultsBoard tests pass 100%.
   - Full suite of 62 Vitest tests and 115 Bun tests pass across all packages.
   - Production Vite + TypeScript build compiles cleanly.

## Self-Check: PASSED
- All artifacts on disk and verified.
- Git commit `886e6db` contains production code and tests.
- All unit and integration tests pass.
