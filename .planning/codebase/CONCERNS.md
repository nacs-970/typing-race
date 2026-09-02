# Codebase Concerns

**Analysis Date:** 2026-09-02

## Tech Debt

**Styling Architecture:**
- Issue: Monolithic plain CSS file in `apps/web/src/index.css` without CSS modules or utility classes.
- Files: `apps/web/src/index.css`, `apps/web/src/App.tsx`
- Impact: Difficult to maintain themes, dark mode, or responsive component styling as the UI grows.
- Fix approach: Phase 5 is scheduled for frontend polish and design system alignment (e.g., Tailwind CSS v4 or structured CSS variables).

**Global Module WebSocket Singleton:**
- Issue: `ws` singleton in `apps/web/src/net/ws.ts` automatically initiates connection on module import.
- Files: `apps/web/src/net/ws.ts`
- Impact: Testing components in isolation requires careful environment mocking or suppressing WebSocket errors in JSDOM / Happy DOM environments.
- Fix approach: Encapsulate WebSocket lifecycle in a React Context provider or factory function.

**Ephemeral Memory-Only Persistence:**
- Issue: All room and player states are stored in process memory (`Map<string, Room>`).
- Files: `apps/server/src/rooms/manager.ts`
- Impact: Any server deployment or crash clears all active games. System cannot scale horizontally across multiple instances without a distributed pub/sub layer.
- Fix approach: Future milestone (v2) could introduce a Redis state backend or persistent room storage.

## Known Bugs & Trade-Offs

**Unbounded Room Accumulation on Inactive Sockets:**
- Symptoms: Rooms could remain in memory indefinitely if players stay connected without racing.
- Files: `apps/server/src/rooms/manager.ts`
- Trigger: Host creates a room and leaves browser open indefinitely.
- Workaround/Rationale: Explicitly excluded an aggressive idle timeout per user requirement (D-04 in Phase 4 context). Sockets are monitored by 15s heartbeat; rooms delete when all players disconnect and 60s grace expires.

## Fragile Areas

**Rapid Backspacing on High-Latency Connections:**
- Files: `apps/web/src/components/RaceView.tsx`, `apps/server/src/ws/dispatch.ts`
- Risk: Rapidly pressing backspace sends `correction` frames. If network roundtrip latency is high, the server's echoed authoritative index might arrive after the user has resumed typing forward, causing brief cursor jitter.
- Mitigation: Server strictly validates monotonic character indices and echoes cursor updates only on backspace decrement.

**Clock Sync Accuracy under Network Spikes:**
- Files: `apps/web/src/net/clock.ts`, `apps/server/src/routes.ts`
- Risk: If network jitter or bufferbloat causes asymmetric HTTP latency during the 2-phase NTP sync, client clock offset can be off by several tens of milliseconds.
- Mitigation: `syncClock` performs multiple roundtrip attempts, rejects measurements taking longer than 500ms, and calculates roundtrip half-latencies.

## Security Considerations

**Denial-of-Service via Room Flooding:**
- Mitigation in place: `IpRateLimiter` enforces a hard limit of 10 room creations per hour per client IP (`apps/server/src/rooms/manager.ts`).
- Mitigation in place: Bun WebSocket configuration enforces `maxPayloadLength: 16 * 1024` and `backpressureLimit: 1024 * 1024`.

**Automated Keystroke Injection (Cheating):**
- Mitigation in place: Server enforces four-tier verification on every keystroke (`apps/server/src/race/validate-keystroke.ts`):
  1. Pre-race start gate rejection.
  2. 500ms post-reconnect burst guard.
  3. 20ms minimum interval guard (max 50 keystrokes/sec).
  4. Character match validation against the server-held passage text.

---

*Concerns audit: 2026-09-02*
