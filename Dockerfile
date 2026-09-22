# syntax=docker/dockerfile:1
ARG BUN_VERSION=1.3.2

# ---------- base ----------
FROM oven/bun:${BUN_VERSION}-slim AS base
WORKDIR /app

# ---------- deps ----------
# Full workspace source is copied before `bun install` (not just each
# package.json) — installing against package.json-only stubs left the
# apps/{gateway,engine}/node_modules/@typing-race/* workspace symlinks
# unreliably created under BuildKit (observed both locally and on Render:
# "Cannot find module '@typing-race/shared/bridge'" at container start).
FROM base AS deps
COPY package.json bun.lock tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/gateway    ./apps/gateway
COPY apps/engine     ./apps/engine
COPY apps/web        ./apps/web
RUN bun install --frozen-lockfile

# ---------- client build ----------
FROM deps AS client-build
WORKDIR /app/apps/web
# Vite-only build (skip `tsc --noEmit` here — Dockerfile is not the place to
# typecheck; CI / `bun run typecheck` does that). Vite's bundler resolves
# `.ts` extension imports fine via `allowImportingTsExtensions` at runtime.
RUN bun x vite build

# ---------- runtime ----------
FROM base AS release
ENV NODE_ENV=production
ENV MODE=unified
COPY --from=deps          /app/node_modules         /app/node_modules
COPY --from=deps          /app/packages/shared      /app/packages/shared
COPY --from=deps          /app/apps/gateway         /app/apps/gateway
COPY --from=deps          /app/apps/engine          /app/apps/engine
COPY --from=client-build  /app/apps/web/dist        /app/apps/web/dist
COPY package.json bun.lock tsconfig.base.json /app/

# `oven/bun` images ship a non-root `bun` user (UID 1000). Switch before ENTRYPOINT.
USER bun
EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=4s --start-period=3s CMD bun -e 'fetch("http://localhost:" + (process.env.PORT || 8080) + "/health").then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))'

ENTRYPOINT ["bun", "run", "apps/gateway/src/index.ts"]
