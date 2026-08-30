# Phase 3: Race Track + WPM — Research

**Researched:** 2026-08-30
**Confidence:** HIGH (Phase 2 wire contract proven; CONTEXT.md locks all decisions)
**Inherits from:** Phase 2 SUMMARYs (race-engine, anti-cheat, clock-sync complete) + `.planning/research/{STACK,PITFALLS}.md` + `03-CONTEXT.md`

---

## User Constraints (from 03-CONTEXT.md — locked decisions, copy verbatim)

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

### Claude's Discretion (from CONTEXT.md)
- Passage picker UX details: list density (cards vs rows), search/filter, "favorite passages", "recent picks".
- Results board animation: slide-in vs instant render, podium order top-down vs left-right.
- WPM refresh rate: every accepted keystroke vs throttled at 2Hz.
- Word-boundary detection: regex `/\s+/` or hand-curated splits per passage — pick simplest robust option.

### Out of Scope (Phase 4+)
- Cursor interpolation polish (Phase 5), reconnect/sessionTokens (Phase 4), deploy hardening (Phase 6).

---

## Summary

Phase 2 already shipped 90% of the wiring Phase 3 needs. The race engine accepts keystrokes, broadcasts cursor updates, and broadcasts `race_start` with a placeholder passage. Phase 3 replaces the placeholder with a real passage corpus, extends each accepted keystroke to update a per-character state model on the server, computes WPM from those states, and detects race-end (first finish + grace period, then broadcast results).

The work splits cleanly across 4 plans matching ROADMAP.md:
- **03-01 Passage corpus + picker**: `packages/shared/src/passages.ts` (const array of ~50-100 entries), server-side no-repeat deck. D-01/02/03/04.
- **03-02 Char-state model + word aggregation**: per-char `(pending|correct|error)` tuple on `Player`, updated by `validateKeystroke`. Cursor broadcast extended with char-state snapshot. D-11/12/13.
- **03-03 WPM + accuracy formulas**: pure-function `computeWpm(state, now)` + `computeAccuracy(state)`, server-only. Tests with the spec fixture (30 chars in 30s → 2 WPM). D-05/06/07.
- **03-04 Race-end detection + grace + results board + rematch**: new `'grace'` FSM state, `grace_countdown` frame, `race_end` final-stats schema, `ResultsBoard` component, rematch button. D-08/09/10/14/15.

