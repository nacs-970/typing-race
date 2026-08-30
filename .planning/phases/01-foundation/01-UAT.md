---
status: complete
phase: 01-foundation
source: [.planning/phases/01-foundation/01-01-SUMMARY.md, .planning/phases/01-foundation/01-02-SUMMARY.md, .planning/phases/01-foundation/01-03-SUMMARY.md]
started: 2026-08-30
updated: 2026-08-30
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: `bun run dev` from `apps/server/` boots the server on :8080 with structured "server.listening" log line (port, env, wsKnobs), and `curl -sS http://localhost:8080/health` returns "ok"
result: pass

### 2. Vite Dev Proxy + WS Handshake
expected: With `bun run dev` in `apps/server/` AND `bun run dev` in `apps/web/`, opening `http://localhost:5173/` in a browser shows "Hello Typing Race" page with a playerId populated (status pill = "open")
result: pass

### 3. Prod Single-Process SPA Serving
expected: With only `bun run start` in `apps/server/` (NODE_ENV=production), opening `http://localhost:8080/` shows the built SPA and `curl -I http://localhost:8080/` returns `Content-Encoding: br` (or `gzip`) on hashed assets
result: pass

### 4. Fly.io Deploy Infra Files Present
expected: `Dockerfile`, `fly.toml`, `.dockerignore`, `scripts/deploy.sh` exist at repo root, and `bash scripts/deploy.sh` exits 0 (pre-flight checks pass, prints Phase 6 prerequisites, no actual deploy)
result: pass

### 5. Wire Tracer — End-to-End WS Message Schema Validation
expected: With dev mode running, a Node WS client (`node -e "..."`) connects to `ws://localhost:5173/ws`, receives a JSON frame matching Zod `serverToClient` discriminated union with `type: "hello"` (playerId is a UUID, serverTs is a number)
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]

## Deferred Follow-Ups

[none yet]