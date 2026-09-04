# syntax=docker/dockerfile:1
ARG BUN_VERSION=1.3.2

# Stage 1: Build static frontend assets
FROM oven/bun:${BUN_VERSION}-slim AS builder
WORKDIR /app

# Install dependencies with workspace awareness
COPY package.json bun.lock tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json        ./apps/web/
COPY apps/gateway/package.json    ./apps/gateway/
COPY apps/engine/package.json     ./apps/engine/
RUN bun install --frozen-lockfile

# Copy source and build
COPY packages/shared ./packages/shared
COPY apps/web       ./apps/web

WORKDIR /app/apps/web
RUN bun run build

# Stage 2: Serve static assets with Caddy
FROM caddy:2-alpine AS runtime

COPY apps/web/Caddyfile /etc/caddy/Caddyfile
COPY --from=builder /app/apps/web/dist /usr/share/caddy

EXPOSE 80
