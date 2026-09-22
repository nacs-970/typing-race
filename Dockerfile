# syntax=docker/dockerfile:1
ARG BUN_VERSION=1.3.2

# ---------- base ----------
FROM oven/bun:${BUN_VERSION}-slim AS base
WORKDIR /app

# ---------- deps ----------
# Workspace-aware install: COPY each package.json so Bun can resolve the
# `workspaces` field in the root package.json and link accordingly.
FROM base AS deps
COPY package.json bun.lock tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/gateway/package.json   ./apps/gateway/
COPY apps/engine/package.json    ./apps/engine/
COPY apps/web/package.json       ./apps/web/
# `bun install` under BuildKit has an observed race where it silently skips
# creating the workspace-package symlinks (apps/{gateway,engine}/node_modules/
# @typing-race/*), with no non-zero exit — reproduced locally, intermittent
# across identical --no-cache builds. Verify both required symlinks after
# install; on miss, wipe and reinstall once rather than shipping a broken image.
RUN bun install --frozen-lockfile; \
    if [ ! -e apps/gateway/node_modules/@typing-race/shared ] || [ ! -e apps/engine/node_modules/@typing-race/shared ]; then \
      echo "bun install: workspace symlinks missing, retrying" >&2; \
      rm -rf node_modules apps/*/node_modules packages/*/node_modules; \
      bun install --frozen-lockfile; \
    fi

# ---------- client build ----------
FROM deps AS client-build
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
ENV MODE=unified
COPY --from=deps          /app/node_modules         /app/node_modules
COPY --from=client-build  /app/apps/web/dist        /app/apps/web/dist
COPY packages/shared      /app/packages/shared
COPY apps/gateway         /app/apps/gateway
COPY apps/engine          /app/apps/engine
COPY package.json bun.lock tsconfig.base.json /app/

# `oven/bun` images ship a non-root `bun` user (UID 1000). Switch before ENTRYPOINT.
USER bun
EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=4s --start-period=3s CMD bun -e 'fetch("http://localhost:" + (process.env.PORT || 8080) + "/health").then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))'

ENTRYPOINT ["bun", "run", "apps/gateway/src/index.ts"]