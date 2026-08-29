# Feature Research

**Domain:** Realtime multiplayer typing-race games (typing test apps + casual multiplayer)
**Researched:** 2026-08-30
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Create room with short shareable code/link | Every typing-race competitor (TypeRacer, Nitro Type, Typeracer Turbo) uses this. Without it, no way to play with a friend. | LOW | 6-char alphanumeric + shareable URL. Already in PROJECT.md. |
| Lobby (player list, ready state) | Players need to see who joined before race starts. Nitro Type + TypeRacer both show lobby. | LOW | Render `players[]` from server state. Host gets "Start" button when ≥2. |
| Synchronized countdown → race start | Universal across racing games. Even a 2-client demo needs both players typing on the same tick. | MEDIUM | Server emits `race_start` with `t0` epoch ms + clock-sync offset. Already in PROJECT.md. |
| Live opponent cursors on track | PROJECT.md Core Value — "two connected clients see each other's cursor in real time." The "demo wow" moment. | HIGH | Broadcast cursor position (word index, char index) every keystroke; interpolate client-side for smoothness. Core differentiator technically, but table-stakes for the genre. |
| WPM + accuracy display per player | TypeRacer made this the default metric in 2009. Everyone expects a number at the end. | LOW | Compute as `(correctChars / 5) / minutes`. Already in PROJECT.md. |
| Per-word correctness + backspace | Every modern typing app supports it. Without backspace, race is unfair on typos. | MEDIUM | Word correctness stored on server; backspace reverses cursor + decrements counter. Already in PROJECT.md. |
| Race-end results board (ranked) | All competitors show ranked results. Finish time then WPM is the standard tiebreak. | LOW | Already in PROJECT.md. |
| Rematch button (same room, new passage) | TypeRacer, Nitro Type all offer "race again" — keeps the social loop tight. | LOW | Reuses room, server picks new passage from corpus. Already in PROJECT.md. |
| Connection-loss recovery (rejoin same room) | WebSocket games that don't handle disconnects feel broken. PROJECT.md calls reconnect out specifically. | MEDIUM | Server holds race state for ~60s grace period; client sends `rejoin` with session token. Already in PROJECT.md. |
| Server-authoritative keystroke counting | Required for any fair multiplayer race. Without it, cheating is trivial. | HIGH | Server validates each keystroke against passage + elapsed time. Already in PROJECT.md. |
| Bundled passage corpus (~50-100 short) | Avoids runtime dep on external API; instant load; works offline. | LOW | Already in PROJECT.md. JSON file in shared types package. |
| Passable mobile / responsive UI | Most users on Discord share links from phones. Doesn't need to be great, but should not crash. | LOW | Tailwind breakpoints, viewport meta. Note: PROJECT.md says desktop-first. |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Visible opponent cursor on same track view | The "two-laptop demo wow" — players literally see each other's car/type position in realtime. TypeRacer shows it as ghost text, Nitro Type as cars on a track. Most polished impls frame this as the central UI. | HIGH | Already a hard part per PROJECT.md. Cursor interpolation at 60fps. |
| Best-effort anti-cheat (impossible-timing rejection) | Differentiates from TypeRacer-style client-trust models. Even at best-effort, blocks the lazy script kiddies. | MEDIUM | Reject keystrokes that imply superhuman WPM or negative time. Already in PROJECT.md. |
| Sub-100ms cursor sync latency | The measurable claim in PROJECT.md resume bullet. Visible differentiator in side-by-side demo. | HIGH | WebSocket, no batching, interpolated client-side. Bun/Hono native WS helps. |
| Zero-friction entry (no signup, single click) | Anonymous room = join in <10s. Every account-gated competitor (Nitro Type) loses on impulse share-links. | LOW | Already a Core Value constraint. |
| 6-char code + shareable link (both paths) | Verbal share (code) + click share (link). Most competitors pick one. | LOW | Already in PROJECT.md. |
| Clean minimal UI with smooth caret | Monkeytype proved the "minimal + customizable" niche. Even without theming, smooth caret + tasteful colors land well. | LOW | Caret CSS animation; few colors. |
| Clock-sync handled server-side | "Both clients start on same server tick" is the technical differentiator vs naive implementations. Mentionable in interview. | MEDIUM | Already in PROJECT.md. Server broadcasts `t0`; client adjusts for local clock skew. |
| Race-end replayable in single room (rematch chain) | Keeps a friend group in one URL for 30 min vs bouncing between rooms. | LOW | Already in PROJECT.md (rematch). |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| User accounts / login | "Save my stats," "let me track progress" | Adds OAuth/JWT, password resets, profile pages, PII handling. PROJECT.md explicit Out-of-Scope. Defeats zero-friction value prop. | Session tokens per room only; no global identity. Stats live in race, vanish on disconnect (already chosen). |
| Persistent global leaderboard | "Who's the fastest typist?" | Needs accounts first. DB schema, write contention, moderation (cheaters, slurs in names). Massive scope creep. PROJECT.md Out-of-Scope. | Per-room leaderboard shown at race end. Disappears with room. |
| In-game chat (text/emoji/voice) | "Talk to opponent during race" | Moderation, abuse vectors, latency, UI clutter, distraction during typing. Chat during race actively hurts Core Value (focus on typing). | Race-end reaction emoji (v2). Or: use Discord alongside (which is how friends already share the link). |
| Skins / themes / car customization store | "Make it mine" | Adds asset pipeline, theming system, payment (Nitro Type sells cars). Project is 2-weekend resume demo, not a freemium product. PROJECT.md Out-of-Scope. | Default tasteful theme only. v2 polish: 2-3 themes. |
| Achievements / badges / XP | "Gamification!" | Needs accounts. Per-player persistence. Distracts from "race your friend" core. | Pure race outcomes (WPM/accuracy rank). No meta-game. |
| Ghost replay (previous run overlay) | "Race against myself" | Cool but speculative. Needs race recording + storage + playback timeline. PROJECT.md v2 polish. | Skip until PMF proven. |
| Spectator mode (post-race, watch others) | "Let me watch pros" | PROJECT.md explicit Out-of-Scope. UI plumbing for non-players, disconnect handling for spectators, latency. | Lobby closes after rematch dismissed. |
| Multiple passage languages | "Type in my language" | Corpus maintenance, RTL/bidi, font loading per script. PROJECT.md English-only. | English-only in v1. |
| Mobile-first UI / on-screen keyboard | "I wanna play on phone" | On-screen keyboard ≠ real typing — breaks fair race. Mobile UX multiplies layout work 3x. PROJECT.md desktop-first. | Desktop-first. Mobile acceptable but unoptimized. |
| Real-time power-ups / items mid-race | "Nitro boost on perfect word" | Dilutes skill signal. WPM stops measuring typing ability. Fun for kids, bad for resume credibility. | Pure skill-based race. |
| >8 players per room | "Why limit?" | UI/scroll breaks; race gets chaotic; WS broadcast cost grows. PROJECT.md hard cap 2-8. | Cap at 8. New room for more. |
| Persistent room history / replays | "Let me rewatch my race" | Storage cost, retention policy, GDPR. Out of scope. | Rooms evaporate. |
| Custom passages by user | "I want to race with my own text" | Moderation, XSS in passage content, server-side sanitization, abuse vector. | Bundled public-domain corpus only. |
| Notifications / friend invites / matchmaking | "Find opponents for me" | Needs accounts + matching algorithm + notification infra. PROJECT.md scopes this to share-link. | Share link with friends manually. |

