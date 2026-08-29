# Typing Race

Realtime multiplayer typing race. Two connected clients see each other's cursor in real time and the race ends with a fair, identical WPM/accuracy score.

## Local dev

```bash
bun install
bun run dev              # boots server (:8080) + Vite (:5173) concurrently
```

Or per-package:

```bash
bun --filter @typing-race/server run dev
bun --filter @typing-race/web run dev
```

Bun 1.3.2+ required. Lockfile is text-based (`bun.lock`) and committed; install is deterministic via `bun install --frozen-lockfile`.

## Architecture

Three workspaces under `apps/*` and `packages/*`:

- **`@typing-race/shared`** — Zod 4 discriminated unions for the wire contract. Single source of truth (REQ-13).
- **`@typing-race/server`** — Bun.serve + Hono on :8080. Native WebSocket upgrade, typed `ws.data`, Zod-validated dispatch.
- **`@typing-race/web`** — Vite 8 + React 19 + Zustand 5 on :5173. Dev proxy forwards `/ws` and `/api/*` to :8080.

## Verify the dev server is up

```bash
curl -fsS http://localhost:8080/health    # → "ok"
curl -fsS http://localhost:5173/health    # → "ok" (proxied through Vite)
open http://localhost:5173                # green "open" pill + playerId
```