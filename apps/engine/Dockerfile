# syntax=docker/dockerfile:1
ARG BUN_VERSION=1.3.2

# Stage 1: Dependencies
FROM oven/bun:${BUN_VERSION}-slim AS deps
WORKDIR /app

COPY package.json bun.lock tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json        ./apps/web/
COPY apps/gateway/package.json    ./apps/gateway/
COPY apps/engine/package.json     ./apps/engine/
RUN bun install --frozen-lockfile

# Stage 2: Runtime
FROM oven/bun:${BUN_VERSION}-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/engine    ./apps/engine

USER bun
EXPOSE 8081

ENTRYPOINT ["bun", "run", "apps/engine/src/index.ts"]
