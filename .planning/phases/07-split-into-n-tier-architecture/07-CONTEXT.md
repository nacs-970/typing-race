# Phase 7: Split into N-tier architecture - Context

**Gathered:** 2026-09-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Decompose the monolithic server and single-deploy monorepo into an N-tier architecture:
- Presentation Tier (`apps/web`): Pure static React 19 + Vite client (CDN-ready).
- Real-time Gateway Tier (`apps/gateway`): Bun.serve WebSocket server + Hono HTTP API for client session routing.
- Race Engine Tier (`apps/engine`): Headless race loop, anti-cheat validation, and room lifecycle worker.
- Shared Contract Tier (`packages/shared`): Canonical wire protocol schemas, types, and corpus.
- Zero-install in-memory state adapter for local development, with pluggable Redis support for production multi-instance scaling.

</domain>

<decisions>
## Implementation Decisions

### Tier Boundaries & Service Granularity
- **D-01:** 3-Tier Architecture with dedicated apps in monorepo: `apps/web` (Client), `apps/gateway` (WS connection manager & HTTP router), and `apps/engine` (race simulation, keystroke validation, and tick loop), consuming `packages/shared`. — **Reversibility:** one-way — establishes monorepo folder layout, package boundaries, and build pipelines.

### State & Storage Tier
- **D-02:** Zero-install in-memory state by default. No local Redis daemon or Docker required for local development. Transparently activate Redis adapter when `REDIS_URL` is supplied in production. — **Reversibility:** costly — requires state storage interface abstraction (`RoomStore`).
- **D-03:** Ephemeral matches and rooms. Active room state evaporates when the last player disconnects; no database required for core gameplay. — **Reversibility:** reversible.

### Local Development Orchestration
- **D-04:** Root `bun run dev` boots `web`, `gateway`, and `engine` concurrently using `concurrently`. Dual-mode support allows running unified in a single process (`MODE=unified`) or as independent processes (`MODE=split`). Dedicated scripts (`dev:web`, `dev:gateway`, `dev:engine`) for isolated debugging. — **Reversibility:** reversible.
- **D-05:** Port assignments read from `.env` with automatic fallback defaults (`WEB_PORT=5173`, `GATEWAY_PORT=8080`, `ENGINE_PORT=8081`). Vite dev server continues proxying `/ws` and `/api` to Gateway. — **Reversibility:** reversible.

### Inter-Service Communication
- **D-06:** Abstracted Event Bridge with clean `publish`/`subscribe` interface. Uses in-memory EventEmitter when running locally/unified (zero network overhead, zero serialization lag); switches to Redis Pub/Sub or internal loopback IPC in distributed multi-process mode. — **Reversibility:** costly — core messaging layer between gateway and engine.

### Deployment & Cloud Strategy
- **D-07:** Focus on local development first. Author cloud-agnostic Dockerfiles for each tier and a root `docker-compose.yml` so the stack can deploy to GCP (Cloud Run / Firebase), AWS (ECS / S3), or Fly.io without vendor lock-in. — **Reversibility:** reversible.

### Lifecycle & Disconnect Handling
- **D-08:** Split responsibility: Gateway manages client WebSockets, connection upgrades, and ping/pong heartbeats. Engine owns room game state, the 60-second disconnect grace timer, host promotion, and room eviction. — **Reversibility:** costly — demarcates network connection state from game state.

### Migration Execution
- **D-09:** Direct 3-tier cutover: Reorganize existing `apps/server` into `apps/gateway` and `apps/engine` cleanly in this phase. — **Reversibility:** costly.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & Contracts
- `packages/shared/src/messages.ts` — Canonical Zod wire schemas and frame discriminators between client and server.
- `apps/server/src/rooms/manager.ts` — Existing room lifecycle, host migration, and disconnect eviction logic.
- `apps/server/src/race/controller.ts` — Existing tick loop and race controller logic.
- `apps/server/src/race/validator.ts` — Anti-cheat validation rules and WPM scoring.
- `apps/server/src/ws/dispatch.ts` — Current client frame dispatcher to be extracted into Gateway.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/shared`: Existing Zod schemas (`messages.ts`), room code generator (`codes.ts`), and passage corpus (`passages.ts`) can be consumed immediately by both `apps/gateway` and `apps/engine`.
- `apps/server/src/ws/handlers.ts`: WebSocket upgrade and ping/pong logic moves directly to `apps/gateway`.
- `apps/server/src/race/*`: Scoring, validation, and tick controller logic move directly to `apps/engine`.

### Established Patterns
- Anti-cheat timestamping: Keystroke validation relies on server-received timestamps, not client clocks.
- Zero React render cursor positioning: Web client renders opponent cursors via DOM `translate3d()` outside React tree.
- Dynamic WebSocket host: Client connects via `${protocol}//${window.location.host}/ws` or `VITE_WS_URL`.

### Integration Points
- Gateway $\leftrightarrow$ Engine bridge: Gateway forwards parsed C→S frames (`keystroke`, `set_ready`, `start_race`, `leave_room`, `rejoin_room`) to Engine; Engine emits S→C broadcast frames back to Gateway for client delivery.
- Web $\leftrightarrow$ Gateway: Existing HTTP `/health` and WebSocket `/ws` endpoints remain unchanged from the client's perspective.

</code_context>

<specifics>
## Specific Ideas

- Zero-dependency local development must remain fast: running `bun run dev` on a laptop should not require Docker, Redis, or external cloud credentials.
- Containerization should be clean and cloud-agnostic (standard Dockerfiles + docker-compose).

</specifics>

<deferred>
## Deferred Ideas

- Persistent database (PostgreSQL / SQLite) for user accounts and permanent leaderboards (remains out of scope for v1).
- Google Cloud / AWS infrastructure as code (Terraform / CDK) — deferred until ready for public cloud deployment.

</deferred>

---

*Phase: 07-split-into-n-tier-architecture*
*Context gathered: 2026-09-04*
