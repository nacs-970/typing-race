# UX to-do: web client

These items were found during the typewriter/editorial redesign on 2026-09-23. Each one was checked against the code.
The restyle is tracked separately. The design demo is at https://claude.ai/artifact/H9DyYcz2oVjze4B8fKwEEn (private).
These items change behavior, not only styling. Do them as a separate batch after the restyle, and update the tests they affect.

## Quick wins (client only)

- [x] **1. Prefill the room code from the invite link.** Opening `…/#K7QX2M` without a session cookie shows an empty landing form. The auto-rejoin in `App.tsx` runs only when `getSessionCookie(hash)` returns a token. If the URL hash is a 6-character code and there is no token, set `joinCode` to it so the user only types a nickname and presses Join.
- [x] **2. Make Enter submit on the landing page.** The nickname and room-code inputs are not inside a `<form>`. Enter in the room-code field joins (when the code has 6 characters). Enter in the nickname field creates a room.
- [x] **3. Show the default nickname.** An empty nickname silently becomes `"Racer"` (`nickname.trim() || "Racer"`). Use `Racer` as the input placeholder.
- [x] **4. Confirm "Leave" mid-race.** `RaceHud` calls `onLeaveRoom` on a single click. Add a two-step inline confirm: the first click changes the label to "Sure? Leave" for 3 seconds, and the second click leaves. Use the same pattern for the lobby and results "Leave room" links.
- [x] **5. Replace `window.confirm` on force start.** `LobbyView.handleStartRace` uses `window.confirm`. Use the same two-step inline confirm on the button ("Force Start Race", then "Start anyway?").
- [x] **6. Show accuracy and errors inline in the race header.** Errors are visible only in a hover tooltip (`RaceHud`), and you cannot hover while typing. The finish-blocked note appears only at the end of the passage. Show `97.1% · 2 errors` next to WPM and remove the tooltip.
- [x] **7. Remove duplicate disconnect/reconnect notices.** `App.tsx` shows a toast (`addToast`) and also the inline `disconnectToasts` / `reconnectedNotice` banners for the same event. Keep only the toast.
- [x] **8. Keep the host's grace setting on rematch.** `ResultsBoard.handleRematch` always sends `graceSeconds: 5`. Reuse the grace value the host picked in the lobby. This needs the value stored in the race store, or passed down.
- [x] **9. Rewrite robotic or internal copy.**
  - "You are now the room host!" becomes "You're the host now."
  - "Keystroke rate limit exceeded (<20ms interval or race start grace)." becomes "Typing too fast to register. Slow down a little."
  - Remove the exclamation marks from success toasts, e.g. "{nickname} reconnected!".

## Bigger (optional)

- [x] **10. Typing on mobile.** (Shipped as a hidden input. Still needs a check on a real Android and iOS phone.) Keys come from a `window` `keydown` listener in `RaceView`, so touch devices never open a keyboard. The minimum fix is a "Physical keyboard needed" notice on touch devices. The full fix is a visually hidden input that gets focus on tap.
- [ ] **11. Show the passage during the countdown.** A dimmed first line would let players prepare. This needs a server change, because `passageText` arrives only with the race start.
- [x] **12. Show a session best on the results screen.** For example "74 wpm — your best today", stored in `localStorage`.
