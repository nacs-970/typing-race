---
# Phase 3: Race Track + WPM - Context

**Gathered:** 2026-08-30
**Status:** Ready for planning

<domain>

## Phase Boundary

The visible typing surface and the universal closer. Per-character state model for backspace-aware correctness, word-correctness aggregated from char states, server-computed standard WPM formula, and a race-end results board ranked by finish time then WPM. Bundled passage corpus with ~50-100 short public-domain passages, **selected by the host before each race** (Monkeytype-style), with a configurable grace-period after first finish.

Out of phase scope: cursor interpolation polish (Phase 5), reconnect/sessionTokens (Phase 4), deploy hardening (Phase 6).

</domain>

<decisions>

## Implementation Decisions

### Passage corpus + selection

- **D-01: Host picks the passage before each race.** Not server auto-pick. Race-start carries a `passageId` chosen by the host. — **Reversibility:** costly — touches wire schema (`start_race` gains `passageId?`; new `pick_passage` frame or lobby selection), server race-controller logic, host lobby UI.
- **D-02: Pre-race pick UI in the lobby.** Host sees a passage list (all ~50-100) with a "Random" button and per-passage preview (full text). Click → preview → `start_race` carries the chosen passageId. Other players see "Host chose: [first 30 chars]…" in the lobby.
- **D-03: Corpus source = hand-curated public-domain classic literature** (Twain, Carroll, Aesop, etc.). ~50 passages, 30-60 words each, stored in `packages/shared/src/passages.ts` (exported as a const array — no runtime fetch, no API).
- **D-04: No-repeat rule within a room's session.** Sequential picker from a shuffled deck, reshuffle when exhausted. (Same-room rematch never reuses the previous passage.) — **Reversibility:** reversible — server-side only.

### WPM semantics

- **D-05: Net WPM shown live during race.** Formula: `netWPM = max(0, (correctChars / 5) − (uncorrectedErrors / 5)) / minutesElapsed`. Matches ROADMAP criterion 2's spec fixture. Updated server-side on each accepted keystroke; broadcast on `cursor_update` or a separate lightweight `wpm_update` frame.
- **D-06: Char accuracy shown on results board only.** Formula: `correctChars / totalKeystrokes`. (Not during race — minimal noise.)
- **D-07: No raw WPM live.** Defer to results board (raw + net both shown there). Simpler single-number UI during race.

### Race-end trigger

- **D-08: First-finish triggers a grace countdown; race ends at 0 unless someone else finishes first.** Default grace = 5 seconds. Other players see a banner "X finished — Ns remaining" and **keep typing**. Encourages competitive "beating the clock" moment.
- **D-09: Host picks grace period in the lobby** (3s / 5s / 10s picker; default 5s). Stored on `Room.graceSeconds`. Sent in `start_race` or on `joined_room`. Wire schema gains `graceSeconds?: number` on relevant frames.
- **D-10: Race-end broadcast carries per-player final stats.** Schema `race_end` gains: `finishedPlayerIds`, plus a parallel array of `{playerId, finishTimeMs, wpm, accuracy}` (ranked client-side by finish time, then WPM as tiebreaker).

### Char-state visualization

- **D-11: Char-state visuals = "char color, correct accent, wrong accent".** Typed chars keep their normal text color. Underline accent below each char: **green** = correct, **red** = wrong (still wrong). Untyped chars ahead: gray dim (same as current placeholder).
- **D-12: 2-tone only.** No "corrected = yellow" intermediate state — once a wrong char is fixed, it turns green. Simpler to read.
- **D-13: Word-correctness aggregation in server data model (not UI).** Word is "complete" only when all its chars end `correct`. Used by server-side correctness stats; UI just renders per-char accents.

### Race-end trigger / grace-period state

- **D-14: New server-side `Room.firstFinisherId` and `Room.graceEndsAtServerMs` state fields.** Set on first finish; cleared on race end. `tick()` checks `now >= graceEndsAtServerMs && noNewFinishers` to broadcast `race_end`.
- **D-15: Banner UI for in-grace players is server-driven.** A new `grace_countdown` S→C frame carries `{remainingMs, leaderPlayerId}`. Client renders banner; typing continues.

### Claude's Discretion