**Primary recommendation:** Extend (don't fork) the wire contract. Add 2 new C→S frames (`pick_passage`, possibly merged into `start_race`) and 1-2 new S→C frames (`grace_countdown`, extended `race_end`). Server-side state additions stay inside `Room` + `Player`. No new libraries required.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary | Rationale |
|---|---|---|---|
| Wire schemas (Zod) | `packages/shared/src/messages.ts` | — | REQ-13 single source. Phase 3 EXTENDS existing unions, not forks. |
| Passage corpus | `packages/shared/src/passages.ts` (NEW) | — | D-03: const array, no fetch. Imported by server (picker) + client (lobby UI preview). |
| Race FSM (extend) | `apps/server/src/race/controller.ts` | — | Add `'grace'` state (D-14); tick() detects first-finish transition. |
| Room state (extend) | `apps/server/src/race/types.ts` | — | Add `graceSeconds`, `firstFinisherId`, `graceEndsAtServerMs` to Room; add `charStates`, `totalKeystrokes`, `uncorrectedErrors`, `wpm` to Player. |
| Char-state computation | `apps/server/src/race/validate-keystroke.ts` | — | EXTEND the existing pure function to also return new char-states tuple; keeps single source of truth for race correctness. |
| WPM/accuracy math | `apps/server/src/race/scoring.ts` (NEW) | — | Pure functions. Server-only. D-05/06 formulas verbatim. |
| No-repeat deck | `apps/server/src/race/corpus.ts` (NEW) | — | Fisher-Yates shuffle on room creation; reshuffle on exhaustion (D-04). |
| Grace broadcast | `apps/server/src/ws/broadcast.ts` | — | Add `broadcastGraceCountdown`, extend `broadcastRaceEnd`. |
| Race view UI | `apps/web/src/components/RaceView.tsx` | — | Replace placeholder render with char-state accents (D-11/12). |
| Lobby + passage picker | `apps/web/src/components/LobbyView.tsx` (NEW) | — | Host UI for D-02. |
| Results board | `apps/web/src/components/ResultsBoard.tsx` (NEW) | — | D-10 final stats; ranked client-side by finish time, then WPM. |
| WPM live display | `apps/web/src/store/race.ts` (NEW Zustand store) | — | Isolated from cursor store (Phase 2 pattern) to avoid render storms on every keystroke. |

---

## Standard Stack (no new libs needed)

### Core (existing, all in package.json today)
| Library | Version | Purpose | Why Standard |
|---|---|---|---|
| Zod | 4.5.4 | Discriminated union wire schemas | [VERIFIED: apps/server/package.json:13] Phase 2 established Zod 4 as wire contract (REQ-13). Phase 3 EXTENDS unions. |
| Bun | 1.3.2 | Runtime + WS server | [VERIFIED: package.json:17] `engines.bun >=1.3.2 <1.5.0`. Phase 2 patterns extend cleanly. |
| React | 19.2.8 | UI | [VERIFIED: apps/web/package.json:8] Lobby + RaceView + new ResultsBoard. |
| Zustand | 5.0.15 | Client state | [VERIFIED: apps/web/package.json:11] Phase 2 established isolated store pattern (`useCursorStore`, `useClockStore`). Phase 3 adds `useRaceStore` for char-states + WPM. |
| Hono | 4.13.5 | HTTP routing (not used by Phase 3 wire changes) | [VERIFIED: apps/server/package.json:12] Static check — no HTTP changes in Phase 3. |
| nanoid | 6.0.1 | Already in shared; passages don't need IDs generated, just const lookup | [VERIFIED: packages/shared/package.json:10] |

### Supporting (no new adds)
| Library | Version | Purpose | When to Use |
|---|---|---|---|
| `bun:test` | built-in | Pure-function tests for `scoring.ts`, `validate-keystroke.ts` extension | Per Phase 2 plan 04 patterns (8 tests there). |
| `vitest` + `@testing-library/react` | 4.1.11 / 16.3.3 | Component tests for RaceView (char-state accents) + ResultsBoard | Already in `apps/web`. Phase 2 didn't add component tests; Phase 3 may add 1-2 if time. |
| `pino` | 10.3.1 | Server logging | [VERIFIED: apps/server/package.json:14] Grace-end log line already supported. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|---|---|---|
| Plain const-array passages | JSON file fetched at startup | JSON file adds I/O complexity (path resolution, load order). Const array is zero-config + tree-shakable. D-03 explicitly locks this. |
| New `pick_passage` C→S frame | Fold selection into `start_race` payload | CONTEXT.md notes both as options. Recommendation: fold into `start_race.passageId` (simpler — picker happens entirely in the host's client before sending start). Server validates `passageId` is in `corpus` + not in `usedThisRoom`. New `pick_passage` frame is overkill — host's UI is local until `start_race`. |
| Separate `wpm_update` frame | Append `wpm` to existing `cursor_update` | D-05 says "broadcast on `cursor_update` or a separate lightweight frame". Recommendation: add `wpm?: number` to `cursor_update` (Phase 2 already broadcasts cursor_update on every accepted keystroke). One frame, zero new dispatch case. |
| React state for char-states | Zustand store (per `useRaceStore`) | Zustand matches Phase 2's isolated-store pattern (cursor store, clock store, connection store). Avoids render storms when 10Hz cursor frames arrive. |

**Installation:** None — Phase 3 uses existing dependencies.

---

## Architecture Patterns

### Pattern 1: Wire schema extension via discriminated union extension (not fork)

**What:** Phase 2 established `clientToServerSchema` and `serverToClientSchema` as discriminated unions (see `packages/shared/src/messages.ts:78-87` and `:189-200`). Phase 3 adds new members; both unions gain a case. Zod's `.parse()` exhaustiveness check naturally forces every new member into `dispatch.ts`.

**When to use:** Any new frame added to the wire contract. Never re-define the union.

**Example:** [VERIFIED: packages/shared/src/messages.ts:189-200]

```ts
// packages/shared/src/messages.ts — extend (do not replace)
// Add to clientToServerSchema union members:
//   startRaceSchema (extended; was { type: "start_race" }, now adds passageId?+graceSeconds?)
// Add to serverToClientSchema union members:
//   graceCountdownSchema (NEW)
//   raceEndSchema (extended; gains results: PlayerFinalStats[])
```

### Pattern 2: Server-authoritative state, client mirror for UI

**What:** Phase 2 established this for cursors. Server is the source of truth for `Player.progress`; client mirrors for UI. Phase 3 extends to `Player.charStates` and `Player.wpm`. Client never computes WPM; it only renders.

**When to use:** Any field that affects fairness (scoring, correctness) — server owns it.

**Example:** [VERIFIED: apps/server/src/race/types.ts:19-32]

```ts
// Player type (existing) extended in Phase 3:
export interface Player {
  // ... existing fields
  charStates: ("pending" | "correct" | "error")[]; // length === passageText.length
  totalKeystrokes: number;  // all accepted chars (for accuracy denominator)
  uncorrectedErrors: number; // errors still showing as 'error' at race end (for net WPM)
  currentWpm: number;       // computed on each accepted keystroke
  finishedAtServerMs: number | null;
}
```

### Pattern 3: Pure-function validator extended to compute side-effects

**What:** Phase 2's `validateKeystroke({room, player, frame, passageText, now}) → {ok}` is pure. Phase 3 extends the return value with the NEW char-states snapshot AND the new `player.wpm`/`player.totalKeystrokes` so dispatch can broadcast them in the same frame. Validator stays pure (no I/O).

**When to use:** When extending validation logic with derived state — keep it in the same function rather than splitting into a separate "compute char-state" call.

**Example:** [VERIFIED: apps/server/src/race/validate-keystroke.ts:25-63]

```ts
// Extended signature (D-13: server data model):
export type ValidateResult =
  | {
      ok: true;
      newCharStates: ("pending" | "correct" | "error")[];
      playerPatch: {
        totalKeystrokes: number;
        uncorrectedErrors: number;
        currentWpm: number;
      };
    }
  | { ok: false; reason: ServerErrorCode };

// Caller (dispatch.ts):
//   1. Apply playerPatch to player
//   2. Broadcast { type: "cursor_update", ..., charStates: newCharStates, wpm: playerPatch.currentWpm }
```

### Pattern 4: Grace as an FSM sub-state of racing

**What:** D-14 introduces `'grace'` as a new top-level state in the RaceState union. Existing FSM whitelist (`Record<RaceState, ReadonlyArray<RaceState>>` at `apps/server/src/race/controller.ts:21-26`) extends with `racing → ['finished', 'grace']` and `grace → ['finished']`. Keystroke dispatch still requires `state === "racing"` — clients keep typing during grace (D-08). Tick() detects grace expiration → `transition(room, 'finished')` + broadcast `race_end`.

**When to use:** Any state that has different allowed-next-states from its parent but shares much of its handler logic.

**Example:**

```ts
// packages/shared/src/race.ts — extend RaceState union:
export const raceStateSchema = z.enum([
  "lobby", "countdown", "racing", "grace", "finished",
]);

// apps/server/src/race/controller.ts — extend ALLOWED:
const ALLOWED: Record<RaceState, ReadonlyArray<RaceState>> = {
  lobby: ["countdown"],
  countdown: ["racing", "lobby"],
  racing: ["grace", "finished"],
  grace: ["finished"],
  finished: ["lobby"],
};

// tick() gain:
if (room.state === "racing" && /* all players finished */) { ... }
if (room.state === "racing" && /* first player finished */) {
  room.firstFinisherId = ...;
  room.graceEndsAtServerMs = now + room.graceSeconds * 1000;
  transition(room, "grace");
  broadcastGraceCountdown(room);
}
if (room.state === "grace" && /* another player finished OR grace expired */) {
  transition(room, "finished");
  broadcastRaceEnd(room);
}
```

### Pattern 5: Zustand isolated store for high-frequency UI updates

**What:** Phase 2's `useCursorStore` (apps/web/src/store/cursor.ts) is isolated so 10Hz cursor updates don't trigger whole-app re-renders. Phase 3 adds `useRaceStore` for char-states + WPM with the same shape.

**When to use:** Any state that updates on the order of Hz (not every render).

**Example:** [VERIFIED: apps/web/src/store/cursor.ts:17-20]

```ts
// apps/web/src/store/race.ts — NEW (mirrors cursor.ts pattern):
export type CharState = "pending" | "correct" | "error";
export type RaceUiState = {
  ownCharStates: CharState[];          // length === passageText.length
  ownWpm: number;                      // live net WPM
  opponentWpm: Record<string, number>; // playerId → wpm (for opponent cursors)
  graceBanner: { leaderName: string; remainingMs: number } | null;
};
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| WPM formula | Custom "what feels right" formula | `computeWpm(correctChars, uncorrectedErrors, ms)` literal spec from D-05 verbatim | ROADMAP criterion 2 SPEC FIXTURE is "30 chars in 30s → 2 WPM". Any deviation breaks the test. Two typing sites, two WPMs, is a known trap. |
| Backspace-aware correctness | Append-only keystroke log with "char X at time T" stream | Per-char state array (D-13). Last write wins; no need to replay history. | Append-log forces every "is char N correct?" query to scan the log. O(chars²) cost; O(chars) with the state array. |
| Word-boundary detection | Per-passage hand-curated `words: string[]` array | `passageText.split(/\s+/)` — strips empty matches | Phase 3 needs word correctness for stats aggregation. Per-passage array is bookkeeping overhead with no value. Regex split is robust. |
| Passage selection | "Pick random" then risk collision | Shuffled-deck-without-replace (D-04) | Sequential picker from a shuffled deck guarantees no repeat within a session. Random-with-history is the wrong primitive — same passage can repeat in a row if shuffle is unlucky. |
| Grace period | Set timeout per finish, mutate state | Extend FSM with `'grace'` state (D-14); tick() handles expiration | A one-off timer doesn't compose with the existing 1Hz tick + whitelist FSM pattern. FSM extension is the cleanest path. |
| Results ranking | Server pre-sorts, sends ranked array | Server sends flat `results: {playerId, finishTimeMs, wpm, accuracy}[]`; client sorts | D-10 explicitly says "ranked client-side by finish time, then WPM as tiebreaker". Server doesn't carry ranking logic — single source of truth (data) without a server-side opinion. |
| Char-state accent CSS | Inline styles per char | Class-based with `data-state="correct|error|pending"` (D-11) | D-11 says "underline accent below each char: green = correct, red = wrong". CSS class + `text-decoration-color` is cleaner than inline color logic. |

**Key insight:** WPM is a contract; backspace correctness is a data shape. Both have well-known traps (multiple conventions, log vs state) — lock the formula (D-05) and shape (D-13) and test them with the spec fixtures from ROADMAP.

---

## Common Pitfalls

### Pitfall 1: Treating "char correct" as binary append-only (D-11/D-13)

**What goes wrong:** Server tracks `charsCorrect: number` by counting accepted keystrokes. Player types "th", backspaces, types "the". Server sees 5 keystrokes, all accepted (each char is correct in isolation). But "th" is wrong at positions 0-1; "the" is correct. A correct accumulator misses that the FINAL state at position 0-2 is "the" correct.

**Why it happens:** Confusing "keystroke accepted" with "char currently correct". The former is per-event; the latter is per-position snapshot.

**How to avoid:** Per-char state tuple (D-13). When a keystroke at index N is accepted with char C:
- If `passageText[N] === C` → state[N] = 'correct'.
- If `passageText[N] !== C` → state[N] = 'error'. (And keep the previous 'error' state if already set.)
Backspace at index N → state[N-1] is left alone (position-based, not stream-based).

**Warning signs:** WPM stays high for a player who visibly made many errors and corrected them; or accuracy appears identical to "raw chars typed / 5" (wrong formula).

### Pitfall 2: Net WPM formula drift — using `elapsedSeconds` vs `minutesElapsed`

**What goes wrong:** D-05 specifies `max(0, (correctChars/5) − (uncorrectedErrors/5)) / minutesElapsed`. If you use `(correctChars - uncorrectedErrors) / 5 / minutesElapsed`, the math simplifies fine when positive — but the `max(0, ...)` is meant to prevent the WPM going negative during heavy correction phases; the simplification could yield a slightly different number near zero crossings.

**Why it happens:** Algebraic rewrite "looks equivalent" but loses the clamp on intermediate.

**How to avoid:** Code D-05 verbatim. Test the spec fixture: `correctChars=30, uncorrectedErrors=0, ms=30000` → `max(0, (30/5) - 0) / 0.5 = 6 / 0.5 = 12 WPM` — wait, that's wrong. Re-read ROADMAP success criterion 2: "30 correct chars in 30s → 2 WPM".

ROADMAP says `correctChars / 5 / minutesElapsed`. So `30 / 5 / (30/60) = 6 / 0.5 = 12 WPM`. Hmm. Let me re-check the ROADMAP claim — it says "matches a known fixture (e.g., 30 correct chars in 30s → 2 WPM)". That works ONLY if the formula is `(correctChars / 5) / elapsedMinutes` AND 30 chars / 5 = 6 words, AND 6 words / 30s = 12 WPM, not 2 WPM. The 2 WPM figure assumes a different unit — likely `(correctChars / 5) / elapsedMinutes * 60 / 60 = 6 / 30 * 60 = 12`. OR the ROADMAP example itself was wrong.

**Recommendation:** Follow D-05 verbatim (`max(0, (correct/5) − (uncorrected/5)) / minutesElapsed`). Use the ROADMAP fixture as a ROUND-TRIP check — if the unit math yields 12 WPM for 30 chars / 30s, document that in the test. The PLANNER MUST verify the spec fixture during plan-check and surface any discrepancy to the user before locking the formula.

**Warning signs:** WPM numbers look way different from established typing-test sites (monkeytype, typeracer) for the same text/typing speed.

### Pitfall 3: Grace period — clients stop typing when the leader finishes

**What goes wrong:** D-08 explicitly says others keep typing. If the client UI grays out the passage input during grace, players lose their progress and the competitive moment dies.

**Why it happens:** Misreading D-08 as "race is over, show banner". The banner is a counter ("5s remaining"), not a stop sign.

**How to avoid:** Grace is server-side only. `validateKeystroke` continues to accept keystrokes when `room.state === 'grace'`. UI shows banner but input stays enabled. The only client change during grace: don't move cursor past the end (still clamp at passageText.length — same as during racing).

**Warning signs:** E2E test with two clients shows second client stops typing at the grace banner.

### Pitfall 4: Passage preview leaks full text to non-host before race starts

**What goes wrong:** D-02 says "Other players see 'Host chose: [first 30 chars]…' in the lobby." If the server sends `passageText` to non-hosts before `race_start`, the host's pick is moot — everyone can just wait for the start and blast through the known text.

**Why it happens:** Convenience: "the lobby state already includes the passage, just render it." But D-02 deliberately hides the text until race_start.

**How to avoid:** `lobby_state` carries `hostPickedPassagePreview?: string` (first 30 chars + ellipsis) but NOT full text. `race_start` carries the full `passageText` (Phase 2 already does). The host's picker UI is the ONLY place the full text appears before start.

**Warning signs:** Non-host client logs `passageText.length === expectedLength` on the lobby_state frame.

### Pitfall 5: No-repeat deck — reshuffle can repeat the LAST passage immediately

**What goes wrong:** Player A picks passage 47, race ends. Deck reshuffles. New shuffle happens to land passage 47 first. Player A picks again — gets the same one. CONTEXT says "Same-room rematch never reuses the previous passage."

**Why it happens:** Simple Fisher-Yates reshuffle has no "exclude last" logic.

**How to avoid:** When reshuffling, take the prior passage out first, shuffle the rest, then prepend the prior passage at the end (or use rejection: keep shuffling until first card ≠ prior). Simpler: store `room.lastPassageId: string | null`; when reshuffling, move the prior to the tail. Or: just rotate-deal — sequential through the deck, and the deck order itself is regenerated only on first deal.

**Warning signs:** Manual 2-laptop demo shows the same passage twice in a row.

### Pitfall 6: WPM refresh storm — broadcasting on every keystroke floods opponents

**What goes wrong:** Every accepted keystroke (up to ~10/sec/player) broadcasts a cursor_update with WPM. With 8 players × 10 Hz = 80 frames/sec/room broadcast to 7 others = 560 frames/sec. Without throttling, this saturates the wire.

**Why it happens:** Phase 2's `cursor_update` broadcasts on every accepted keystroke already (D-05 mentions this is fine because cursor updates are already happening). But adding WPM to each frame increases payload — and if WPM recalculation is expensive (it isn't), it can compound.

**How to avoid:** (a) WPM is cheap — `(correctChars - uncorrectedErrors) / 5 / elapsedMinutes` is 4 arithmetic ops per recompute. (b) The frame payload grows by ~8 bytes (1 number). (c) DON'T throttle cursor_update at the server (Phase 2 comment notes "Phase 5 polish" might split `lastCursorAtMs`; not yet). (d) On the CLIENT, throttle the React re-render of the WPM display at 2-5 Hz (Phase 3 discretion from CONTEXT.md "WPM refresh rate").

**Warning signs:** Frame size profiler shows cursor_update > 200 bytes; CPU on a 4-player room climbs above 1% sustained.

### Pitfall 7: Word-boundary detection on contractions/hyphens

**What goes wrong:** `passageText.split(/\s+/)` splits on whitespace. "don't" becomes `["don't"]` (1 word). "ice-cream" becomes `["ice-cream"]` (1 word). Contractions and hyphens count as 1 word — which matches typing convention. But "Mr. Smith said..." splits into 4 words `["Mr.", "Smith", "said..."]` — the period doesn't affect word count. This is consistent with typing-test conventions.

**Why it happens:** Devs worry about apostrophes and hyphens. They don't matter for word counting.

**How to avoid:** Just use `/\s+/`. Test fixture: `"don't worry"` should count as 2 words. Verify in unit test.

**Warning signs:** Word-correctness stats differ from typing-test sites by >5% on the same passage.

### Pitfall 8: Server-side char-state vector size — race-end broadcast payload

**What goes wrong:** `race_end` carries `results: {playerId, finishTimeMs, wpm, accuracy}[]` — per-player, not per-char. But if a planner mistakenly tries to broadcast the full `charStates` array in `race_end`, that's 30-60 chars × 8 players × ~6 bytes = 2.8 KB per race_end. Not catastrophic, but unnecessary.

**Why it happens:** Misreading "server-authoritative" as "broadcast everything server-side knows."

**How to avoid:** `charStates` lives in server memory only. Final aggregation (word correctness, accuracy) is pre-computed; race_end sends only `{finishTimeMs, wpm, accuracy}`. Char-states are broadcast DURING the race in cursor_update so opponents see colored cursors, but those cursor_update frames are already streaming.

**Warning signs:** `race_end` payload size > 500 bytes.

---

## Code Examples

### Wire schema extensions

```ts
// packages/shared/src/messages.ts — EXTEND existing schemas (do not replace)

// Client → Server: startRaceSchema gains passageId?+graceSeconds?
export const startRaceSchema = z.object({
  type: z.literal("start_race"),
  passageId: z.string().uuid(),          // Phase 3: host picks (D-01/D-02)
  graceSeconds: z.number().int().min(3).max(10).default(5), // D-09
});

// Server → Client: NEW grace_countdown frame (D-15)
export const graceCountdownSchema = z.object({
  type: z.literal("grace_countdown"),
  remainingMs: z.number().int().nonnegative(),
  leaderPlayerId: z.string().uuid(),
  leaderNickname: z.string(),
});

// Server → Client: race_end extended with per-player final stats (D-10)
export const playerFinalStatsSchema = z.object({
  playerId: z.string().uuid(),
  finishTimeMs: z.number().int().nonnegative(),
  wpm: z.number().nonnegative(),       // net WPM at finish
  accuracy: z.number().min(0).max(1),  // correctChars / totalKeystrokes
});
export type PlayerFinalStats = z.infer<typeof playerFinalStatsSchema>;

export const raceEndSchema = z.object({
  type: z.literal("race_end"),
  reason: z.enum(["finished", "abandoned"]),
  finishedPlayerIds: z.array(z.string().uuid()),
  results: z.array(playerFinalStatsSchema), // NEW
});

// Server → Client: cursor_update extended with own-char-states + wpm for the typing player
// (D-05: WPM lives on the existing cursor_update frame; no separate frame)
export const cursorUpdateSchema = z.object({
  type: z.literal("cursor_update"),
  playerId: z.string().uuid(),
  index: z.number().int().nonnegative(),
  serverTs: z.number().int(),
  // NEW: snapshot of the typing player's char-states (length === passageText.length)
  charStates: z.array(z.enum(["pending", "correct", "error"])).optional(),
  // NEW: net WPM (D-05 — sender's own WPM; opponents don't strictly need this but it's cheap)
  wpm: z.number().nonnegative().optional(),
});

// Server → Client: lobby_state gains hostPickedPassagePreview (D-02)
export const lobbyStateSchema = z.object({
  type: z.literal("lobby_state"),
  roomCode: z.string().regex(ROOM_CODE_REGEX),
  players: z.array(PLAYER_SUMMARY),
  hostPickedPassagePreview: z.string().optional(), // first 30 chars + "…"
});
```

### Char-state model + scoring (server)

```ts
// apps/server/src/race/types.ts — EXTEND existing types
export type CharState = "pending" | "correct" | "error";

export interface Player {
  // ... existing fields (playerId, nickname, isHost, wsRef, progress, lastKeystrokeAt, clientOffsetMs, joinedAt)
  charStates: CharState[];           // length === passageText.length; default all 'pending'
  totalKeystrokes: number;          // all accepted chars (denominator for accuracy D-06)
  uncorrectedErrors: number;        // chars still in 'error' state (D-05 net WPM)
  currentWpm: number;               // D-05 — recomputed each accepted keystroke
  finishedAtServerMs: number | null;
}

export interface Room {
  // ... existing fields
  graceSeconds: number;             // D-09 — set on room create or first start
  firstFinisherId: PlayerId | null; // D-14
  graceEndsAtServerMs: number | null;
  usedPassageIds: Set<PassageId>;   // D-04 no-repeat within session
  deckOrder: PassageId[];           // shuffled deck
  deckCursor: number;               // next passage to deal
}
```

```ts
// apps/server/src/race/scoring.ts — NEW (D-05/D-06 verbatim)
export function computeNetWpm(args: {
  correctChars: number;
  uncorrectedErrors: number;
  elapsedMs: number;
}): number {
  const minutes = args.elapsedMs / 60_000;
  if (minutes <= 0) return 0;
  const raw = (args.correctChars / 5 - args.uncorrectedErrors / 5) / minutes;
  return Math.max(0, raw);
}

export function computeAccuracy(args: {
  correctChars: number;
  totalKeystrokes: number;
}): number {
  if (args.totalKeystrokes === 0) return 0;
  return args.correctChars / args.totalKeystrokes;
}
```

```ts
// apps/server/src/race/validate-keystroke.ts — EXTEND return value
import { computeNetWpm } from "./scoring.ts";

export type ValidateResult =
  | {
      ok: true;
      newCharStates: CharState[];     // snapshot for broadcast
      playerPatch: {
        totalKeystrokes: number;
        uncorrectedErrors: number;
        currentWpm: number;
      };
    }
  | { ok: false; reason: ServerErrorCode };

export function validateKeystroke(args: {
  room: Room;
  player: Player;
  frame: Keystroke;
  passageText: string;
  now: number;
}): ValidateResult {
  // ... existing 4 checks (state/guard, grace, min-interval, char-match)

  // All checks passed — compute char-state transition
  const newStates = [...player.charStates];
  const expected = passageText[frame.index];
  if (expected === undefined) return { ok: false, reason: "INVALID_FRAME" };
  newStates[frame.index] = frame.char === expected ? "correct" : "error";

  // Recompute uncorrectedErrors (any 'error' state still present)
  const uncorrectedErrors = newStates.filter((s) => s === "error").length;

  // Recompute correctChars
  const correctChars = newStates.filter((s) => s === "correct").length;

  // Update server-side state
  player.charStates = newStates;
  player.totalKeystrokes++;
  player.uncorrectedErrors = uncorrectedErrors;
  player.currentWpm = computeNetWpm({
    correctChars,
    uncorrectedErrors,
    elapsedMs: args.now - (args.room.startsAtServerMs ?? args.now),
  });
  player.lastKeystrokeAt = args.now;
  if (frame.index + 1 > player.progress) player.progress = frame.index + 1;

  // Detect finish
  if (player.progress >= passageText.length) {
    player.finishedAtServerMs = args.now;
  }

  return {
    ok: true,
    newCharStates: newStates,
    playerPatch: {
      totalKeystrokes: player.totalKeystrokes,
      uncorrectedErrors: player.uncorrectedErrors,
      currentWpm: player.currentWpm,
    },
  };
}
```

### Corpus + no-repeat deck (server)

```ts
// packages/shared/src/passages.ts — NEW (D-03)
export interface Passage {
  id: string;       // uuid v4 (pre-generated, deterministic for the const)
  text: string;     // 30-60 words, public-domain English
  source: string;   // "Mark Twain — Tom Sawyer, Ch. 1" (attribution)
}

// Hand-curated ~50-100 entries. Phase 3 plan 01 hand-builds this list.
export const PASSAGES: ReadonlyArray<Passage> = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    text: "The quick brown fox jumps over the lazy dog. Sphinx of black quartz judge my vow.",
    source: "Pangram (public domain)",
  },
  // ... ~50-100 more
];

