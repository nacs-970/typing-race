---
status: complete
phase: 03-race-track
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md, 03-04-SUMMARY.md]
started: 2026-08-31
updated: 2026-09-02
---

## Current Test

[all tests complete]

## Tests

### 1. Two-laptop demo: open two browsers to same room, full race
expected: |
  Open the URL in two browsers (or two tabs). Host creates a room.
  Join from the second browser. Host sees passage picker + grace picker
  + player list with both players. Host picks a passage (or Random) +
  grace (3/5/10s) and clicks Start. Both browsers see a 3-second
  countdown, then the race starts. As each player types, their cursor
  advances on BOTH screens (you see your own + opponent's cursor with
  red/green underline accents per char). When first player finishes,
  the OTHER player sees an amber banner: "<name> finished — Ns remaining"
  and keeps typing. When grace expires (or all done), both see a
  Results board with rank, time, WPM, accuracy. Host clicks Rematch
  → new passage loads (different from previous), countdown restarts.
result: pass

### 2. Char accents reflect correctness live
expected: |
  While typing, the current position has a BLUE underline (own cursor).
  Already-typed correct chars have a GREEN underline. Already-typed
  wrong chars (then backspaced + retyped correct) have a GREEN underline.
  Untyped chars (still ahead) are gray-dim. Opponent's cursor appears
  as a red vertical bar at their current position.
result: pass

### 3. Grace period: others keep typing after first finishes
expected: |
  Configure a 5s grace. When player A finishes their passage, player B
  (still typing) sees an amber banner: "A finished — 5s remaining".
  B can keep typing during the 5s. B's WPM continues to update. When
  the 5s expires, both see the Results board.
result: pass

### 4. Results board: ranking + per-player stats
expected: |
  Both players see a ranked list. First row = fastest finisher. Tiebreaker
  is WPM (higher WPM wins). Each row shows: rank, player ID, time (s),
  WPM, accuracy (%). The current user is highlighted. Host sees a
  Rematch button at the bottom.
result: pass

### 5. Rematch serves a new passage (no-repeat within room)
expected: |
  After race ends, host clicks Rematch. New race_start fires with a
  different passage (not the one just played). Both browsers see the
  new passage. Run a second rematch — passage is different from both
  previous ones. If you play 5+ rematches in the same room, no
  passage is repeated.
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
