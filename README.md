# Typing Race

Realtime multiplayer typing race. Two connected clients see each other's cursor in real time and the race ends with a fair, identical WPM/accuracy score.

## Run modes

Two ways to run locally.

**Dev (Vite + HMR, recommended for editing):**

```bash
bun install
bun --filter @typing-race/server run dev    # Bun on :8080
bun --filter @typing-race/web run dev       # Vite on :5173 (separate terminal)
```

Open http://localhost:5173. Vite proxies `/api`, `/health`, and `/ws` to Bun on :8080.

**Prod (single Bun process, simulates Fly.io deploy):**

```bash
bun install
bun --filter @typing-race/web run build      # builds apps/web/dist
bun --filter @typing-race/server run start   # Bun on :8080 serves SPA + WS + /health
```

Open http://localhost:8080. Bun serves the built React SPA, upgrades WS at `ws://localhost:8080/ws`, and returns `ok` at `/health` from one process — same shape as the Fly.io deploy in Phase 6.

For both modes combined in dev:

```bash
bun install
bun run dev                                  # boots server (:8080) + Vite (:5173) concurrently
```

Bun 1.3.2+ required. Lockfile is text-based (`bun.lock`) and committed; install is deterministic via `bun install --frozen-lockfile`.

## Architecture

Three workspaces under `apps/*` and `packages/*`:

- **`@typing-race/shared`** — Zod 4 discriminated unions for the wire contract. Single source of truth (REQ-13).
- **`@typing-race/server`** — Bun.serve + Hono on :8080. Native WebSocket upgrade, typed `ws.data`, Zod-validated dispatch. In prod also serves the built SPA with precompressed `.gz` / `.br` siblings via Hono `serveStatic` (`precompressed: true`).
- **`@typing-race/web`** — Vite 8 + React 19 + Zustand 5 on :5173. Dev proxy forwards `/ws`, `/health`, and `/api/*` to :8080. Build emits `.gz` + `.br` siblings via `vite-plugin-compression` (gzip) + a Node `zlib.brotliCompress` post-pass.

## Verify the dev server is up

```bash
curl -fsS http://localhost:8080/health    # → "ok"
curl -fsS http://localhost:5173/health    # → "ok" (proxied through Vite)
open http://localhost:5173                # green "open" pill + playerId
```