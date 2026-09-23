# UX fix plan: web client

This plan implements the items in `ux-todo.md`. Each item below was checked again against `master` at `5d615fb`.
Follow `design-guideline.md` for every visual detail.

## Context

The typewriter/editorial restyle is done (batches 1–4). The items in `ux-todo.md` are the remaining **behavior** problems found during that review: dead ends, missing keyboard support, risky one-click actions, hidden information, duplicated notices, and copy that exposes internals.
This plan turns them into small, test-backed commits.

**Scope:** `apps/web` only. No server or protocol changes. Item 11 needs a server change and is out of scope.

**Rules for every step:**
- Write the test first and see it fail. Then implement, and run `bunx vitest run` + `bunx tsc --noEmit` in `apps/web`. Commit each step.
- Keep the pinned strings and test ids from `design-guideline.md` §9, unless the step below says to change one. If it does, change the test in the same commit.
- Who does the work: every step is small, so Claude does steps A–E directly, because the round trip to agy costs more than the step. agy is optional for F.

---

## Decisions needed before starting

| # | Question | Recommendation |
|---|---|---|
| D1 | **Item 7:** a disconnect shows both a toast and an inline notice. Which one stays? | **Keep the toast.** It is dismissible, it expires, and it is consistent with every other event. Remove the inline notice and the "reconnected" notice. This undoes the dismiss button added in `9d95845` and its test, which the toast already covers. |
| D2 | **Item 6:** remove the WPM hover tooltip? | **Keep it** for raw WPM (it opens on keyboard focus as well as hover), and ADD accuracy and errors inline. Removing it would mean deleting a working test. |
| D3 | **Item 10:** mobile | **A notice only**: "Typing needs a physical keyboard." on coarse-pointer devices. A hidden-input keyboard is a separate project. |
| D4 | The High Contrast cursor is `#BDBDBD` on white (≈1.9:1) | Use `#000000` again, or a dark color such as `#1f3fbf`. The user decides. |

---

## Step A: Landing (items 1, 2, 3)

**Files:** `src/App.tsx`, `src/__tests__/App.test.tsx`

1. **Prefill the room code from an invite link (item 1).**
   - Initialize `joinCode` from `window.location.hash` when the hash is a 6-character code **and** `getSessionCookie(hash)` returns no token. When there is a token, the auto-rejoin effect still handles it.
   - Use a lazy `useState` initializer. Do not add a new effect.
2. **Enter submits (item 2).**
   - Wrap the nickname and create block, and the code and join block, in two `<form>` elements, each with `onSubmit={e => { e.preventDefault(); … }}`.
   - Create Room and Join Room become `type="submit"`.
   - Keep the disabled rule on Join Room (the code must be 6 characters). A disabled submit already blocks Enter.
3. **Show the default nickname (item 3).** Change the placeholder to `Racer`, which matches the `nickname.trim() || "Racer"` fallback.

**Tests:**
- Hash `#K7QX2M` with no cookie → `#room-code-input` has the value `K7QX2M`.
- With a cookie → the field stays empty.
- Pressing Enter in the room-code field with 6 characters calls `ws.send` with `{ type: "join_room", code: "K7QX2M" }` (spy on `ws.send`).
- Pressing Enter in the nickname field sends `create_room`.

**Commit:** `feat(web): prefill invite codes and submit the landing forms with Enter`

---

## Step B: Two-step confirm (items 4, 5)

**Files:** a new `src/components/useConfirmClick.ts`, plus `RaceHud.tsx`, `LobbyView.tsx`, `ResultsBoard.tsx` and their tests.

1. **The hook `useConfirmClick(action, timeoutMs = 3000)`** returns `{ armed, onClick }`.
   - The first click arms it.
   - A second click within `timeoutMs` runs `action` and disarms.
   - The timeout disarms it.
   - It clears the timer on unmount.
2. **Leave (item 4):**
   - Race header "Leave": the label reads `Leave`, and `Sure? Leave` while armed.
   - Lobby "leave" and results "Leave room": the same pattern (`Sure? leave` / `Sure? Leave room`).
   - While armed, the link gets the solid danger text plus `font-bold`. Keep an `aria-live="polite"` label so the change is announced.
3. **Force start (item 5):**
   - Replace `window.confirm` in `LobbyView.handleStartRace` with the hook, for the force-start case only.
   - The button text: `Force Start Race`, then `Start anyway?` while armed.
   - "Start Race" (everyone is ready) stays one click.