export function isValidPassageId(id: string): boolean {
  return PASSAGES.some((p) => p.id === id);
}

export function getPassageById(id: string): Passage | null {
  return PASSAGES.find((p) => p.id === id) ?? null;
}
```

```ts
// apps/server/src/race/corpus.ts — NEW (D-04 shuffled deck)
import { PASSAGES } from "@typing-race/shared";

/** Fisher-Yates shuffle, returning a new array. */
function shuffle<T>(arr: ReadonlyArray<T>): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function dealNextPassage(args: {
  usedPassageIds: Set<string>;
  deckOrder: string[];
  deckCursor: number;
  lastPassageId: string | null;
}): { passageId: string; deckOrder: string[]; deckCursor: number } {
  // If deck exhausted, reshuffle excluding the prior passage (D-04 pitfall 5)
  if (args.deckCursor >= args.deckOrder.length) {
    const filtered = PASSAGES.map((p) => p.id).filter(
      (id) => id !== args.lastPassageId,
    );
    return {
      passageId: filtered[0]!,
      deckOrder: shuffle(filtered),
      deckCursor: 0,
    };
  }
  return {
    passageId: args.deckOrder[args.deckCursor]!,
    deckOrder: args.deckOrder,
    deckCursor: args.deckCursor + 1,
  };
}
```

### Grace period FSM extension

```ts
// apps/server/src/race/controller.ts — EXTEND
import { dealNextPassage } from "./corpus.ts";
import { computeNetWpm, computeAccuracy } from "./scoring.ts";

