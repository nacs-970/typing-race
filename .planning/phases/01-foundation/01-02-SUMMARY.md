---
phase: 01-foundation
plan: 02
subsystem: infra
tags: [hono, hono/bun, serveStatic, precompressed, brotli, gzip, bun-websocket, prod-build]

# Dependency graph
requires:
  - "01-01"
provides:
  - "REQ-12 single-process Bun deploy: Bun serves built React SPA + WS + /health from one port"
  - "Precompressed .gz and .br siblings for every asset; serveStatic picks them via Accept-Encoding"
  - "Bun.serve production WS knobs: idleTimeout 120, maxPayloadLength 16KB, backpressureLimit 1MB, closeOnBackpressureLimit true, sendPings true, perMessageDeflate true"
  - "Structured startup log proving WS knobs are active"
  - "Independent dev (Vite proxy + Bun on separate ports) and prod (single Bun process) modes both verified"
affects: [phase-01-plan-03, phase-02, phase-06]

# Actuals — chars/4 over files actually changed (post Plan 02 scope)
actuals:
  tokens: ~12000
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added:
    - "vite-plugin-compression@0.5.1 (devDep; emits .gz siblings via closeBundle hook)"
    - "Node zlib.brotliCompress via custom Vite plugin (Bun 1.3.2 lacks Bun.brotliCompress; zlib module is fully available)"
  patterns:
    - "Hono serveStatic from hono/bun with precompressed:true for path-safe + traversal-protected static serving"
    - "Cache-Control: public, max-age=31536000, immutable for content-hashed assets"
    - "Cache-Control: no-cache for index.html (SPA fallback must revalidate on deploy)"
    - "DIST computed from import.meta.dir (../../web/dist from apps/server/src); baked into Dockerfile WORKDIR in Plan 03"
    - "NODE_ENV branch in fetch handler: production → staticApp, dev → 404 dev shim (Vite serves SPA on :5173)"
    - "vite-plugin-compression mtimeCache workaround: gzip via the plugin, brotli via a dedicated plugin's closeBundle hook (module-level cache makes two algorithm invocations of the plugin silently skip)"
    - "Vite proxy adds /health entry alongside /api and /ws"

key-files:
  created: []
  modified:
    - "apps/server/src/static.ts — full rewrite: serveStatic /assets/* (immutable) + SPA fallback (no-cache)"
    - "apps/server/src/index.ts — WS handler knobs (added closeOnBackpressureLimit), NODE_ENV branch in fetch, structured startup log line"
    - "apps/web/vite.config.ts — vite-plugin-compression gzip + dedicated brotli plugin (configResolved captures outDir into closure); /health proxy added"
    - "apps/web/package.json — vite-plugin-compression ^0.5.1 devDep; preview script pinned to port 4173"
    - "bun.lock — locked vite-plugin-compression + transitive deps"
    - "README.md — Run modes section documents both dev (Vite + Bun) and prod (Bun single-process) workflows"

key-decisions:
  - "vite-plugin-compression installed at exactly 0.5.1 — confirmed via `npm view vite-plugin-compression version` (latest at install time)"
  - "vite-plugin-compression brotli path is bypassed — its module-level mtimeCache makes a second algorithm invocation silently no-op. Implemented a dedicated brotli plugin's closeBundle hook using node:zlib directly. Same Bun 1.3.2 process handles both; Bun's zlib shim has brotliCompress even though Bun.brotliCompress itself isn't implemented"
  - "WS knobs go in `websocket:` sub-object of Bun.serve (per Plan 01's correction); top-level Bun.serve doesn't accept them"
  - "closeOnBackpressureLimit: true added in addition to backpressureLimit: 1MB — explicit close signal instead of silent buffer growth (threat T-02-02 mitigation)"
  - "DIST computed via path.resolve(import.meta.dir, '../../web/dist') — robust against cwd; Dockerfile WORKDIR in Plan 03 makes the relative path correct in production too"
  - "Vite proxy adds /health entry — Plan 01 only proxied /api + /ws; curl :5173/health was returning SPA HTML instead of Bun's `ok`. Required by Plan 02 task 2's verify step"
  - "Apps typechecked separately (`cd apps/server && bun run typecheck`, `cd apps/web && bun run typecheck`) — bun@1.3.2 `--filter '*'` glob syntax doesn't resolve against workspace packages"

