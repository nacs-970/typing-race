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
COPY apps/gateway   ./apps/gateway

USER bun
EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=3s --retries=3 \
  CMD bun -e 'fetch("http://localhost:8080/health").then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))'

ENTRYPOINT ["bun", "run", "apps/gateway/src/index.ts"]