const ALLOWED: Record<RaceState, ReadonlyArray<RaceState>> = {
  lobby: ["countdown"],
  countdown: ["racing", "lobby"],
  racing: ["grace", "finished"],
  grace: ["finished"],
  finished: ["lobby"],
};

export function tick(now: number = Date.now()): void {
  for (const room of rooms.values()) {
    if (room.state === "countdown" && room.startsAtServerMs !== null
        && now >= room.startsAtServerMs) {
      try { transition(room, "racing"); } catch { /* defensive */ }
      const passage = getPassageById(room.passageId!);
      const frame: RaceStart = {
        type: "race_start",
        startsAtServerMs: room.startsAtServerMs!,
        passageId: room.passageId!,
        passageText: passage!.text,
      };
      broadcastToRoom(room, frame);
      continue;
    }

    // Phase 3: first-finish detection
    if (room.state === "racing" && room.startsAtServerMs !== null) {
      const firstFinisher = [...room.players.values()].find(
        (p) => p.finishedAtServerMs !== null,
      );
      if (firstFinisher && room.firstFinisherId === null) {
        room.firstFinisherId = firstFinisher.playerId;
        room.graceEndsAtServerMs = now + room.graceSeconds * 1000;
        try { transition(room, "grace"); } catch { /* defensive */ }
        broadcastGraceCountdown(room, firstFinisher);
        continue;
      }

      // All-finished check (could end without grace if last player finishes first)
      const allDone = [...room.players.values()].every(
        (p) => p.finishedAtServerMs !== null,
      );
      if (allDone) {
        try { transition(room, "finished"); } catch { /* defensive */ }
        broadcastRaceEnd(room);
        continue;
      }
    }

    // Phase 3: grace expiration → race end
    if (room.state === "grace" && room.graceEndsAtServerMs !== null
        && now >= room.graceEndsAtServerMs) {
      try { transition(room, "finished"); } catch { /* defensive */ }
      broadcastRaceEnd(room);
      continue;
    }
  }
}
```

### React race view (char-state accents D-11/D-12)

```tsx
// apps/web/src/components/RaceView.tsx — EXTEND existing render
import type { CharState } from "../store/race.ts";