patterns-established:
  - "Pattern: serveStatic in production mounted at /assets/* + SPA fallback catch-all — Hono's serveStatic handles traversal protection internally"
  - "Pattern: structured startup JSON log line for `[server] listening` carrying wsKnobs snapshot — proves production config is active, makes log scraping trivial"
  - "Pattern: vite-plugin-compression for gzip + dedicated zlib brotliCompress plugin in the same plugins array — works around the shared mtimeCache bug"
  - "Pattern: Bun.serve fetch handler is a 3-way switch: /ws → native upgrade, /health|/api/* → Hono routes, else NODE_ENV branch"
  - "Pattern: DEV mode verification uses :5173 endpoints (Vite serves SPA, proxies REST/WS); PROD mode verification uses :8080 endpoints (Bun serves SPA + WS + /health from one process). Both modes independently demoable"

requirements-completed: [REQ-12, REQ-13]

# Coverage metadata
coverage:
  - id: D1
    description: "Building apps/web emits apps/web/dist/index.html + hashed asset files + .gz and .br siblings"
    requirement: REQ-12
    verification:
      - kind: other
        ref: "bun --filter @typing-race/web run build exits 0; ls apps/web/dist/assets/*.gz and *.br both populated"
        status: pass
      - kind: other
        ref: "vite-plugin-compression 0.5.1 confirmed via npm view before install"
        status: pass
    human_judgment: false
  - id: D2
    description: "bun --filter @typing-race/server run start (prod mode) serves GET / → SPA HTML, GET /assets/<hash>.js → JS, GET /health → ok"
    requirement: REQ-12
    verification:
      - kind: e2e
        ref: "NODE_ENV=production bun run start; curl http://localhost:8080/ returns HTML with id=root; curl /health returns ok"
        status: pass
      - kind: e2e
        ref: "curl -I http://localhost:8080/assets/index-*.js shows Cache-Control: public, max-age=31536000, immutable"
        status: pass
      - kind: e2e
        ref: "node WebSocket to ws://localhost:8080/ws receives HELLO <uuid> (single process serves SPA + WS + /health)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Dev mode: http://localhost:5173/ renders SPA, opens WS through Vite proxy, /health returns 200 via proxy"
    requirement: REQ-12
    verification:
      - kind: e2e
        ref: "curl http://localhost:5173/health returns 'ok' (proxied through Vite)"
        status: pass
      - kind: e2e
        ref: "node WebSocket to ws://localhost:5173/ws receives HELLO <uuid> (proxied WS upgrade)"
        status: pass
      - kind: e2e
        ref: "curl http://localhost:5173/ returns SPA HTML with id=root"
        status: pass
    human_judgment: false
  - id: D4
    description: "Prod SPA fallback works: GET /foo/bar returns index.html (not 404)"
    requirement: REQ-12
    verification:
      - kind: e2e
        ref: "curl http://localhost:8080/nonexistent-path/abc returns SPA HTML with id=root"
        status: pass
      - kind: e2e
        ref: "curl http://localhost:8080/random/deep/path returns SPA HTML with id=root"
        status: pass
    human_judgment: false
  - id: D5
    description: "Precompressed .gz assets served when Accept-Encoding: gzip (Content-Encoding header present)"
    requirement: REQ-12
    verification:
      - kind: e2e
        ref: "curl -I -H 'Accept-Encoding: gzip' http://localhost:8080/assets/index-*.js returns Content-Encoding: gzip"
        status: pass
      - kind: e2e
        ref: "curl -I -H 'Accept-Encoding: br' http://localhost:8080/assets/index-*.js returns Content-Encoding: br"
        status: pass
    human_judgment: false
  - id: D6
    description: "Bun startup log shows production WS knobs"
    requirement: REQ-12
    verification:
      - kind: other
        ref: "Startup log line: {\"level\":\"info\",\"msg\":\"server.listening\",\"port\":8080,\"env\":\"production\",\"wsKnobs\":{\"idleTimeout\":120,\"maxPayloadLength\":16384,\"backpressureLimit\":1048576,\"sendPings\":true,\"perMessageDeflate\":true}}"
        status: pass
    human_judgment: false
  - id: D7
    description: "Both dev (Vite proxy at :5173) and prod (bun run start serves built SPA from :8080) modes verified independently"
    requirement: REQ-12
    verification:
      - kind: e2e
        ref: "Dev mode: curl :5173/health = ok; node WS to :5173/ws receives HELLO; curl :5173/ = SPA HTML"
        status: pass
      - kind: e2e
        ref: "Prod mode: curl :8080/health = ok; curl :8080/ = SPA HTML; node WS to :8080/ws receives HELLO; precompressed assets + SPA fallback both work"
        status: pass
    human_judgment: false
  - id: D8
    description: "README documents both dev and prod run modes"
    requirement: REQ-12
    verification:
      - kind: manual_procedural
        ref: "README.md contains 'Run modes' section with both modes; grep finds 'ws://localhost:8080/ws'; wc -l = 51 (<100)"
        status: pass
    human_judgment: false