**Tests:**
- Hook: arm → second click runs → the timer disarms it (`vi.useFakeTimers`).
- `LobbyView.test.tsx` "displays Force Start Race…": replace `confirmSpy` with two clicks. The first click does NOT call `onStartRace`, and the second click does. Remove the `window.confirm` mock from `beforeEach`.
- Lobby and results leave tests: click twice (`leave` → `Sure? leave`).
- `ResultsBoard.test.tsx` leave tests: the same.
- A new RaceHud test: one click on "Leave" does not call `onLeaveRoom`, and two clicks do.

**Commit:** `feat(web): two-step confirm for leaving and force-starting`

---

## Step C: Race header shows accuracy and errors (item 6, decision D2)

**Files:** `src/components/RaceHud.tsx`, `src/__tests__/RaceHud.test.tsx`

- Under the WPM number, add a `.label` line: `{accuracy}% · {n} errors`.
  - Use the singular `error` when n = 1.
  - When `n > 0`, the errors part uses `--color-status-danger`.
  - Give it `data-testid="accuracy-line"`.
- Keep the tooltip unchanged (D2).

**Tests:** after the stats update (the same setup as the existing WPM test), `accuracy-line` shows `100.0% · 0 errors`. After an error it shows `1 error` with the danger class.

**Commit:** `feat(web): show accuracy and errors in the race header`

---

## Step D: Notices and copy (items 7, 9, decision D1)

**Files:** `src/App.tsx`, `src/styles.css`, `src/__tests__/App.test.tsx`

1. **Item 7 (with D1 = keep the toast):**
   - Remove the `disconnectToasts` and `reconnectedNotice` state, their JSX, and the `.toast-disconnect` / `.toast-reconnected` CSS.
   - Keep the `addToast` calls.
   - Replace the dismiss test from `9d95845` with this one: a `player_disconnected` message shows exactly one `[data-toast-id]` warning toast, and no `.toast-disconnect`.
2. **Item 9, copy rewrite** (titles in sentence case, no exclamation marks):
   - "Host Promoted" / "You are now the room host!" → "You're the host" / "You're the host now."
   - "{nick} reconnected!" → "{nick} reconnected." (the toast body)
   - "Typing Throttled" / "Keystroke rate limit exceeded (<20ms interval or race start grace)." → "Slow down" / "Typing too fast to register. Slow down a little."
   - Check that the ToastQueue test strings ("Room lost — connection expired…") and the App test ("Server Restarting") are unaffected. Leave those texts as they are.

**Commit:** `fix(web): one notice per disconnect and plainer toast copy`

---

## Step E: Rematch keeps the host's grace (item 8)

**Files:** `src/store/race.ts`, `src/components/LobbyView.tsx`, `src/components/ResultsBoard.tsx`, `src/__tests__/ResultsBoard.test.tsx`

- Add `graceSeconds: number` (default 5) to the race store. `resetRaceUi()` must not reset it, because it is a room setting.
- In `LobbyView`, the grace picker writes to the store (it can still read from local state for rendering).
- `ResultsBoard.handleRematch` sends `useRaceStore.getState().graceSeconds` instead of `5`.

**Tests:** with store `graceSeconds: 10`, clicking "Play Again" calls `ws.send` with `graceSeconds: 10`.

**Commit:** `fix(web): rematch reuses the host's countdown grace`

---

## Step F: Optional (items 10, 12, and a review follow-up)

1. **Item 10 (D3):**
   - On the landing and in the lobby, when `matchMedia("(pointer: coarse)").matches` and there is no fine pointer, show a ruled note: "Typing needs a physical keyboard."
   - Guard `matchMedia` for the tests (happy-dom).
2. **Item 12, session best:**
   - On the results screen, compare your WPM with `sessionStorage["typing_race_best_wpm"]`. Wrap every read and write in try/catch.
   - Show a `.label` line, "Your best today: 81.2 wpm", or "New best today" when you beat it.
3. **A11y follow-up:** add `aria-hidden="true"` to the decorative `⊹ ࣪ ﹏𓊝﹏𓂁﹏⊹ ࣪ ˖` line in the lobby empty state.
4. **D4:** apply the chosen High Contrast cursor color in `store/settings.ts`.

One commit each.

---

## Out of scope

- **Item 11** (show the passage during the countdown): the server sends `passageText` only with `race_start`. It needs a protocol change in `packages/shared` and the engine, so it gets its own plan.

## Verification

1. `bunx vitest run` and `bunx tsc --noEmit` pass after every step. The test count only goes up, except in step D, where one test is replaced.
2. Manual check in `bun run dev` with two browser tabs:
   - open an invite link in a private window → the code is prefilled, and Enter joins
   - Force start → it needs two clicks
   - Leave mid-race → it needs two clicks, and the label is announced
   - the race header shows accuracy and errors
   - disconnect one tab → exactly one toast
   - rematch after picking 10s grace → a 10s countdown
3. Tick each finished item in `ux-todo.md` in the same commit as the fix.
