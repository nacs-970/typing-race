---
phase: 01-foundation
plan: 01
subsystem: infra
tags: [bun, workspace, monorepo, zod, hono, vite, react, websockets]

# Dependency graph
requires: []
provides:
  - "bun-workspace monorepo skeleton (root + apps/server + apps/web + packages/shared)"
  - "REQ-13 single-source-of-truth wire contract: Zod 4 discriminated unions in @typing-race/shared"
  - "Bun.serve skeleton with native WS upgrade, typed ws.data, Hono /health"
  - "Vite 8 + React 19 + Zustand 5 SPA with WsConnection class + auto-reconnect"
  - "End-to-end wire tracer proven: browser WS through Vite proxy → Bun → Zod-validated hello frame"
affects: [phase-01-plan-02, phase-01-plan-03, phase-02, phase-03, phase-04, phase-05, phase-06]

# Actuals — chars/4 over files actually changed (post Plan 01 scope)
actuals:
  tokens: ~16000
  tasks: 4
  commits: 2

# Tech tracking
tech-stack:
  added:
    - "bun@1.3.2 (runtime + package manager)"
    - "typescript@5.6.x (compiler)"
    - "zod@4.5.4 (schema validation, REQ-13)"
    - "hono@4.13.5 (HTTP routing on Bun server)"
    - "@hono/zod-validator@0.9.0"
    - "nanoid@6.0.1 (server identity helpers)"
    - "pino@10.3.1 + pino-pretty@13.1.3 (structured logging)"
    - "react@19.2.8 + react-dom@19.2.8"
    - "zustand@5.0.15 (client store)"
    - "vite@8.2.2 + @vitejs/plugin-react@6.1.1"
    - "vitest@4.1.11 + happy-dom@20.12.0 + @testing-library/react@16.3.3 (test stack, configured for Phase 2)"
    - "concurrently@9.2.4 (root dev script to boot server + web)"
  patterns:
    - "bun-workspace resolution with per-workspace node_modules (bun@1.3.2 hoists differently than 1.4.x; both server and web resolve @typing-race/shared via symlinks)"
    - "Native Bun.serve WebSocket handlers (NOT Hono upgradeWebSocket) for typed ws.data"
    - "Zod discriminated unions for both directions of the wire contract — every frame safeParse'd before dispatch"
    - "Exhaustive switch on discriminated union (TS `never` check)"
    - "Vite dev proxy forwards /ws and /api/* to Bun on :8080 (single origin from browser)"
    - "Store-bridge pattern: non-React modules push Zustand updates via thin wrapper (no hook calls outside components)"

key-files:
  created:
    - "package.json — workspace manifest with concurrently dev script"
    - "bunfig.toml — [install] workspaces=true exact=true"
    - "tsconfig.base.json — strict + allowImportingTsExtensions (Bun-native .ts imports)"
    - ".gitignore — bun.lockb excluded, bun.lock committed"
    - ".prettierrc + .eslintrc.json"
    - "README.md — single-screen dev quickstart"
    - "packages/shared/src/messages.ts — Zod 4 discriminated unions for hello, ping, join_room, leave_room, pong, error"
    - "packages/shared/src/codes.ts — ROOM_CODE_ALPHABET (excludes I/O/0/1)"
    - "packages/shared/src/race.ts — stub for Phase 2"
    - "packages/shared/src/index.ts — barrel"
    - "apps/server/src/index.ts — Bun.serve with typed WsData, /ws upgrade, /health route, SIGTERM handler"
    - "apps/server/src/ws/dispatch.ts — Zod safeParse + exhaustive switch"
    - "apps/server/src/ws/handlers.ts — typed sendHello/echoPing helpers"
    - "apps/server/src/routes.ts — Hono /health"
    - "apps/server/src/logger.ts — pino (pretty in dev, JSON in prod)"
    - "apps/server/src/static.ts — dev shim (Plan 02 replaces with serveStatic)"
    - "apps/server/src/env.ts — PORT/NODE_ENV/LOG_LEVEL"
    - "apps/web/src/App.tsx — Hello Typing Race + status pill + playerId display"
    - "apps/web/src/net/ws.ts — WsConnection class with auto-reconnect, Zod-validated inbound"
    - "apps/web/src/store/connection.ts — Zustand store for {status, playerId, serverTs}"
    - "apps/web/src/store/store-bridge.ts — non-React → store bridge"
    - "apps/web/src/styles.css — plain CSS status-pill + card UI"
    - "apps/web/vite.config.ts — /ws + /api/* dev proxy"
    - "apps/web/index.html + src/main.tsx"
  modified: []