# Metrics
duration: ~15min
completed: 2026-08-30
status: complete
---

# Phase 1: Plan 02 Summary

**Single-process Bun deploy (REQ-12): prod serves built SPA + WS + /health from one port; dev proxies through Vite. WS knobs locked, precompression on the wire, both modes independently demoable.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 3
- **Files modified:** 6 (3 source files, 1 config, 1 lockfile, 1 doc)

## Accomplishments

- `apps/server/src/static.ts` rewritten with Hono `serveStatic` from `hono/bun`, `precompressed: true`, immutable cache on `/assets/*`, no-cache SPA fallback to `index.html`
- `apps/server/src/index.ts` adds Bun WS production knobs (`idleTimeout: 120`, `maxPayloadLength: 16KB`, `backpressureLimit: 1MB`, `closeOnBackpressureLimit: true`, `sendPings: true`, `perMessageDeflate: true`); structured startup JSON log line proves knobs are active
- `apps/web/vite.config.ts` adds `vite-plugin-compression@0.5.1` for gzip + dedicated brotli plugin using `node:zlib.brotliCompress`; existing `/api` and `/ws` proxy entries preserved; `/health` proxy entry added
- `apps/web/package.json` gains `vite-plugin-compression` devDep + `preview` script pinned to port 4173
- `bun.lock` locked with vite-plugin-compression + transitive deps
- `README.md` documents both modes (51 lines total)
- Prod mode verified end-to-end: SPA HTML, asset cache headers, precompressed gzip + brotli, SPA fallback to unknown paths, WS hello frame from same process
- Dev mode verified end-to-end: Vite-served SPA, proxied `/health`, proxied WS upgrade

## Task Commits

Each task committed atomically:

1. **Task 1: Prod static serving + WS knobs + compression plugin** — `d9bafea` (feat)
2. **Task 2: Dev proxy /health entry + WS proxy verification** — `983651c` (feat)
3. **Task 3: README Run modes section** — `8d22e23` (docs)

## Files Created/Modified

- `apps/server/src/static.ts` — Hono app with `serveStatic` for `/assets/*` (immutable) + SPA fallback (no-cache), `precompressed: true`
- `apps/server/src/index.ts` — WS handler knobs, NODE_ENV branch in fetch, structured startup JSON log
- `apps/web/vite.config.ts` — vite-plugin-compression gzip + dedicated brotli plugin + `/health` proxy entry
- `apps/web/package.json` — vite-plugin-compression ^0.5.1 devDep + preview port pin
- `bun.lock` — locked dependencies
- `README.md` — Run modes section (51 lines)

## Decisions Made

- `vite-plugin-compression` at 0.5.1 — verified exact latest via `npm view vite-plugin-compression version` before install
- vite-plugin-compression's brotli path bypassed (module-level mtimeCache silently skips second algorithm invocation); brotli siblings written by dedicated plugin's `closeBundle` hook using `node:zlib.brotliCompress`. Bun 1.3.2's zlib module is complete; `Bun.brotliCompress` itself isn't implemented, but `require('node:zlib').brotliCompress` works
- `closeOnBackpressureLimit: true` added alongside `backpressureLimit: 1MB` — explicit close signal vs silent buffer growth
- `DIST = path.resolve(import.meta.dir, '../../web/dist')` — robust against cwd; Dockerfile WORKDIR in Plan 03 makes the relative path correct in production
- Vite proxy `/health` entry added — Plan 01 only proxied `/api` + `/ws`; without this, `curl :5173/health` returned SPA HTML instead of Bun's `ok`
- Apps typechecked separately (`cd apps/server && bun run typecheck`, `cd apps/web && bun run typecheck`) — `bun --filter '*'` glob syntax doesn't resolve against workspace packages under bun@1.3.2

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Critical] vite-plugin-compression silently skips brotli on second invocation**

