# Technology Stack

**Analysis Date:** 2026-09-02

## Languages

**Primary:**
- TypeScript `^5.6.3` - Full-stack across all packages (`apps/server`, `apps/web`, `packages/shared`)
- TSX / JSX - React frontend UI components (`apps/web/src/components/`, `apps/web/src/App.tsx`)

**Secondary:**
- CSS3 - Plain scoped styling (`apps/web/src/index.css`)
- JSON - Configuration and schema definitions (`package.json`, `tsconfig.json`)

## Runtime

**Environment:**
- Bun `>=1.3.2 <1.5.0` (Pinned: `1.3.2`) - Native JS/TS runtime powering both server and test runner

**Package Manager:**
- Bun workspace (`bun@1.3.2`)
- Lockfile: Present (`bun.lockb`)
- Monorepo structure: `apps/*`, `packages/*`

## Frameworks

**Core:**
- Bun Native HTTP & WebSocket - `Bun.serve<WsData>` in `apps/server/src/index.ts`
- Hono `^4.6.14` - Lightweight router for HTTP API & static routes (`apps/server/src/routes.ts`, `apps/server/src/static.ts`)
- React `19.2.8` & React DOM `19.2.8` - Component-based SPA architecture (`apps/web/src/App.tsx`)
- Zustand `5.0.15` - Reactive store management for connection, clock, cursor, and race state (`apps/web/src/store/`)

**Testing:**
- Bun Test (`bun:test`) - Server and shared unit testing runner (`apps/server/src/__tests__/`, `packages/shared/src/__tests__/`)
- Vitest `4.1.11` - Web client component and unit testing (`apps/web/src/__tests__/`)
- Testing Library React `16.3.3` & Happy DOM `20.12.0` - DOM testing environment

**Build/Dev:**
- Vite `8.2.2` - Frontend bundler, HMR server and reverse-proxy (`apps/web/vite.config.ts`)
- `vite-plugin-compression` `^0.5.1` - Gzip asset compression on build
- Concurrently `^9.1.0` - Parallel execution of server and web dev scripts (`package.json`)

## Key Dependencies

**Critical:**
- `zod` `4.5.4` - Strict wire schema definition & runtime validation for all WebSocket frames (`packages/shared/src/messages.ts`, `packages/shared/src/race.ts`)
- `nanoid` `^5.0.9` - Custom alphabet generator for collision-resistant 6-character room codes (`packages/shared/src/codes.ts`)
- `pino` `^9.6.0` & `pino-pretty` `^13.0.0` - High-performance structured logging for server lifecycle events (`apps/server/src/logger.ts`)

**Infrastructure:**
- `@types/bun` `1.4.0` - Server typing and runtime definitions
- `@types/react` `19.2.18` & `@types/react-dom` `19.2.5` - Frontend React types

## Configuration

**Environment:**
- Node/Bun environment variables via `process.env`
- Port defaults: `PORT=8080` (server), `5173` (web dev server)

**Build:**
- `tsconfig.json` (root, server, web, shared): strict type-checking, `moduleResolution: "bundler"`, `allowImportingTsExtensions: true`
- `apps/web/vite.config.ts`: Proxy configuration forwarding `/ws` and `/api` to `http://localhost:8080`

## Platform Requirements

**Development:**
- Linux / macOS / WSL with Bun `>=1.3.2`
- Node.js (optional, for tooling compatibility)

**Production:**
- Single Bun process hosting both WebSocket backend and built static frontend assets (`apps/server/src/static.ts`)

---

*Stack analysis: 2026-09-02*