## Feature Dependencies

```
Race Track View (the typing surface)
    └──requires──> Server-authoritative keystroke counting
                       └──requires──> Synchronized race start (server tick t0)
                                          └──requires──> Lobby (host start button)

Live Opponent Cursors
    └──requires──> Race Track View
                       └──enhances──> Sub-100ms cursor sync latency

Reconnect mid-race
    └──requires──> Lobby (still bound to room code)
    └──enhances──> Server-authoritative keystroke counting (state preserved on server)

Per-word correctness + backspace
    └──requires──> Race Track View
    └──conflicts──> Confidence mode / no-backspace (orthogonal; not in v1)

Race-end Results Board
    └──requires──> Per-word correctness + backspace (accurate WPM source)

Rematch
    └──requires──> Race-end Results Board (UI entry point)
    └──requires──> Bundled passage corpus (need new passage)

Bundled passage corpus
    └──conflicts──> Custom user-uploaded passages (anti-feature)

Server-authoritative keystroke counting
    └──conflicts──> Client-trust model (TypeRacer legacy approach)
```

### Dependency Notes

- **Race Track View requires Server-authoritative keystroke counting:** Without server validation, opponent cursor positions + WPM scores become client-fabricated. Trust starts on server.
- **Server-authoritative keystroke counting requires Synchronized race start:** Both clients must share a `t0` reference; otherwise "elapsed time" differs between players and server-rejected timings look inconsistent.
- **Synchronized race start requires Lobby:** Host needs a UI surface to trigger it; countdown can't start without ≥2 players confirmed.
- **Live Opponent Cursors enhances Race Track View:** Cursors are the visible layer on top of the typing surface. Without the surface, no cursor to render.
- **Reconnect mid-race enhances Server-authoritative state:** State lives on server, so reconnect just re-establishes the WS and resumes the same race — no client persistence needed.
- **Bundled passage corpus conflicts with Custom user-uploaded passages:** Allowing uploads breaks the "fairness guarantee" (server trusts passage content) and adds moderation cost. Pick one.

