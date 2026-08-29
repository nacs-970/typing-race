# syntax=docker/dockerfile:1
ARG BUN_VERSION=1.3.2

# ---------- base ----------
FROM oven/bun:${BUN_VERSION}-slim AS base
WORKDIR /app

# ---------- deps ----------
# Workspace-aware install: COPY each package.json so Bun can resolve the
# `workspaces` field in the root package.json and link accordingly.
FROM base AS deps
COPY package.json bun.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json    ./apps/server/
COPY apps/web/package.json       ./apps/web/
RUN bun install --frozen-lockfile

# ---------- client build ----------
FROM deps AS client-build
COPY tsconfig.base.json       ./
COPY packages/shared ./packages/shared
COPY apps/web       ./apps/web
WORKDIR /app/apps/web
# Vite-only build (skip `tsc --noEmit` here — Dockerfile is not the place to
# typecheck; CI / `bun run typecheck` does that). Vite's bundler resolves
# `.ts` extension imports fine via `allowImportingTsExtensions` at runtime.
RUN bun x vite build

# ---------- runtime ----------
FROM base AS release
ENV NODE_ENV=production
COPY --from=deps          /app/node_modules         /app/node_modules
COPY --from=client-build  /app/apps/web/dist        /app/apps/web/dist
COPY packages/shared      /app/packages/shared
COPY apps/server          /app/apps/server
COPY package.json bun.lock /app/

# `oven/bun` images ship a non-root `bun` user (UID 1000). Switch before ENTRYPOINT.
USER bun
EXPOSE 8080

# Pitfall 4 fix: WORKDIR must match `import.meta.dir` in `apps/server/src/static.ts`.
# With WORKDIR=/app/apps/server, `import.meta.dir` resolves to
# `/app/apps/server/src` and `path.resolve(import.meta.dir, "../../web/dist")`
# equals `/app/apps/web/dist` — where client-build COPY'd the SPA.
WORKDIR /app/apps/server

# Bun.serve binds 0.0.0.0:8080 by default (no hostname override).
# HEALTHCHECK is independent of Fly's [[http_service.checks]] — useful for
# plain `docker run` smoke tests and CI local sanity checks.
HEALTHCHECK --interval=15s --timeout=4s --start-period=3s CMD bun -e 'fetch("http://localhost:8080/health").then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))'

ENTRYPOINT ["bun", "run", "src/index.ts"]