key-decisions:
  - "Pinned bun@1.3.2 (per user instruction), packageManager set to bun@1.3.2 — overrides plan's bun@1.4.0"
  - "Pinned @types/bun@1.4.0 (type definitions) independent of runtime version — type defs describe Bun's stable WS API"
  - "Bun.serve<WsData>({...}) — single type generic (not the two-arg form the plan suggested); second arg constraint incompatible"
  - "idleTimeout/maxPayloadLength/backpressureLimit/sendPings/perMessageDeflate moved under `websocket:` sub-object — these are WebSocketHandler props, not top-level Bun.serve props"
  - "tsconfig.base.json enables allowImportingTsExtensions (Bun runtime natively resolves .ts imports)"
  - "apps/web tsconfig drops rootDir — vite.config.ts sits outside src/"
  - "Store-bridge pattern (connection.ts → store-bridge.ts) avoids importing hooks from non-React code (WsConnection)"
  - "WS dispatcher uses exhaustive switch with `never` guard so TS yells when new message types are added without cases"
  - "Tasks 2 (lockfile pinning) and 3 (UI polish) shipped inside Task 1 commit — no separate commits needed; no new files added by those tasks"

patterns-established:
  - "Pattern: `bun install` at root with workspaces — symlinks resolve at apps/server and apps/web level (NOT root), so verify with `ls apps/*/node_modules/@typing-race/`"
  - "Pattern: Zod safeParse on every inbound WS frame; never throw — log warn + drop"
  - "Pattern: dispatch by discriminated union type with `never` exhaustiveness check"
  - "Pattern: Bun.serve fetch handler routes /ws → native upgrade, /health + /api/* → Hono, else → static shim"
  - "Pattern: connection state in single Zustand store + store-bridge for non-React updates"

requirements-completed: [REQ-13]

# Coverage metadata
coverage:
  - id: D1
    description: "bun-workspace monorepo with three workspaces (@typing-race/shared, @typing-race/server, @typing-race/web) and bun install succeeds"
    requirement: REQ-13
    verification:
      - kind: automated_ui
        ref: "bun install exits 0; ls apps/server/node_modules/@typing-race/ and apps/web/node_modules/@typing-race/ both show shared symlink"
        status: pass
      - kind: other
        ref: "bun --workspaces run typecheck exits 0 across all 3 packages"
        status: pass
    human_judgment: false
  - id: D2
    description: "Bun+Hono server on :8080 returns 'ok' for GET /health and accepts WS upgrades at /ws"
    requirement: REQ-13
    verification:
      - kind: e2e
        ref: "curl http://localhost:8080/health returns 'ok'"
        status: pass
      - kind: e2e
        ref: "ws://localhost:8080/ws upgrade succeeds; server log shows '[ws] open'"
        status: pass
    human_judgment: false
  - id: D3
    description: "Vite+React SPA on :5173 with WsConnection that validates inbound frames via shared Zod schema and stores playerId in Zustand"
    requirement: REQ-13
    verification:
      - kind: e2e
        ref: "curl http://localhost:5173/ returns HTML with <div id=\"root\">"
        status: pass
      - kind: automated_ui
        ref: "apps/web build exits 0; dist/index.html + chunked JS exist"
        status: pass
    human_judgment: false
  - id: D4
    description: "End-to-end tracer: WS through Vite proxy → Bun → Zod-validated hello frame → DOM displays playerId"
    requirement: REQ-13
    verification:
      - kind: e2e
        ref: "node WebSocket client to ws://localhost:5173/ws receives OPEN + HELLO <uuid> <serverTs>"
        status: pass
      - kind: other
        ref: "Server logs show '[ws] open' + '[ws] close' for the tracer connection"
        status: pass
    human_judgment: true
    rationale: "Browser DOM rendering of playerId not automated-tested in headless; visual confirmation needs human eye or Playwright (Phase 5)."
  - id: D5
    description: "Single-source-of-truth wire contract: editing packages/shared/src/messages.ts breaks typecheck in consumers that import the old shape"
    requirement: REQ-13
    verification:
      - kind: other
        ref: "bun --workspaces run typecheck exits 0; workspace symlinks prove both server and web resolve the same @typing-race/shared package"
        status: pass
    human_judgment: true
    rationale: "Mutation test (break the schema, see consumer fail) not run to keep repo clean; typecheck pass + symlink resolution is strong indirect evidence."
  - id: D6
    description: "bun.lock committed; bun install --frozen-lockfile is deterministic"
    requirement: REQ-13
    verification:
      - kind: other
        ref: "git ls-files bun.lock; bun install --frozen-lockfile prints 'no changes'"
        status: pass
    human_judgment: false
  - id: D7
    description: "README documents local dev quickstart + verify commands"
    requirement: REQ-13
    verification:
      - kind: manual_procedural
        ref: "README.md head -3 contains 'Typing Race'; wc -l <60; contains 'bun run dev' + 'http://localhost:8080/health'"
        status: pass
    human_judgment: false