- **Passage picker UX details**: list density (cards vs rows), search/filter, "favorite passages", "recent picks" — pick whatever fits the lobby layout.
- **Results board animation**: slide-in vs instant render, podium order top-down vs left-right.
- **WPM refresh rate**: every accepted keystroke vs throttled at 2Hz — minor.
- **Word-boundary detection in passage**: regex `/\\s+/` or hand-curated splits per passage — pick simplest robust option.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` — Core value, requirements REQ-05/REQ-08/REQ-10, tech-stack + constraints (English-only passages, 30-60 words, no two consecutive same passage).
- `.planning/ROADMAP.md` §Phase 3 — Goal + 5 success criteria + 4 plan boundaries (corpus, char-state, WPM, race-end).
- `.planning/STATE.md` — Phase 2 outcome, decisions about cursor store isolation, anti-cheat invariants (don't regress).

### Existing wire + code
- `packages/shared/src/messages.ts` — All current C→S / S→C schemas. Plan 01 will extend (start_race gains passageId; new pick_passage; new grace_countdown; race_end gains final stats).
- `apps/server/src/race/controller.ts` — Race FSM. Needs new `graceCountdown` state transition (racing → grace → finished).
- `apps/server/src/race/types.ts` — Room + Player types. Plan 01 adds `passageId` (already in shape but always null until start), `graceSeconds`, `firstFinisherId`, `graceEndsAtServerMs`.
- `apps/server/src/race/validate-keystroke.ts` — Plan 04 anti-cheat. Extends to update `player.charStates: ('pending'|'correct'|'error'|'corrected')[]`; error detection is the new char-state awareness.
- `apps/web/src/components/RaceView.tsx` — Current placeholder render. Phase 3 extends with char-state accents (green/red underlines), word-correctness aggregation, cursor on completed chars.
- `apps/web/src/App.tsx` — Race lifecycle. Phase 3 adds passage picker UI in lobby state; race-end renders ResultsBoard.

### External references (none locked)
- No external spec / ADR. Decisions fully captured above.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- **`packages/shared/src/codes.ts` `genRoomCode()` + `ROOM_CODE_ALPHABET`** — same nanoid pattern Plan 01 reuses. Phase 3 doesn't need a new generator, just a const array.
- **`apps/server/src/ws/broadcast.ts`** — broadcast helpers (`broadcastToRoom`, `broadcastLobbyState`, `broadcastPlayerLeft`, `broadcastJoinedRoom`). Phase 3 adds `broadcastRaceEnd`, `broadcastGraceCountdown` following the same swallow-errors pattern.
- **`apps/web/src/store/cursor.ts`** — Isolated Zustand store pattern. Phase 3 reuses for `useRaceStore` (passage text, charStates, ownWPM).
- **`apps/server/src/race/validate-keystroke.ts`** — Pure-function validator. Phase 3 adds char-state computation as another side-effect on accept, keeping the function pure (returns `ValidateResult + newCharStates`).

### Established Patterns

- **Wire schemas in `packages/shared/src/messages.ts`** are the single source of truth. Phase 3 extends, doesn't fork.
- **Race FSM is an explicit whitelist** (`Record<RaceState, ReadonlyArray<RaceState>>`). Phase 3 adds `'grace'` as a new state (or a sub-state of racing — Claude's discretion in plan).
- **Server-authoritative everything**: char-state, WPM, race-end. Client never decides correctness.
- **Server timestamps win**: `graceEndsAtServerMs` like `startsAtServerMs`. Client translates via `clockOffsetMs`.

### Integration Points

- `dispatch.ts` `start_race` case → extended to include `passageId` + `graceSeconds`.
- `dispatch.ts` `keystroke` case → extended to compute char-state and update `player.charStates`; broadcast per-char snapshot if state changed.
- `tick()` → extended to detect first-finish → transition to grace → broadcast `grace_countdown`.
- `RaceView` → extended to render per-char accents.
- `App.tsx` → new LobbyPassagePicker component; new ResultsBoard component.

</code_context>

<specifics>

## Specific Ideas

- **Monkeytype inspiration**: host picks the passage (not server random). Passages listed with preview so host can read before starting.
- **Competitive grace period**: 5s default after first finisher so others can race to beat the time. Banner says "X finished — Ns remaining".
- **Char accent = underline only** (no background tint), matches the typographic feel of typing-test sites. Easier on the eyes during fast typing.
- **Word-correctness is server data, not client UI** — UI just renders per-char accents; the "is this word done" boolean lives in server stats for results aggregation.

## Deferred Ideas

None — discussion stayed within phase scope.

</specifics>

---

*Phase: 03-race-track*
*Context gathered: 2026-08-30*