- **Found during:** Task 1 (build verification)
- **Issue:** Plan called `compression({ algorithm: "gzip", ext: ".gz" })` + `compression({ algorithm: "brotliCompress", ext: ".br" })`. Plugin source uses a module-level `mtimeCache` to skip already-processed files. The gzip pass caches mtime; the brotli pass sees `mtimeMs <= mtimeCache.get(filePath)` and skips every file. Build log shows gzip files but no `.br` files. Bun 1.3.2 doesn't expose `Bun.brotliCompress`, so the plugin's `zlib.brotliCompress` call fails silently (the `try/catch` catches and logs to config.logger.error — never surfaced)
- **Fix:** Kept `vite-plugin-compression` for gzip (works fine). Added a dedicated plugin (`typing-race:brotli-siblings`) that uses `node:zlib.brotliCompress` directly from its `closeBundle` hook. Bun's zlib shim supports brotli; only the Bun.* shortcut is missing
- **Files modified:** `apps/web/vite.config.ts`
- **Verification:** `bun run build` emits `.gz` and `.br` for every `.js` / `.css` in `apps/web/dist/assets/`; both served with correct `Content-Encoding` header in prod mode
- **Committed in:** `d9bafea` (Task 1)

**2. [Rule 2 - Blocking] /health not proxied by Vite (Plan 01 gap)**

- **Found during:** Task 2 (dev mode smoke)
- **Issue:** Plan 02's verify step asserts `curl http://localhost:5173/health → ok`. Plan 01 only added `/api` and `/ws` proxy entries. Vite served SPA HTML for `/health` because nothing matched
- **Fix:** Added `/health` proxy entry pointing to `http://localhost:8080` (no `ws: true`)
- **Files modified:** `apps/web/vite.config.ts`
- **Verification:** Dev mode smoke: `curl :5173/health` returns `ok`; WS upgrade to `:5173/ws` still works
- **Committed in:** `983651c` (Task 2)

**3. [Rule 3 - Minor] Bun.serve two-generic syntax rejected by type checker**

- **Found during:** Task 1 (typecheck after WS knobs addition)
- **Issue:** First pass used `Bun.serve<WsData, undefined>({...})` — bun-types constrains the second generic param to `string`. Plan 01 already documented this in their SUMMARY; I copied the same mistake
- **Fix:** Used `Bun.serve<WsData>({...})` (single generic)
- **Files modified:** `apps/server/src/index.ts`
- **Verification:** `bun --filter @typing-race/server run typecheck` exits 0
- **Committed in:** `d9bafea` (Task 1)

---

**Total deviations:** 3 auto-fixed (1 critical brotli bug, 1 Plan 01 gap, 1 typecheck)
**Impact on plan:** All auto-fixes necessary for correctness or to satisfy the plan's own verify steps. No scope creep.

## Issues Encountered

- `bun --filter '*'` is a documented brittle pattern on bun@1.3.2 (same issue noted in Plan 01 SUMMARY) — workspaces typecheck needs `cd apps/<pkg> && bun run typecheck`. The root `bun run typecheck` script also fails since it delegates to the same flag
- Vite's WS proxy logs `ECONNRESET` when the upstream WS closes cleanly — cosmetic noise from Vite's http-proxy internals; harmless

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 1 Plan 03 (Fly.io Dockerfile + GitHub Actions CI) can start immediately — `apps/web/dist/` is built and served; Bun on :8080 in `apps/server/` is the production target
- WS handler is locked with production knobs; Plan 02 onwards can extend dispatch table without touching knobs
- Hono `serveStatic` mounted on `/assets/*` + SPA fallback means a single Bun process is ready for Fly's single-port model

*Phase: 01-foundation*
*Completed: 2026-08-30*