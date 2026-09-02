# External Integrations

**Analysis Date:** 2026-09-02

## APIs & External Services

**None:**
- Self-contained offline-first multiplayer architecture.
- No third-party APIs (Stripe, Twilio, OpenAI, GitHub, etc.) are consumed.

## Data Storage

**Databases:**
- None. Ephemeral in-memory state:
  - Rooms stored in `Map<string, Room>` in `apps/server/src/rooms/manager.ts`.
  - Passages loaded from static immutable corpus in `packages/shared/src/passages.ts`.

**File Storage:**
- Local filesystem only for static frontend distribution build (`apps/server/src/static.ts` reading `apps/web/dist`).

**Caching:**
- In-memory `IpRateLimiter` sliding window map (`apps/server/src/rooms/manager.ts`).
- Browser cookie cache for reconnection session tokens (`typing_race_${roomCode}=${sessionToken}`) managed in `apps/web/src/net/ws.ts`.

## Authentication & Identity

**Auth Provider:**
- Custom ephemeral session token identity:
  - Cryptographically secure UUID v4 tokens (`crypto.randomUUID()`) issued per player on room create/join.
  - Attached to WebSocket socket metadata (`ws.data.sessionToken`) and stored client-side in cookies.
  - No usernames/passwords, email auth, OAuth, or external identity providers.

## Monitoring & Observability

**Error Tracking:**
- None (standard stderr/stdout logging).

**Logs:**
- Pino structured JSON logging in `apps/server/src/logger.ts`.
- Formatted with `pino-pretty` in local development.

## CI/CD & Deployment

**Hosting:**
- Self-hosted Bun runtime capable of running behind a reverse proxy (e.g. Nginx, Caddy, Cloudflare).

**CI Pipeline:**
- Bun workspace test suite execution via `bun test` and Vitest.

## Environment Configuration

**Required env vars:**
- `PORT`: Server listening port (default: `8080`, parsed in `apps/server/src/env.ts`).
- `NODE_ENV`: Runtime mode (`development` or `production`).

**Secrets location:**
- No secrets or API credentials required.

## Webhooks & Callbacks

**Incoming:**
- None.

**Outgoing:**
- None.

---

*Integration audit: 2026-09-02*
