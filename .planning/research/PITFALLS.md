# Pitfalls Research

**Domain:** Realtime multiplayer typing-race game (WebSocket, server-authoritative, clock-synced)
**Researched:** 2026-08-30
**Confidence:** HIGH (HIGH for established realtime/WS class pitfalls; MEDIUM for Bun+Fly.io specifics — see Sources)

## Critical Pitfalls

### Pitfall 1: Clock sync drift causes unfair race starts

**What goes wrong:**
Some clients begin typing 200-500ms before others because their local clock diverged from the server's "race start" moment. The player with the earliest effective start gets an inflated WPM and may finish before slower typists even see the countdown end. Core value ("fair, identical WPM") breaks visibly with two laptops side by side.

**Why it happens:**
Developers send a `START` message and trust each client to fire its first keystroke against `Date.now()` locally. Network RTT variance, browser timer jitter, and client clock skew (laptop vs laptop) compound. Worse: server emits the start tick at one wall-clock moment, but the packet arrives at clients at different times.

**How to avoid:**
- Server defines the authoritative race-start wall-clock `t0` at emit time and includes it in the start message.
- Each client computes its offset `serverNow - clientNow` via an NTP-style handshake at room-join (multiple round-trips, take median).
- Client holds the first keystroke until `t0 - clockOffset + countdown` and never types before that.
- Render a per-client "your start in X ms" indicator driven by synced clock, not local countdown.
- Use `performance.now()` for in-race timing, not `Date.now()` — monotonic and unaffected by clock corrections.