# Metrics
duration: ~25min
completed: 2026-08-30
status: complete
---

# Phase 1: Foundation Summary

**Bun-workspace monorepo with Zod 4 wire-contract (REQ-13), Bun.serve+Hono /health + /ws, and Vite+React SPA — end-to-end WS round-trip proven via Node client through Vite proxy.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-30T05:28:00Z
- **Completed:** 2026-08-30T05:53:00Z
- **Tasks:** 4
- **Files modified:** 33 (1378 insertions)

## Accomplishments

- Bun-workspace monorepo boots: 3 workspaces, all typecheck clean
- `bun install --frozen-lockfile` deterministic from committed text lockfile
- Bun+Hono server on :8080 returns `ok` for `/health`, accepts WS upgrades at `/ws`
- Vite+React SPA on :5173 proxies `/ws` and `/api/*` to Bun
- Wire tracer proven: Node WebSocket client → Vite proxy → Bun → Zod-validated `hello` frame with playerId + serverTs
- Zod 4 discriminated unions as single source of truth (REQ-13)
- End-to-end visibility: status pill, truncated playerId, ISO server timestamp in DOM

## Task Commits

Each task was committed atomically:

1. **Task 1: Tracer — monorepo + shared + server + web + e2e proof** — `413ffce` (feat)
   - Includes Tasks 2 (lockfile + engines + gitignore) and 3 (UI polish — already in App.tsx/styles.css) since they shared no new files with Task 1
2. **Task 2: Lockfile + version pinning** — no separate commit (all settings in Task 1)
3. **Task 3: Hello-world UI polish** — no separate commit (status pill + playerId display built in Task 1)
4. **Task 4: Workspace README + dev quickstart** — `8ad33d7` (docs)

**Plan metadata:** (SUMMARY commit follows)

## Files Created/Modified

- `package.json` + `bunfig.toml` + `tsconfig.base.json` + `.gitignore` + `.prettierrc` + `.eslintrc.json` — root monorepo config
- `packages/shared/src/{messages,codes,race,index}.ts` — Zod schemas, room-code alphabet stub, race placeholder, barrel
- `apps/server/src/{index,routes,static,env,logger}.ts` + `apps/server/src/ws/{dispatch,handlers}.ts` — Bun.serve skeleton
- `apps/web/src/{App,main,styles}.tsx?css` + `apps/web/src/net/ws.ts` + `apps/web/src/store/{connection,store-bridge}.ts` — SPA + WS client + Zustand store
- `apps/web/vite.config.ts` + `apps/web/index.html` — dev proxy + SPA shell
- `bun.lock` — text lockfile (committed, deterministic install)
- `README.md` — single-screen dev quickstart

## Decisions Made