export function RaceView({ passageText, playerId, onKeystroke }: {
  passageText: string;
  playerId: string;
  onKeystroke: (index: number, char: string) => void;
}): React.ReactElement {
  const ownCharStates = useRaceStore((s) => s.ownCharStates);
  const ownWpm = useRaceStore((s) => s.ownWpm);
  const graceBanner = useRaceStore((s) => s.graceBanner);

  // ... existing keystroke handler

  return (
    <div className="race-view">
      {graceBanner && (
        <div className="grace-banner" role="status">
          {graceBanner.leaderName} finished — {Math.ceil(graceBanner.remainingMs / 1000)}s remaining
        </div>
      )}
      <div className="wpm-pill">WPM: {Math.round(ownWpm)}</div>
      <div className="passage">
        {passageText.split("").map((ch, i) => {
          const state: CharState = ownCharStates[i] ?? "pending";
          return (
            <span key={i} className={`char char-${state}`}>
              {ch}
              {/* opponent cursors rendered on top */}
            </span>
          );
        })}
      </div>
    </div>
  );
}
```

```css
/* apps/web/src/styles.css — ADD char-state accents (D-11) */
.char-pending { color: #6b7280; }
.char-correct {
  color: #e6e8ee;          /* normal text color */
  text-decoration: underline;
  text-decoration-color: #10b981; /* green */
  text-decoration-thickness: 2px;
  text-underline-offset: 4px;
}
.char-error {
  color: #e6e8ee;
  text-decoration: underline;
  text-decoration-color: #ef4444; /* red */
  text-decoration-thickness: 2px;
  text-underline-offset: 4px;
}
```

### Results board (D-10)

```tsx
// apps/web/src/components/ResultsBoard.tsx — NEW
import type { PlayerFinalStats } from "@typing-race/shared";

export function ResultsBoard({
  results,
  onRematch,
  isHost,
}: {
  results: PlayerFinalStats[];
  onRematch: () => void;
  isHost: boolean;
}): React.ReactElement {
  // D-10: rank client-side by finishTimeMs, then wpm as tiebreaker
  const ranked = [...results].sort((a, b) => {
    if (a.finishTimeMs !== b.finishTimeMs) return a.finishTimeMs - b.finishTimeMs;
    return b.wpm - a.wpm;
  });

  return (
    <div className="results-board">
      <h2>Results</h2>
      <ol>
        {ranked.map((r, i) => (
          <li key={r.playerId}>
            <span className="rank">#{i + 1}</span>
            <span className="time">{(r.finishTimeMs / 1000).toFixed(2)}s</span>
            <span className="wpm">{Math.round(r.wpm)} WPM</span>
            <span className="accuracy">{(r.accuracy * 100).toFixed(0)}% acc</span>
          </li>
        ))}
      </ol>
      {isHost && <button onClick={onRematch}>Rematch</button>}
    </div>
  );
}
```

---

## Validation Architecture

Nyquist validation IS enabled (`config.json: workflow.nyquist_validation = true`). Phase 3 owns REQ-05 (per-word correctness + backspace), REQ-08 (race-end board), REQ-10 (bundled passage corpus).

### Test Framework
| Property | Value |
|---|---|
| Framework (server) | `bun:test` (built-in, Phase 2 pattern) |
| Framework (web) | `vitest` + `@testing-library/react` + `happy-dom` (already installed) |
| Config file | `apps/web/vitest.config.ts` — none yet, Phase 2 didn't add component tests |
| Quick run | `bun --filter '@typing-race/server' test` |
| Full suite | `bun run --filter '*' test` (both server + web) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| REQ-05 | Per-char state transitions: type correct → 'correct', type wrong → 'error' | unit | `bun test apps/server/src/__tests__/char-states.test.ts` | ❌ Wave 0 |
| REQ-05 | Backspace doesn't reduce correctness of past chars | unit | same file | ❌ Wave 0 |
| REQ-05 | Word-correctness aggregation: word correct iff all chars 'correct' | unit | same file | ❌ Wave 0 |
| REQ-08 | Race end fires after grace expiry or all-finished | unit | `bun test apps/server/src/__tests__/race-end.test.ts` | ❌ Wave 0 |
| REQ-08 | race_end.results carries per-player finishTimeMs + wpm + accuracy | unit | same file | ❌ Wave 0 |
| REQ-10 | Passage corpus: 50-100 entries, each 30-60 words | unit | `bun test packages/shared/src/__tests__/passages.test.ts` | ❌ Wave 0 |
| REQ-10 | No-repeat deck within room session | unit | `bun test apps/server/src/__tests__/corpus.test.ts` | ❌ Wave 0 |
| D-05 | Net WPM spec fixture: known input → known output (see Pitfall 2 caveat) | unit | `bun test apps/server/src/__tests__/scoring.test.ts` | ❌ Wave 0 |
| D-06 | Accuracy: correctChars / totalKeystrokes | unit | same file | ❌ Wave 0 |
| D-08 | Grace period: first-finish triggers grace_countdown | unit | race-end.test.ts | ❌ Wave 0 |
| D-09 | Host grace picker: 3/5/10 stored on Room | unit | race-controller.test.ts (extend) | partial (existing 6 tests) |
| D-14 | FSM extends to include 'grace' state with valid transitions | unit | same file | partial |

### Sampling Rate
- **Per task commit:** `bun test apps/server/src/__tests__/scoring.test.ts scoring.test.ts char-states.test.ts` (the most-likely-to-break files)
- **Per wave merge:** `bun run --filter '*' test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps (Phase 3 creates these)
- [ ] `apps/server/src/__tests__/char-states.test.ts` — covers REQ-05 + D-13
- [ ] `apps/server/src/__tests__/scoring.test.ts` — covers D-05/D-06 fixtures
- [ ] `apps/server/src/__tests__/corpus.test.ts` — covers D-04 no-repeat + D-03 corpus size
- [ ] `apps/server/src/__tests__/race-end.test.ts` — covers D-08/14/15 + race_end schema
- [ ] `packages/shared/src/__tests__/passages.test.ts` — covers REQ-10 corpus shape
- [ ] Extend `apps/server/src/__tests__/validate-keystroke.test.ts` with char-state side-effects (existing 8 tests stay)
- [ ] Extend `apps/server/src/__tests__/race-controller.test.ts` with grace transitions (existing 6 tests stay)
- [ ] (Optional) `apps/web/src/__tests__/RaceView.test.tsx` — char-state accents render with right class

### Nyquist Experiments (E1-E6)

| Exp | Name | What it verifies |
|---|---|---|
| **E1** | Char-state transition fixture | Type 10 chars correctly → charStates[0..9] all 'correct'. Type char 11 wrong → charStates[10] = 'error'. Type char 10 wrong (overwriting correct) → charStates[10] = 'error'. Char 10 + 11 backspaced → charStates unchanged. Char 10 retyped correctly → 'correct'. Verifies REQ-05 (per-word correctness + backspace). |
| **E2** | WPM spec fixture | Reaches ROADMAP success criterion 2: known input → known output. Includes the Pitfall 2 caveat verification: compute `correctChars / 5 / minutesElapsed` for 30 chars / 30s and document the actual resulting WPM. The PLANNER MUST surface the ROADMAP-vs-D-05 unit discrepancy if any before locking the formula. |
| **E3** | Race-end grace flow | Simulate 2-player race: player A finishes → grace_countdown broadcast to B with `remainingMs ≈ graceSeconds*1000`. Player B continues typing during grace. Grace expires → race_end broadcast with B's WPM (whatever they achieved). Verifies D-08/14/15. |
| **E4** | Host-pick passage schema | Host sends `start_race { passageId: "00000000-0000-4000-8000-000000000001" }`. Server validates `isValidPassageId`. Non-host join receives `joined_room` WITHOUT full `passageText`; only `hostPickedPassagePreview` (first 30 chars + "…"). Verifies D-01/02/04 + Pitfall 4 (no premature full-text leak). |
| **E5** | No-repeat deck | Create room. Play 5 races sequentially. Assert no `passageId` appears twice. Force exhaustion (set `deckCursor = PASSAGES.length`); next deal reshuffles. Verify prior passage is NOT at top of new deck. Verifies D-04 + Pitfall 5. |
| **E6** | Results board ranked | Server sends race_end with `results` array in arbitrary order. Client sorts: finishTimeMs ascending, wpm descending as tiebreaker. Assert rank positions. Verifies D-10. |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | The ROADMAP success criterion "30 chars in 30s → 2 WPM" is a typo / fixture-vs-formula mismatch; actual value per D-05's formula `correctChars/5/minutesElapsed` is 12 WPM. PLANNER MUST verify and surface. | Common Pitfall 2 / Validation E2 | Phase 3 ships with the wrong unit understanding. |
| A2 | `cursor_update` payload growth (~8 bytes for `wpm`, ~120 bytes for `charStates`) does not require throttling at the server. Per-keystroke broadcast is fine. | Common Pitfall 6 | Frame rate becomes unsustainable; but Phase 2 already broadcasts cursor_update per keystroke without throttling — adding fields is incremental. |
| A3 | React Compiler / re-render storms aren't a concern for `useRaceStore`. The 2-5 Hz client-side throttle on the WPM display (Claude's discretion) is sufficient. | Architecture Pattern 5 | Cursor renders cascade and tank frame rate. Phase 5 polish owns the deeper fix. |
| A4 | Fisher-Yates shuffle with `Math.random()` is acceptable entropy for room-session no-repeat. Not crypto-strong but uniform enough for a demo. | Don't Hand-Roll (deck), Pitfall 5 | Negligible — collision in a single session is vanishingly rare. |
| A5 | Per-passage hand-curated corpus of 50-100 entries is feasible in one plan's work. ~30 chars × 60 words × 50-100 = 1500-3000 words of public-domain text to source + format. | Architecture Responsibility Map | Plan 01 takes longer than 21-min Phase 2 average. PROJECT.md says corpus is "bundled" — does not pin count, but ROADMAP says "~50-100". |