**Warning signs:**
- Two-test-laptop demo: cursor A crosses finish while cursor B is still 3-4 words behind, but WPM numbers look "too clean" (A's WPM inflated by ~10-15%).
- Logs show first-keystroke timestamps vary by >100ms across clients within the same race.
- Players in distant regions (high RTT) consistently report feeling "late" at countdown zero.

**Phase to address:**
Phase 2 (Race Engine + Clock Sync) — must be solved before any race can be considered fair. Do not punt to "polish."

---

### Pitfall 2: Race-condition between client-side countdown zero and server tick

**What goes wrong:**
Client's countdown hits zero and immediately enables the input field, but the server's `race:started` event hasn't propagated. A fast typist sends `keystroke` messages that the server rejects as "race not started," so their early progress is lost and their WPM shows as absurdly low. Or worse: server accepts early keystrokes against a stale race state from a previous room.

**Why it happens:**
Trusting client-side countdown animation as the gate. The countdown is cosmetic; the server tick is the truth. Without a strict protocol ("client may type only after receiving `race:start_ack` for this race-id"), typing races against network state.

**How to avoid:**
- Server emits `race:start` with `{raceId, serverStartTs, passageHash}`. Client waits for this frame before unlocking input.
- Client sends `race:ready` after `passageHash` matches what server sent — proves both sides agree on the text.
- Every keystroke message carries `{raceId, seq}` so server can reject out-of-order or pre-start frames deterministically.
- Server treats "first keystroke received before serverStartTs" as anti-cheat violation (clock abuse), not as success.

**Warning signs:**
- Replays show early typed characters rendered on screen but missing from server progress state.
- Test player reports "I typed the first word before countdown ended and got nothing for it."
- Server log shows keystroke messages with timestamps `< serverStartTs`.

**Phase to address:**
Phase 2 (Race Engine) — server is authoritative on start moment; client input gating piggybacks.

---

### Pitfall 3: WPM calculation off-by-one errors (chars/words/first-keystroke convention)

**What goes wrong:**
Different conventions produce wildly different WPM for the same race. Common variants:
- `wpm = charsTyped / 5 / minutesElapsed` vs `wordsCompleted / minutes`
- First keystroke timing: from race start, or from first key press? (Huge difference for short races.)
- Wrong characters counted: do backspaces-and-retries inflate "correct chars"? Do spaces count?

Two players type identical 50-word passages in 30s. Player A reads "62 WPM"; Player B reads "84 WPM" — same race, same effort.

**Why it happens:**
Copy-pasting WPM math from a stackoverflow answer or a typing-test site (monkeytype, typeracer) without checking which convention is used. Conflating "characters typed" with "characters correct." Not defining "word" (is "don't" one word or two? hyphenated?).

**How to avoid:**
- Pick ONE convention explicitly and document it in the spec.
- Recommended v1: standard typing-test WPM = `correctChars / 5 / (elapsedSeconds / 60)` where `correctChars` = correctly typed characters (backspaces don't count, errors don't count toward numerator but DO count toward denominator via elapsed time).
- Compute WPM on the server using the SAME formula for everyone — never let client compute and trust it.
- Raw WPM = `allChars / 5 / minutes` for tiebreakers and curiosity; Net WPM = standard above.
- Apply formula in unit tests with known fixtures ("30 chars in 30 seconds → 2 WPM net, 2 WPM raw").

**Warning signs:**
- Two players' WPMs differ by >15% in a race where one played cleanly and the other made many corrections.
- End-race board shows fractional WPMs that vary by tenths — convention drift.
- Tests pass with multiple "correct" answers for the same input.

**Phase to address:**
Phase 3 (Scoring & WPM) — explicit spec, unit-tested formula, server-only computation.

---

### Pitfall 4: Backspace handling breaks per-word correctness

**What goes wrong:**
Player types "th", realizes mistake, backspaces twice, types "the" correctly. But the server tracks character stream position-by-position and the final state is "the" — yet the engine counts "th" + 2 backspaces + "e" as adding incorrect intermediate chars to the wrong-word tally. Net result: accuracy dropped 5% for a player who ended with the right word.

Variant: cursor is at position 12 in the passage (typed 12 chars). Player backspaces 3 then types 3 — server must not count the original 3 as "errors" if they're now overwritten by the new 3.

**Why it happens:**
Modelling typing as a string-append log instead of a position-aware buffer. Or correctly tracking the buffer but recomputing correctness on each keypress without accounting for "was this character correct at any point?" vs "is the current character at position N correct?"

**How to avoid:**
- Per-character model: each passage position has a `state` enum — `pending | correct | error | corrected` (corrected = was wrong, backspaced, retyped correctly).
- Per-word correctness: a word is "correct" only if ALL its characters end in `correct` state at race end. Errors that were corrected before the player advanced past the word boundary still penalize the word but DO count toward "characters corrected" metric.
- Backspace does NOT delete history — it transitions `correct → pending` and clears forward characters within a word if the player is retyping.
- Race-end accuracy = `correctWords / wordsAttempted`, not character-level accuracy (which lies about effort).

**Warning signs:**
- Player reports "I corrected every error and my accuracy still dropped."
- Logs show `backspace` events processed but no state transition visible in score deltas.
- Two paths through same text produce different accuracy scores.

**Phase to address:**
Phase 3 (Scoring & WPM) — bundled with WPM fix; both depend on per-position character state.

---

### Pitfall 5: Reconnect mid-race corrupts opponent views / state divergence

**What goes wrong:**
Player B's wifi blips for 2 seconds. They auto-reconnect via the same code+link. Server treats them as new — issues a fresh `playerId`, resets their progress, AND broadcasts their "join" to the room. Other players see: cursor B disappears, a "B joined" toast, cursor B reappears at position 0. Confusion, potential race-end dispute ("I already typed half!").

Worse: if the server DOES try to restore state, but the client's last ack was for keystroke seq 47, and the server's authoritative count is at 52 (5 keystrokes lost in flight during the disconnect), the restored player types "into" a stale view.

**Why it happens:**
No concept of session resumption. Most WS apps are designed for short-lived connections; typing-race needs long-lived (30-60s race) stateful ones. Also: client treats reconnect as "new connection" and the server has no `resumeToken`.

**How to avoid:**
- Server issues a `sessionToken` at room-join (opaque, stored in memory keyed to player state).
- Reconnect sends `{roomCode, sessionToken}` — server restores player position, passage assignment, and pending ack window.
- Server buffers `keystroke` messages from reconnected client with `seq > lastAckedSeq` and processes them in order.
- Other clients see a single "B reconnected" toast, not a new join — broadcast `player:rejoin` event distinct from `player:join`.
- Race timer does NOT pause for individual reconnects (clock is global) — but the reconnected player gets a brief grace period (500ms) to catch up before their first keystroke is "counted."

**Warning signs:**
- Test: kill the wifi on player B mid-race, restore 3s later. Opponent A sees "B left, B joined" instead of "B reconnected."
- Player reports "I came back but my progress was gone" — state was reset on reconnect.
- Two players' final scores differ depending on whether either disconnected, even for identical effort.

**Phase to address:**
Phase 4 (Reconnect & Resilience) — explicit phase; touch every layer (server state, WS protocol, client store).

---

### Pitfall 6: Latency smoothing — opponent cursors jump/jitter instead of flowing

**What goes wrong:**
Opponent's cursor teleports 8 characters every 100ms instead of gliding smoothly. On the receiving end, watching the cursor is visually jarring; on slow networks it freezes for 300ms then jumps. Makes the "watch the race" demo fall flat.

**Why it happens:**
Naive render: position cursor at `serverState.position` on every message. No interpolation, no extrapolation, no dead-reckoning. High-frequency updates feel jerky because the client renders the latest snapshot with no in-between frames.

**How to avoid:**
- Client buffers cursor position samples with timestamps from server.
- Render position at `performance.now() - renderDelay` (e.g., 100ms behind real time), interpolating between the two surrounding samples.
- If no fresh sample in >200ms, extrapolate from velocity (last 2 samples' delta / deltaTime) and cap extrapolation at ~150ms.
- Server emits cursor updates throttled to 20-30 Hz max — don't fire on every keystroke.
- Use CSS `transform: translate3d()` for the cursor, not re-rendering React — DOM thrash kills smoothness.

**Warning signs:**
- Visual jitter even on localhost (no network involved).
- Cursor freezes 200ms+ on 3G/lossy connections.
- Frame rate drops below 60fps when 4+ opponents are in view.

**Phase to address:**
Phase 5 (Frontend Polish & Cursor Sync) — after scoring is locked; treat as UX polish tier.

---

### Pitfall 7: Server-authoritative anti-cheat that passes timing checks (best-effort gotchas)

**What goes wrong:**
A client modifies the JS bundle to send keystroke events with server-trusted timestamps from the future, or with impossibly consistent intervals (perfect 60 WPM with zero variance). The server "counts correct keystrokes" but trusts the client's `clientTs` field. Cheater wins every race.

Variant: client replays keystrokes for the entire passage at 200 WPM in 200ms after server says "go." Server can't tell from timings because it accepts fast play.

**Why it happens:**
Server stores `clientTs` in keystroke messages and uses it for WPM. Or server validates "is this keystroke plausible?" with naive thresholds (e.g., reject <50ms between keys) but doesn't validate against the race start moment or against the player's typing history.

**How it happens (root cause):**
Trust boundary drawn at the wrong layer — server trusts client-provided timestamps or doesn't validate keystroke ordering against its own authoritative race start. Plus: "best-effort" framing lulls developers into skipping even cheap checks.

**How to avoid:**
- Server timestamps every keystroke on receipt with its OWN clock — `clientTs` is metadata for lag compensation, never the source of truth for WPM.
- Reject keystrokes received before `serverStartTs + minLatencyGrace` (e.g., +50ms for legit network + clock drift).
- Validate inter-keystroke intervals: `> 20ms` between any two keys for a given player. Cheaters sending 5ms apart are obviously automated.
- Cap sustained WPM at a sane ceiling (e.g., 250 WPM) — anything above is rejected or flagged.
- Server knows the passage; reject keystrokes that don't match the expected next character.
- For v1 best-effort: these four checks (server-timestamped, pre-start reject, min-interval, char-match) defeat 95% of casual cheating without rate-limit/hash infra.

**Warning signs:**
- Test by modifying local client to send `clientTs: Date.now() + 5000` on every keystroke — server accepts and player "wins."
- Leaderboard shows one player with consistent 180+ WPM and zero errors across many races.
- Server log shows keystroke messages with timestamps outside any sane human-typing envelope.

**Phase to address:**
Phase 2 (Race Engine, server-authoritative core) + revisited in Phase 6 (Hardening pre-deploy).

---

### Pitfall 8: Race-end tied detection — same WPM, same finish time, who wins?

**What goes wrong:**
Two players finish the same passage within the same millisecond. Same correct-char count, same elapsed time → identical WPM. Server emits two winners, or zero winners, or picks one arbitrarily. Race-end board looks broken. Rematch flow gets "did I win?" disputes.

**Why it happens:**
Developer hardcodes "first to finish wins" but doesn't define what "first" means when both arrive simultaneously. Or uses `Date.now()` resolution that ties everything within 1ms (V8 has 1ms resolution by default but `performance.now()` has sub-ms).

**How to avoid:**
- Server-side race-end resolution order: (1) higher `correctChars` wins, (2) earlier `lastKeystrokeServerTs` wins, (3) earlier `joinTs` wins. Document this order in spec.
- Tiebreaker reported explicitly on the board: "Tied — A joined 2s earlier" so it's not mysterious.
- For real ties (rare), both players see "Tied" with no declared winner; rematch is the resolution.
- Use `performance.now()` server-side if available, or `process.hrtime.bigint()` in Bun — better resolution than `Date.now()` for sub-ms ties.
- Test: force a tie in CI by seeding two players with identical progress and identical last-keystroke ts.

**Warning signs:**
- Two-test-laptop demo ends with "Player A wins" but both clients saw themselves cross the finish at the same moment.
- Rematch button never appears after a tie because the server's "winner" logic crashed.
- Final board shows fractional ms differences (e.g., 12345.6789ms) — convention undeclared.

**Phase to address:**
Phase 3 (Scoring & WPM) — bundled with WPM definition; both need explicit tie rules.

---

### Pitfall 9: Memory leak from abandoned rooms (in-memory Map never pruned)

**What goes wrong:**
Players create rooms, share codes, then close the tab without ever joining. Or join and leave mid-race. Rooms sit in the in-memory `Map<roomCode, RoomState>` forever. After 24h of demo traffic, the server holds 10,000 empty room objects, each with closures over WS handlers, passage text, player arrays. Bun process RSS climbs past 500MB; eventually OOM on Fly.io's small VM.

**Why it happens:**
Developer focused on race happy-path, never wrote cleanup. WebSocket `close` handler doesn't always fire (browser crash, network drop, OS sleep). No periodic sweep.

**How to avoid:**
- Server tracks `lastActivityTs` per room; sweeper runs every 60s and removes rooms idle for >10min.
- WS connection `close` event triggers room-leave logic — if room is empty, schedule deletion in 60s.
- Heartbeat ping every 15s; if no pong within 5s, mark connection dead and clean up.
- Room creation throttled per-IP (e.g., 10 rooms/hour) to bound blast radius from a script kiddie.
- Log room count + heap size every 5min in production — alert on either climbing unexpectedly.

**Warning signs:**
- Heap usage grows linearly with traffic even when no races are running.
- `Map.size` on the rooms map is in the thousands while "live" rooms are in the dozens.
- Fly.io metrics show RSS climbing steadily with no plateau.

**Phase to address:**
Phase 4 (Reconnect & Resilience) — same phase covers the heartbeat + cleanup infra.

---

### Pitfall 10: Fly.io instance restart wipes all rooms (state-loss blast radius)

**What goes wrong:**
Fly.io free-tier machines get restarted for any of: deploy, region rebalance, autoscaler events, hardware maintenance. Every restart: every active room vanishes, every mid-race player gets disconnected, every cursor freezes. For a demo, this is the difference between "looks polished" and "looks broken."

**Why it happens:**
In-memory `Map` by design (PROJECT.md decision: "honest tradeoff — rooms vanish on restart. Acceptable for demo"). But developer never GRACEFULLY handles the disappearance — clients see "connection lost" with no message about why or what to do.

**How to avoid:**
- Client WS layer catches unexpected close codes (non-1000) and shows "Server restarted — room lost. Start a new race?" toast instead of infinite retry.
- On reconnect attempt, client gives up after 2 tries (5s total) rather than spinning.
- Optional v1: persist rooms to local SQLite/JSON file on graceful shutdown only (SIGTERM), reload on boot. Cheap insurance against deploys but not crashes.
- For demo robustness: deploy-time `fly deploy --strategy immediate` avoids the rolling-restart dance.
- Document the tradeoff publicly (README): "rooms live in-memory; restart = room gone. By design."

**Warning signs:**
- Demo video has a moment where the host says "wait, what?" after a deploy pushed during the recording.
- After every Fly.io maintenance event, support DMs about "rooms disappearing."
- Client retry storms after restarts hammer Fly.io's free-tier CPU allowance.

**Phase to address:**
Phase 6 (Deploy & Hardening) — finalize the in-memory tradeoff with graceful UX on top.

---

### Pitfall 11: Bun + WS production gotchas vs Node (path quirks, feature gaps)

**What goes wrong:**
Code works locally with `bun run dev` but breaks on Fly.io with Node-runtime or `bun run start` in production mode. Symptoms:
- `WebSocket` global exists in Bun but `ws` package needed in Node.
- Bun's `Bun.serve()` WS upgrade differs from Node `http.createServer()` + `ws.Server`.
- Bun's hot-reload replaces modules; WS handler closures capture stale state across reloads.
- `node:` protocol imports (`import { randomUUID } from 'node:crypto'`) work in Bun but bundlers trip on them.
- Bun's TypeScript transpilation differs from `tsc` — some decorators / enums behave differently.

**Why it happens:**
"Works on my machine" + Bun still evolving APIs. Developers test only locally and ship without verifying production runtime.

**How to avoid:**
- Pick one runtime for prod and stick to it: Hono `serve({...})` works in both, but choose Bun for prod (PROJECT.md decision) and don't fall back to Node at deploy time.
- Test the production bundle locally: `bun build` then `bun run dist/index.js` against a Fly.io-shaped env (PORT env var, single process).
- Use the `bun:` prefix for Bun-native APIs (Bun.serve, Bun.file) but avoid `node:` prefix in shared code.
- Treat WS upgrade as the Bun-native `Bun.serve({ websocket: { ... } })` pattern, not the Node `ws` library — they're API-incompatible.
- Fly.io `fly.toml`: `entrypoint = ["bun", "run", "src/index.ts"]` with Bun's official image, not a Node image with Bun installed ad-hoc.
- CI step: `bun run start` against a temp port, hit `/healthz` over WS, verify upgrade succeeds — before every deploy.

**Warning signs:**
- `package.json` has both `bun` and `node` engines, suggesting runtime ambiguity.
- Production crashes with `WebSocket is not defined` (Node-style global missing).
- Hono `createBunWebSocket()` adapter not wired correctly — connections drop silently.

**Phase to address:**
Phase 6 (Deploy & Hardening) — concrete runtime pick + Fly.io image baked into CI.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Compute WPM on client, send to server | Simpler server, no score-sync logic | Trivially cheatable; client-side `wpm = 999` wins every race | Never — server-authoritative is the whole point |
| No `sessionToken` for reconnect — just reopen WS | Faster to ship phase 4 | Mid-race disconnects = full state loss, "feels broken" demo | MVP demo only if you accept worst-case UX |
| Hard-code "first finisher wins" | Avoids tie logic | Tie race = weird board, disputes | Only if you intentionally cap races at 1 player each (contradicts spec) |
| Store rooms in JSON files (fs.writeFileSync) per-room | "Persistence" without Redis | Slow at scale, corrupts on crash, IO stalls event loop | Never — use SQLite if you need persistence |
| Reuse one global `WebSocket` per page | One connection per client | No reconnect logic, no multiplexing for v2 | MVP, if scope locked to single-tab |
| Skip heartbeat pings | Less code, fewer msgs | Zombie connections never cleaned, leaks build up | Never — 5 lines of code, huge reliability win |
| Trust `Date.now()` from client for race timing | Matches human intuition | Drift, clock skew, ties | Never — `performance.now()` monotonic, server-timestamped |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Fly.io free tier | Assume cold-start = 0ms; first request takes 1-3s on free tier | Accept the latency; show "connecting..." early; warm-up ping if budget allows |
| Fly.io deployment | Use `--strategy rolling` for zero-downtime | Acceptable for chat, BAD for racing (state-loss mid-race). Use `immediate` strategy |
| Bun WebSocket upgrade | Forget `Bun.serve({ websocket: { open, message, close }})` handlers | Define all three; missing `close` = leaked room state |
| Hono routing + WS | Mix Hono HTTP routes and WS upgrade on same server; path collisions | Use distinct paths: `/ws` for WS, `/` for static, `/healthz` for checks |
| Shared TS types package | Symlink, relative imports, no build step | Build with `tsc` to `dist/` once, both sides import compiled `.d.ts` + `.js` |
| Browser WebSocket | Assume reconnect automatic | Manual reconnect logic with backoff; max 2 attempts; show "lost" UI on failure |
| Vite dev proxy | Forget to proxy `/ws` to backend in `vite.config.ts` | Add `server.proxy['/ws'] = 'ws://localhost:8787'` or WS hangs in dev |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Broadcast every keystroke to room | CPU spikes per race; >2 players = laggy | Throttle cursor updates to 20-30 Hz; aggregate keystrokes into position updates | 4+ players in room with fast typists |
| JSON.parse every WS message | GC pressure, frame drops at high rate | Use `Bun.write`/native WS binary frames or pre-validate schema once | 100+ msgs/sec/player |
| Render React on every cursor sample | 60fps→15fps with 4 cursors | Move cursor rendering to direct DOM `transform` updates outside React tree | 4+ opponents, fast typists |
| Heartbeat at 1s interval | Wasted bandwidth | 15s ping, 5s pong timeout is plenty | Any room count |
| In-memory Map with no sweep | RSS grows over hours | 60s sweeper removes idle rooms | ~500 rooms/day traffic on Fly.io free tier |
| `Date.now()` in tight loops (1k+/sec) | Measurable CPU | `performance.now()` for diffs, `Date.now()` only at race boundaries | Always — Date.now() is 10x slower in V8 |
| Passage corpus inlined as 1MB TS file | Bundle bloat, slow startup | JSON side-import or fetched on first race | Only matters if corpus grows past ~500 passages |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Trusting client-supplied `playerId` in WS messages | Impersonation, spoofed cursors, fake wins | Server assigns opaque `playerId` at join; client never picks |
| No origin check on WS upgrade | Cross-site WebSocket hijacking (CSWSH) — attacker site opens WS to your server with victim's cookies | Check `Origin` header in upgrade handler against allowlist; reject mismatches |
| Room codes not collision-checked | Two rooms with same code = player joins wrong lobby | Generate from crypto-random, retry on collision; reject codes with <1M combinations of entropy |
| Passage text sent only to host | Other players get passage via `passageHash` only → can't render | Send full passage to every client on `race:start`; hash is for tamper-detection, not concealment |
| Passage text mutable post-start | Mid-race, host swaps in easier text | Server freezes passage at `race:start`; client gets hash, server keeps authoritative copy |
| WPM ceiling too generous (>500) | Cheater sets `wpm = 9999`; server caps but doesn't reject | Cap AND log; flag accounts/IPs (when accounts exist) — for v1 best-effort, just cap |
| No rate limit on room creation | Attacker floods `Map` with 10k empty rooms | Per-IP throttle: 10 rooms/hour, 100 rooms/day |
| Logging full keystroke streams to disk | PII leak, GDPR exposure | Log aggregate stats only: progress %, keystroke count, race duration. Never per-key. |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Race-start countdown shows local clock | Player A's "3, 2, 1" finishes 300ms before player B's | Use server-synced clock; render same countdown to all |
| Input field unfocuses on every render | Player typing gets yanked mid-word; infuriating | `useRef` for input; never re-render the input itself during race |
| Cursor color clashes with theme / each other | Hard to tell cursors apart with 6 players | High-contrast palette + small player initials; WCAG-check |
| "Rematch" starts immediately on click | Race-failed player can't catch breath | 2s "Starting in..." pause; visible to all |
| Disconnect = instant "you lost" | No recovery attempt visible | 5s reconnect window with progress bar; then graceful "race forfeited" |
| WPM shown as fractional (62.347) | Looks imprecise, hampers comparison | Round to nearest integer; show raw + net separately |
| End-race board shows rank but no time delta | "I lost" without context | Show time gap to winner: "Finished 0.4s behind" |
| Mobile: keyboard covers half the screen | Race unplayable on phone | For v1 desktop-first, but show "best on desktop" hint if narrow viewport |
| No "ready" state visible in lobby | Host doesn't know if everyone can start | Per-player "ready" indicator; host can start when all ready OR countdown begins |
| Server restart → silent disconnect | Player doesn't know if their internet dropped or server died | Distinct error codes/messages: "Lost connection" vs "Server unavailable, please retry" |

## "Looks Done But Isn't" Checklist

- [ ] **Race start:** Often missing per-client clock-sync verification — verify both clients emit `race:start_ack` with matching `serverStartTs` within ±50ms tolerance
- [ ] **WPM scoring:** Often missing tests for backspace-then-retype scenarios — verify a player who types "t", backspaces, types "h" gets correct char count for "th"
- [ ] **Reconnect:** Often missing the "sessionToken restored server-side player state" path — verify a reconnecting player sees their own cursor continue, not restart at 0
- [ ] **Anti-cheat:** Often missing server-side timestamp enforcement — verify sending `clientTs = Date.now() + 60000` does NOT inflate WPM
- [ ] **Cursor sync:** Often missing extrapolation when sample stream gaps — verify cursor continues smoothly for 300ms after last sample, then snaps to latest
- [ ] **Room cleanup:** Often missing the "host closed tab, never sent close frame" path — verify a force-killed browser tab causes the room to be GC'd within 10min
- [ ] **Fly.io deploy:** Often missing graceful-shutdown handler — verify SIGTERM during a race results in players seeing "race lost" toast, not silent disconnect
- [ ] **Tie detection:** Often missing tests for simultaneous finish — verify two players with identical last-keystroke ts both see "Tied"
- [ ] **Passage integrity:** Often missing server-authoritative passage text — verify client cannot influence passage selection mid-race
- [ ] **Heartbeat:** Often missing pong-timeout logic — verify a zombie connection (TCP open but client dead) is cleaned within 30s

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Clock sync drift detected post-deploy | MEDIUM | Roll back; add `clockOffset` log metric; investigate NTP-style handshake quality per region; ship NTP-sync patch |
| WPM convention dispute | LOW | Pick convention, update unit tests, update UI label, document in README. Formula change is cosmetic |
| Reconnect state corruption | HIGH | Players see bad scores; need to invalidate affected races; ship sessionToken patch + force-disconnect all active races |
| Anti-cheat bypass discovered | MEDIUM | Add server-timestamp + min-interval check; invalidate affected race results; announce on README "cheating fix shipped" |
| Memory leak (10k rooms) | HIGH | Restart clears state; ship sweeper; post-mortem on how many users were affected; alert on heap metric |
| Fly.io restart wipes rooms mid-demo | LOW (demo) | Client shows graceful error; user creates new room. For repeat demos, schedule deploys outside demo windows |
| Bun runtime API drift (version bump) | MEDIUM | Pin Bun version in `package.json` + Dockerfile; CI runs against pinned version; upgrade deliberately |
| Tie in race-end board | LOW | Show "Tied" with explicit tiebreaker; rematch is the resolution; no data loss |

## Pitfall-to-Phase Mapping

(Phases inferred from PROJECT.md "Hard parts" + typical realtime-game roadmap; adjust when ROADMAP.md is created.)

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Clock sync drift | Phase 2 — Race Engine + Clock Sync | Two-laptop test: both see same WPM for identical effort; first-keystroke ts within ±50ms |
| Race-start race condition | Phase 2 — Race Engine | Integration test: client A types immediately on countdown zero, server rejects keystrokes before `race:start` ack |
| WPM off-by-one | Phase 3 — Scoring & WPM | Unit tests: 30 chars in 30s → 2 WPM; backspace-then-retype doesn't inflate numerator |
| Backspace correctness | Phase 3 — Scoring & WPM | Unit tests: type "th", backspace 2, type "the" → word marked correct, accuracy 100% |
| Reconnect state corruption | Phase 4 — Reconnect & Resilience | Mid-race wifi kill + restore: reconnected player continues, opponent sees "B reconnected" not "B joined" |
| Cursor jitter | Phase 5 — Frontend Polish | 60fps maintained with 4 cursors on screen; cursor glides smoothly across 200ms sample gaps |
| Anti-cheat bypass | Phase 2 (core) + Phase 6 (hardening) | Modified client with `clientTs + 60s` server-side: WPM reflects real elapsed time, not spoofed |
| Race-end ties | Phase 3 — Scoring & WPM | Two players finish same ms: board shows "Tied" with documented tiebreaker, no crash |
| Memory leak from rooms | Phase 4 — Reconnect & Resilience | Load test: 1000 rooms created over 1h, sweeper holds active count <50 |
| Fly.io restart wipes rooms | Phase 6 — Deploy & Hardening | Force-kill the Fly.io machine mid-race: clients see graceful error toast, no infinite retry storm |
| Bun runtime drift | Phase 6 — Deploy & Hardening | CI: `bun run start` against pinned version; Fly.io image uses `oven/bun` not generic node |

## Sources

- PROJECT.md / spec.md — greenfield realtime typing-race; constraints: Vite+React+TS frontend, Bun+Hono backend, Fly.io single-process deploy, in-memory room Map, 2-8 players, 30-60s races, English-only passages.
- WebSocket game-dev community knowledge: NTP-style clock sync for browser clients, dead-reckoning / extrapolation for remote entities, interpolation buffer for rendering remote state.
- typing-test WPM convention (monkeytype / typeracer): `correctChars / 5 / minutes`. Note: conventions vary; explicit pick matters.
- Bun + Hono WebSocket patterns: `Bun.serve({ websocket: {...} })` with native handlers; Hono `createBunWebSocket()` adapter.
- Fly.io free tier behavior: machines restart on deploy / autoscaler / hardware events; `fly deploy --strategy` controls rolling vs immediate.
- Realtime game-engine pitfalls literature: "1500 Archers on a 28.8" (Gaffer on Games — lag compensation), Gabriel Gambetta's client-side prediction / entity interpolation articles.
- Confidence: HIGH for the established realtime/WS class pitfalls (clock sync, latency smoothing, reconnect, anti-cheat boundary); MEDIUM for the Bun+Fly.io specifics because Bun's prod-track APIs and Fly.io's free-tier behavior evolve — pin versions, verify in CI.

---
*Pitfalls research for: realtime multiplayer typing-race game (greenfield, Bun+Hono+React+Fly.io)*
*Researched: 2026-08-30*