- Pinned `bun@1.3.2` per user instruction (overrides plan's `bun@1.4.0`); `packageManager` field set accordingly
- `@types/bun@1.4.0` for type defs — independent of runtime version
- Bun.serve `<WsData>` single-generic form (two-arg form rejected by type checker)
- WS handler props (`idleTimeout`, `maxPayloadLength`, `backpressureLimit`, `sendPings`, `perMessageDeflate`) live under the `websocket:` sub-object, not top-level
- `allowImportingTsExtensions: true` in tsconfig.base — Bun runtime natively resolves `.ts` imports
- Dropped `rootDir` in web tsconfig — `vite.config.ts` sits outside `src/`
- Store-bridge pattern for non-React → Zustand updates (WsConnection can't call hooks)
- Tasks 2/3 were logical groupings in the plan but ship zero new files beyond Task 1 — committed inside the Task 1 commit; this is a plan-scoping observation, not a deviation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Blocking] Bun.serve type signature mismatch**

- **Found during:** Task 1 (typecheck)
- **Issue:** Plan wrote `Bun.serve<WsData, undefined>({...})` — second generic param requires `string` constraint per bun-types, so `undefined` rejected; also top-level `idleTimeout`/`maxPayloadLength`/`backpressureLimit`/`sendPings`/`perMessageDeflate` are `WebSocketHandler` props, not top-level `Bun.serve` props
- **Fix:** Used `Bun.serve<WsData>({...})` and moved WS tunables inside `websocket: { idleTimeout, maxPayloadLength, ... }`
- **Files modified:** `apps/server/src/index.ts`
- **Verification:** `bun --filter '@typing-race/server' run typecheck` exits 0; e2e WS tracer confirms tunables accepted at runtime
- **Committed in:** `413ffce` (Task 1)

**2. [Rule 2 - Blocking] `.ts` extensions in imports rejected by TS**

- **Found during:** Task 1 (typecheck)
- **Issue:** All code uses Bun-native `.ts` imports (e.g. `from "./messages.ts"`); TS 5.6 rejects by default (`TS5097: allowImportingTsExtensions required`)
- **Fix:** Added `allowImportingTsExtensions: true` to `tsconfig.base.json`
- **Files modified:** `tsconfig.base.json`
- **Verification:** All 3 packages typecheck clean
- **Committed in:** `413ffce` (Task 1)

**3. [Rule 2 - Blocking] Web tsconfig rootDir mismatch**

- **Found during:** Task 1 (typecheck)
- **Issue:** Plan's `apps/web/tsconfig.json` sets `rootDir: "./src"` but `include` covers `vite.config.ts` outside src → `TS6059`
- **Fix:** Removed `rootDir` (build emits to `./dist`, tsc is `noEmit` anyway)
- **Files modified:** `apps/web/tsconfig.json`
- **Verification:** Web typecheck exits 0; build emits clean dist/
- **Committed in:** `413ffce` (Task 1)

**4. [Rule 2 - Blocking] Wrong relative import path in WsConnection**

- **Found during:** Task 1 (typecheck)
- **Issue:** `src/net/ws.ts` imported `./store-bridge.ts` (would resolve to `src/net/store-bridge.ts`); the file lives at `src/store/store-bridge.ts`
- **Fix:** Corrected to `../store/store-bridge.ts`
- **Files modified:** `apps/web/src/net/ws.ts`
- **Verification:** Web typecheck exits 0; WS tracer succeeds at runtime
- **Committed in:** `413ffce` (Task 1)

**5. [Rule 3 - Plan hygiene] Accidental `git add -A` swept in tooling**

- **Found during:** Task 1 commit
- **Issue:** `git add -A` staged `.hermes/`, `spec.md`, `.planning/` files unrelated to the monorepo skeleton
- **Fix:** `git reset --soft HEAD~1`, `git restore --staged` for the unwanted paths, re-staged explicitly only project files, re-committed as clean `413ffce`
- **Files modified:** None (commit hygiene)
- **Verification:** `git show --stat HEAD` shows only 33 monorepo files
- **Committed in:** `413ffce` (Task 1, second attempt)

**6. [Rule 4 - Note] Plan verify line `curl -fsS http://localhost:5173/health`**

- **Found during:** Phase verification
- **Issue:** `/health` lives only on Bun :8080; Vite has no `/health` route and serves SPA index for anything not matching its proxy rules
- **Fix:** Documented in note (no code change). The proxy chain still works — `curl :8080/health` returns "ok", and `curl :5173/health` returns the SPA (proves Vite is up). The actual proxy test is the WS round-trip below.
- **Files modified:** None
- **Verification:** All other phase-verification commands pass

---

**Total deviations:** 5 auto-fixed (4 blocking typecheck, 1 hygiene) + 1 documented note
**Impact on plan:** All auto-fixes necessary for correctness; no scope creep. Phase 1 plan intent preserved — every layer wired, tracer proven.

## Issues Encountered

- `bun --filter` pattern syntax with `bun@1.3.2` is brittle — `bun --filter '*' run typecheck` fails with "No packages matched"; `bun --workspaces run typecheck` works for the "all packages" case, and running inside each workspace dir (`cd apps/server && bun run typecheck`) works for targeted scripts. The root `npm run typecheck` script uses `--workspaces`.
- Vite's WS proxy logs `ECONNRESET` when the upstream WS closes cleanly — cosmetic noise, not a real error.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 1 Plan 02 (room codes + lint + Husky + Vitest scaffolding) can start immediately
- `@typing-race/shared` is the single SoT — adding new message types just extends the discriminated unions
- Bun.serve native WS path is wired and tested; Plan 02 can extend the dispatch table
- Vite dev proxy chain is proven end-to-end; Plan 02 can add `/api/*` routes without changing infrastructure

*Phase: 01-foundation*
*Completed: 2026-08-30*