## MVP Definition

### Launch With (v1)

- [ ] Create room with 6-char code + shareable join link — no lobby, no race without this
- [ ] Lobby with player list + host "Start" button — gated countdown trigger
- [ ] Synchronized countdown + race start on server tick — fair start for both players
- [ ] Race track with per-word correctness + backspace — the typing surface itself
- [ ] Live opponent cursor on track (interpolated) — Core Value, the demo moment
- [ ] Server-authoritative keystroke counting + best-effort anti-cheat — fair WPM
- [ ] Race-end results board (ranked by finish time then WPM) — shows who won
- [ ] Rematch button (same room, new passage from bundled corpus) — replay loop
- [ ] Reconnect mid-race without state corruption — robustness baseline
- [ ] Bundled passage corpus (~50-100 short English passages) — content source
- [ ] Fly.io single-process deploy (Bun serves frontend + WS) — public URL for resume

### Add After Validation (v1.x)

- [ ] Smooth caret animation — when polish matters and basic caret looks plain
- [ ] 2-3 themes / dark mode toggle — when feedback says "make it mine"
- [ ] Live WPM/accuracy readout during race (not just at end) — when players ask "how am I doing?"
- [ ] Reaction emoji on race-end (no chat, just 3-4 emoji buttons) — when "I want to trash-talk" emerges
- [ ] Sound effects (keystroke / countdown / finish) — when demo needs more punch
- [ ] Keyboard layout indicator / minor customization — when i18n-adjacent feedback appears

### Future Consideration (v2+)

- [ ] User accounts (opt-in, no migration pressure) — when product needs persistence
- [ ] Persistent personal stats / history per account — when retention matters
- [ ] Global leaderboard with moderation — when scale creates cheaters
- [ ] Ghost replay (overlay your previous run) — when single-player practice mode requested
- [ ] Shareable result image (auto-generated WPM card) — when marketing loop matters
- [ ] Custom themes / skins — when storefront becomes relevant (probably never for this scope)
- [ ] Multiple passage languages — when non-English audience emerges
- [ ] Spectator mode (post-race, watch lobby) — when tournament format requested
- [ ] Friend lists + matchmaking (auto-find opponent) — when solo queue matters
- [ ] Voice chat in lobby — when reaction-emoji proves insufficient

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Room code + share link | HIGH | LOW | P1 |
| Lobby + host start | HIGH | LOW | P1 |
| Synchronized race start | HIGH | MEDIUM | P1 |
| Race track + backspace | HIGH | MEDIUM | P1 |
| Live opponent cursors (interpolated) | HIGH | HIGH | P1 |
| Server-authoritative keystroke counting | HIGH | HIGH | P1 |
| Race-end results board | HIGH | LOW | P1 |
| Rematch | HIGH | LOW | P1 |
| Reconnect mid-race | MEDIUM | MEDIUM | P1 |
| Bundled passage corpus | HIGH | LOW | P1 |
| Fly.io single-process deploy | HIGH | LOW | P1 |
| Best-effort anti-cheat | MEDIUM | MEDIUM | P1 |
| Live WPM/accuracy during race | MEDIUM | LOW | P2 |
| Smooth caret animation | LOW | LOW | P2 |
| 2-3 themes | LOW | LOW | P2 |
| Sound effects | LOW | LOW | P2 |
| Reaction emoji on race-end | MEDIUM | LOW | P2 |
| Keyboard layout indicator | LOW | LOW | P3 |
| User accounts | LOW (for this scope) | HIGH | P3 |
| Persistent stats per user | LOW | HIGH | P3 |
| Global leaderboard | LOW | HIGH | P3 |
| Ghost replay | LOW | HIGH | P3 |
| Shareable result image | LOW | MEDIUM | P3 |
| In-game chat | LOW (anti-feature) | HIGH | P3 (avoid) |
| Skins/themes store | LOW (anti-feature) | HIGH | P3 (avoid) |
| Achievements / XP | LOW (anti-feature) | HIGH | P3 (avoid) |
| Spectator mode | LOW | HIGH | P3 |
| Multiple languages | LOW | HIGH | P3 |
| Custom user-uploaded passages | LOW (anti-feature) | HIGH | P3 (avoid) |
| Mobile-first UI | LOW | HIGH | P3 |
| >8 players per room | LOW (anti-feature) | MEDIUM | P3 (avoid) |
| Power-ups / items | LOW (anti-feature) | MEDIUM | P3 (avoid) |
| Friend lists + matchmaking | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration / anti-feature to actively avoid