**If this table is empty:** All claims were verified. (It isn't — 5 [ASSUMED] items flagged.)

---

## Open Questions

1. **WPM unit clarification (A1)** — does the user want 2 WPM or 12 WPM for 30 chars / 30s?
   - What we know: D-05 formula gives 12 WPM; ROADMAP criterion 2 says 2 WPM. They contradict.
   - What's unclear: Which is the intended UX (Monkeytype-style 60-100 WPM or test-fixture-typo).
   - Recommendation: PLANNER surfaces to user during plan-check; ships with D-05 verbatim + unit test that documents the discrepancy.

2. **WPM refresh rate (Claude's discretion in CONTEXT.md)** — every keystroke or throttled 2 Hz?
   - What we know: cursor_update is per-keystroke already; WPM is one extra number per frame.
   - What's unclear: Whether the UI display should re-render on every keystroke (matches existing cursor_update cadence) or at 2 Hz (less visual jitter).
   - Recommendation: Default to per-keystroke (matches cursor_update cadence; matches "server broadcast on each accepted keystroke" from D-05). Add a CSS transition on the WPM number to smooth the visual change.

3. **Grace period visibility on host's screen** — does the host see the banner too?
   - What we know: D-08 says "other players see a banner" — host IS one of the other players if they haven't finished. If host finished first, they don't see their own banner (they ARE the leader).
   - What's unclear: Edge case behavior.
   - Recommendation: Server sends `grace_countdown` to all room members; leader is excluded from "remaining" but sees the banner saying "You finished — Ns for others".

4. **Rematch countdown** — D-08 says "rematch button on results board starts a new race in the same room with a new passage" (from ROADMAP). ROADMAP success criterion 5 also says "'Starting in 2s…' pause shows server-synced countdown". Does the 3s countdown (already implemented in Phase 2) cover this, or does the user want a 2s pause specific to rematch?
   - What we know: Phase 2 has COUNTDOWN_DURATION_MS = 3_000.
   - What's unclear: Whether rematch needs a different countdown or reuse the same one.
   - Recommendation: Reuse 3s. Implementation already exists.

---

## Security Domain

`workflow.security_enforcement = true` (config.json). Phase 3 owns input paths that already pass through Phase 2's anti-cheat.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | no | Anonymous rooms, no login |
| V3 Session Management | no | Phase 4 owns reconnect/sessionTokens |
| V4 Access Control | yes | Host-only `start_race` (Phase 2); Phase 3 adds host-only `passageId` validation |
| V5 Input Validation | yes | Zod 4 schemas (Phase 2); Phase 3 extends to `passageId`, `graceSeconds`, new `grace_countdown`, `race_end.results` |
| V6 Cryptography | no | No new crypto (Phase 4 may add for sessionToken) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Host picks passageId from outside the corpus (injection) | Tampering | `isValidPassageId(passageId)` server-side check; reject `INVALID_FRAME` if not in `PASSAGES` |
| Host manipulates `graceSeconds` outside [3, 10] | Tampering | Zod `.min(3).max(10)` schema |
| Client claims `charStates` or `wpm` in cursor_update (already-validated frame) | Tampering / Spoofing | Server IGNORES client-sent char-states + wpm; only reads them from its own validator output. Schema is `optional()` so they may be present in inbound frames from non-server sources — dispatch ignores them. |
| Passage corpus exhaustion attack (client forces same passage repeatedly via race_end → start_race) | DoS | No-repeat deck (D-04) handles within session. Per-IP rate limit is Phase 4. |
| Client forges `grace_countdown` (no inbound frame, so N/A) | — | `grace_countdown` is server-to-client only; never accepted inbound. |

---

## Reference Patterns Established (from Phase 2)

These proven patterns from Phase 2 SHOULD carry over to Phase 3:

| Pattern | Phase 2 example | Phase 3 application |
|---|---|---|
| Wire schema discriminated union extension | `messages.ts` adds 8 frames | Adds `grace_countdown`; extends `start_race`, `race_end`, `cursor_update`, `lobby_state` |
| FSM whitelist as `Record<RaceState, ReadonlyArray<RaceState>>` | `controller.ts:21-26` | Extend with `'grace'` state |
| Pure-function validator | `validate-keystroke.ts` | Extend return value with char-state side-effects |
| Server-authoritative state, client mirror | `Player.progress` | Add `Player.charStates`, `Player.currentWpm`, `Player.totalKeystrokes` |
| Isolated Zustand store | `useCursorStore` (10Hz) | Add `useRaceStore` (char-states + WPM) |
| Broadcast helpers swallow individual errors | `broadcastToRoom` | `broadcastGraceCountdown`, `broadcastRaceEnd` |
| Server-side `tick()` drives time-based transitions | 1Hz `tick()` | Same; adds grace-expiration check |
| `validateKeystroke` signature: `(room, player, frame, passageText, now) → result` | Phase 2 | Same; just richer return |

---

## Files Phase 3 Will Touch (predicted from CONTEXT.md + integration points)

### Create
- `packages/shared/src/passages.ts` — D-03 corpus const array
- `packages/shared/src/__tests__/passages.test.ts` — corpus shape
- `apps/server/src/race/scoring.ts` — D-05/D-06 formulas
- `apps/server/src/race/corpus.ts` — D-04 no-repeat deck
- `apps/server/src/__tests__/scoring.test.ts`
- `apps/server/src/__tests__/corpus.test.ts`
- `apps/server/src/__tests__/char-states.test.ts`
- `apps/server/src/__tests__/race-end.test.ts`
- `apps/web/src/store/race.ts` — Zustand isolated store
- `apps/web/src/components/LobbyView.tsx` — D-02 host passage picker
- `apps/web/src/components/ResultsBoard.tsx` — D-10 ranking
- `apps/web/src/components/GraceBanner.tsx` — D-15

### Extend (modify existing files)
- `packages/shared/src/messages.ts` — extend unions (add `graceCountdownSchema`; extend `startRaceSchema`, `raceEndSchema`, `cursorUpdateSchema`, `lobbyStateSchema`)
- `packages/shared/src/race.ts` — add `'grace'` to `RaceState`
- `packages/shared/src/index.ts` — barrel-export passages
- `apps/server/src/race/types.ts` — add `graceSeconds`, `firstFinisherId`, `graceEndsAtServerMs`, `usedPassageIds`, `deckOrder`, `deckCursor` to `Room`; add `charStates`, `totalKeystrokes`, `uncorrectedErrors`, `currentWpm`, `finishedAtServerMs` to `Player`
- `apps/server/src/race/controller.ts` — extend `ALLOWED`; add grace detection in `tick()`
- `apps/server/src/race/validate-keystroke.ts` — extend return value with char-states + WPM side-effects
- `apps/server/src/ws/dispatch.ts` — extend `start_race` case to validate `passageId`+`graceSeconds`; extend `keystroke` case to broadcast char-states + WPM in cursor_update; add `grace_countdown` broadcast path in tick
- `apps/server/src/ws/broadcast.ts` — add `broadcastGraceCountdown`, extend `broadcastRaceEnd`
- `apps/server/src/rooms/manager.ts` — initialize `graceSeconds: 5`, `usedPassageIds: new Set()`, `deckOrder: shuffle(...)` on `createRoom`
- `apps/server/src/index.ts` — initialize grace periods on room create
- `apps/web/src/components/RaceView.tsx` — char-state accent rendering (D-11/12)
- `apps/web/src/App.tsx` — render `LobbyView` + `ResultsBoard` at right lifecycle points
- `apps/web/src/styles.css` — `.char-pending`, `.char-correct`, `.char-error`, `.grace-banner`, `.results-board`
- `apps/server/src/__tests__/validate-keystroke.test.ts` — extend existing 8 tests
- `apps/server/src/__tests__/race-controller.test.ts` — extend existing 6 tests

### No new dependencies.

---

## Confidence: HIGH (with caveats)

- **HIGH confidence** for: wire schema extension pattern (Phase 2 proven), FSM extension (whitelist table), pure-function validator extension, Zustand isolated store pattern, broadcast helpers.
- **MEDIUM confidence** for: ROADMAP-vs-D-05 WPM unit discrepancy (Pitfall 2) — needs user confirmation before plan locks.
- **MEDIUM confidence** for: per-keystroke WPM broadcast throttling decision — Claude's call, can pivot in plan.
- **HIGH confidence** for: char-state model being the correct primitive for backspace-aware correctness (Pitfall 1 — established in `.planning/research/PITFALLS.md`).
- **HIGH confidence** for: 50-100 passage corpus fitting in one plan (~3000 words of public-domain text is ~1 day of curation if sourced from Project Gutenberg; the plan can scope to "first 30-50 working entries, leave hook for more").

**Primary recommendation:** Lock the D-05 formula verbatim. Add char-state tuple to `Player`. Extend wire schemas in `messages.ts`. Build the FSM `'grace'` state. Surface the WPM unit question to the user before plan execution so the ROADMAP-vs-D-05 discrepancy is resolved.

---

*Phase: 03-race-track*
*Research complete: 2026-08-30*