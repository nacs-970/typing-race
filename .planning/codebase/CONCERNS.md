# Codebase Concerns and Risks

**Analysis Date:** 2026-09-21  
**Project:** `typing-race`  
**Assessment:** Production-ready for single-instance / demo deployments; key architectural limits exist around memory-backed state persistence, horizontal Engine scaling, and uncommitted working tree changes.

---

## 1. Active Working Tree State

### Uncommitted Working Changes
- **Files Modified:**
  - `apps/web/src/core/typing-engine.ts`
  - `apps/web/src/__tests__/typing-engine.test.ts`
- **Context:** Introduces `isCharDeletable()` logic (corrected-word delete prevention). Once a complete word is typed without errors, backspace cannot rewind into it; incomplete words or words with errors remain editable.
- **Risk:** These files are unstaged in the local git repository. Any branch switch or pull without staging/committing could risk losing this feature implementation.

---

## 2. Technical Debt and Architectural Limitations

### Ephemeral In-Memory State Storage
- **Location:** [apps/engine/src/rooms/store.ts](file:///home/nacs/Documents/git/typing-race/apps/engine/src/rooms/store.ts), [apps/engine/src/rooms/manager.ts](file:///home/nacs/Documents/git/typing-race/apps/engine/src/rooms/manager.ts)
- **Issue:** All room metadata, player structures, active race timers, and keystroke progression snapshots are held strictly in process memory (`Map<string, Room>`).
- **Impact:**
  1. **Disaster Recovery:** Any restart, crash, or deployment of the Engine worker terminates all active games immediately.
  2. **Horizontal Scaling:** Although `RedisEventBridge` provides pub/sub message transport between Gateway and Engine, running multiple concurrent Engine workers is not supported because rooms are not shared across worker processes.
- **Remediation Path:** Implement a Redis-backed `RoomStore` (using Redis JSON, Hashes, or Redlock) to store room state externally, enabling horizontal Engine worker pools.

### Distributed Rate Limiting
- **Location:** [apps/gateway/src/rate-limit/ip-limiter.ts](file:///home/nacs/Documents/git/typing-race/apps/gateway/src/rate-limit/ip-limiter.ts)
- **Issue:** The room creation limiter (`IpRateLimiter`) uses a local in-memory JavaScript `Map<string, number[]>`.
- **Impact:** In a multi-gateway cluster deployed behind an HTTP/WebSocket load balancer, rate limits are enforced per-instance rather than globally. A malicious user could bypass limits by opening connections across different gateway instances.
- **Remediation Path:** Store rate limit sliding windows in Redis via `INCR` or sorted sets when `REDIS_URL` is supplied.

### Web Client Singleton WebSocket Architecture
- **Location:** [apps/web/src/net/ws.ts](file:///home/nacs/Documents/git/typing-race/apps/web/src/net/ws.ts)
- **Issue:** `ws` is instantiated as a global module-level singleton that automatically triggers socket initialization upon module load in a browser environment.
- **Impact:** Isolated component unit testing requires stubbing or mocking the global instance to prevent unwanted network side-effects during test teardown.
- **Remediation Path:** Encapsulate socket lifecycle management within a React Context provider or explicit client factory.

---

## 3. Concurrency and Network Edge Cases

### Clock Synchronization Under Asymmetric Network Jitter
- **Location:** [apps/web/src/net/clock.ts](file:///home/nacs/Documents/git/typing-race/apps/web/src/net/clock.ts), [apps/gateway/src/routes.ts](file:///home/nacs/Documents/git/typing-race/apps/gateway/src/routes.ts)
- **Risk:** The 2-phase NTP sync assumes symmetric forward and reverse network latency between browser and Gateway. Under severe asymmetric bufferbloat or cellular network jitter, measured time offset can skew by 20–60ms, producing subtle countdown discrepancy.
- **Current Mitigation:** Rejects samples with roundtrip times exceeding 500ms; client countdown view relies on server-stamped start time.

### Rapid Backspace Cursor Jitter on Latency Spikes
- **Location:** [apps/web/src/components/RaceView.tsx](file:///home/nacs/Documents/git/typing-race/apps/web/src/components/RaceView.tsx), [apps/engine/src/race/validate-keystroke.ts](file:///home/nacs/Documents/git/typing-race/apps/engine/src/race/validate-keystroke.ts)
- **Risk:** Rapid backspacing emits `correction` frames. If network roundtrip latency is high, authoritative server updates confirming earlier backspaces might arrive after the user has already resumed forward typing, causing brief visual cursor snap.
- **Current Mitigation:** Server strictly validates monotonic indices and applies last-write-wins updates per character position.

### Multi-Tab Rapid Focus Toggling
- **Location:** [apps/web/src/App.tsx](file:///home/nacs/Documents/git/typing-race/apps/web/src/App.tsx)
- **Risk:** If a user opens the same room across multiple browser tabs and rapidly switches focus or clicks between them, both tabs attempt to reclaim the session via `ws.rejoin()`, leading to rapid alternating `session_taken_over` eviction notices.
- **Current Mitigation:** Automatic reclamation is gated through clear user action (banner click or keyboard input on the inactive tab).

---

## 4. Scalability and Resource Boundaries

### Inactive Room Retention
- **Location:** [apps/engine/src/rooms/manager.ts](file:///home/nacs/Documents/git/typing-race/apps/engine/src/rooms/manager.ts)
- **Risk:** Rooms are retained as long as at least one socket remains connected. If a host creates a room and leaves the tab open indefinitely without starting a race, the room remains in memory.
- **Current Mitigation:** 15-second WebSocket heartbeats prune dead sockets. When all players disconnect and the 60-second disconnect grace expires, the room is deleted. However, no idle timeout terminates inactive connected rooms.

### Single-Loop Tick Bottleneck Under Heavy Load
- **Location:** [apps/engine/src/engine.ts](file:///home/nacs/Documents/git/typing-race/apps/engine/src/engine.ts)
- **Risk:** The 1Hz `controller.tick()` iterates sequentially through all active rooms. In scenarios with thousands of concurrent rooms, processing room state updates inside a single Bun tick could block the event loop.
- **Current Mitigation:** Acceptable for current single-instance concurrency targets (<1,000 concurrent players); partitioning rooms across multiple worker instances is needed for large-scale enterprise deployments.