## Competitor Feature Analysis

| Feature | TypeRacer | Nitro Type | Monkeytype | Our Approach |
|---------|-----------|------------|------------|--------------|
| Accounts required | Optional (saves stats) | Required | Optional | No accounts at all |
| Room code / share link | Yes (private rooms) + public queue | Yes (private + public rooms) | No (single-player) | Yes, both paths |
| Lobby + ready state | Yes (host starts) | Yes (host starts) | N/A | Yes, host starts |
| Synchronized race start | Yes (server tick) | Yes | N/A | Yes (clock-sync on t0) |
| Live opponent cursors | As ghost text (current word position) | As car position on track | N/A | As cursor on typing track (interpolated) |
| WPM + accuracy display | Per-race + per-race history | Per-race + career stats | Per-test + history | Per-race (vanishes with room) |
| Per-word correctness + backspace | Yes | Yes | Yes | Yes |
| Server-authoritative scoring | No (client-side) | No (client-side) | Yes (single-player, but trusted) | Yes (server validates each keystroke) |
| Best-effort anti-cheat | Minimal | Minimal | N/A (single-player) | Yes (reject impossible timings) |
| Rematch / race again | Yes (same room) | Yes (same room) | N/A | Yes (same room, new passage) |
| Reconnect mid-race | Partial (drops race on disconnect) | Partial | N/A | Yes (preserves state) |
| Passage corpus | Famous quotes (large library) | Curated game-themed | Random English words + quotes | Bundled public-domain corpus (~50-100) |
| Bundled offline | No (fetches) | No | Yes | Yes (no runtime dep) |
| Themes / customization | Few | Car skins (paid store) | Many (community themes) | 0 (v1), 2-3 (v2) |
| Chat during race | Yes (text) | Yes (text) | N/A | No (anti-feature) |
| Persistent leaderboard | Yes (global) | Yes (global) | Yes (personal) | No (per-room only) |
| Achievements / XP | No | Yes (car unlocks) | Yes (badges) | No |
| Mobile optimized | Poor | Yes | Yes | Desktop-first, mobile-acceptable |
| >8 players per room | Yes (10+ per public race) | Yes (up to ~1000 in big races) | N/A | Hard cap 8 |
| Voice chat | No | No | No | No |
| Spectator mode | No | Yes | No | No |

## Sources

- **Competitor products analyzed:**
  - TypeRacer (typeracer.com) — multiplayer typing race, the OG. Public quote library, ghost cursors, global leaderboard, account-optional.
  - Nitro Type (nitrotype.com) — gamified multiplayer typing race. Cars, teams, achievements, paid skins store, account-required.
  - Monkeytype (monkeytype.com) — single-player typing test. Minimal UI, themes, account-optional for stats. Source for typing-test UX conventions (smooth caret, live WPM, confidence mode, difficulty modes, language modes).
  - Typeracer Turbo (kidztype.com / Steam) — kid-friendly 4-player multiplayer, lobby + countdown.
  - Keybr (keybr.com) — single-player practice. Adaptive lessons, no multiplayer.
- **User research / feedback sources:**
  - PROJECT.md Out-of-Scope section — explicit non-goals from project owner
  - spec.md "Scope cut" — v1/v2 split already made
  - PROJECT.md "Hard parts" — anchor list of what must work
- **Industry standards referenced:**
  - WebSocket multiplayer game patterns: server-authoritative state, client interpolation, reconnect tokens
  - WPM formula: `(correctChars / 5) / minutes` — universal across typing apps
  - Race start sync: `t0` epoch ms + clock offset — standard pattern for racing games
  - Public-domain passage corpus: Project Gutenberg, classic literature — already noted in PROJECT.md

---

*Feature research for: realtime multiplayer typing-race games (typing test apps + casual multiplayer)*
*Researched: 2026-08-30*