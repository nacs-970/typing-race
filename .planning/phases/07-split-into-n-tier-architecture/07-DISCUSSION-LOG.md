# Phase 7: Split into N-tier architecture - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-04
**Phase:** 07-split-into-n-tier-architecture
**Areas discussed:** Tier Boundaries, State & Storage Tier, Local Development Orchestration, Inter-Service Communication, Deployment Topology, Disconnect & Grace Lifecycle, Migration Strategy

---

## Tier Boundaries & Service Granularity

| Option | Description | Selected |
|--------|-------------|----------|
| 3-Tier Architecture | Presentation (SPA), Real-time Gateway (Hono + WS), and Game Engine (Race worker) | ✓ |
| 2-Tier Architecture | Presentation (SPA) + Unified Backend Server | |
| Microservices (4-Tier) | Presentation + Edge Gateway + Matchmaker + Race Engine | |

**User's choice:** 3-Tier with dedicated apps in monorepo: `apps/web`, `apps/gateway`, `apps/engine`, and `packages/shared`.

---

## State & Storage Tier

| Option | Description | Selected |
|--------|-------------|----------|
| Zero-install In-Memory with Optional Redis | Default in-memory state locally; Redis enabled via `REDIS_URL` in production | ✓ |
| Strict Redis Everywhere | Require Redis daemon for both local dev and production | |
| Persistent SQLite | Store all state in `bun:sqlite` file | |

**User's choice:** Zero-install In-Memory with optional Redis. User confirmed no Redis install wanted for local development. Matches remain ephemeral.

---

## Local Development Orchestration

| Option | Description | Selected |
|--------|-------------|----------|
| Single `bun run dev` via concurrently | One root command launches web, gateway, engine in parallel | ✓ |
| Dual Dev/Prod Mode | Unified process locally, decoupled in production | ✓ |
| Separate Terminal Tabs | Run services independently in separate tabs | |

**User's choice:** Support both: root `bun run dev` via concurrently, dual-mode support via env flag, and default ports with `.env` fallbacks.

---

## Inter-Service Communication

| Option | Description | Selected |
|--------|-------------|----------|
| Abstracted Event Bridge | In-memory EventEmitter for unified/local; Redis Pub/Sub for distributed | ✓ |
| Internal Loopback WS/HTTP RPC | Dedicated TCP/WS connections between gateway and engine | |
| Bun Worker Threads | Gateway spawns Engine as background worker thread | |

**User's choice:** Abstracted Event Bridge.

---

## Deployment Topology & Cloud

| Option | Description | Selected |
|--------|-------------|----------|
| Cloud-Agnostic Containers | Dockerfiles + docker-compose.yml ready for GCP, AWS, or Fly.io | ✓ |
| Fly.io Specific VM | Single VM deployment on Fly | |
| AWS Specific Services | S3 + CloudFront + ECS Fargate | |

**User's choice:** Focus on local development first; set up cloud-agnostic containerization ready for any cloud provider.

---

## Disconnect & Grace Lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Split Responsibility | Gateway tracks sockets/ping; Engine owns 60s grace timer & eviction | ✓ |
| Gateway-Owned | Gateway handles both sockets and 60s grace before notifying Engine | |

**User's choice:** Split responsibility.

---

## Migration Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Direct 3-Tier Cutover | Monorepo restructured directly into apps/web, apps/gateway, apps/engine | ✓ |
| Incremental Extraction | Extract Engine first, then Gateway | |

**User's choice:** Direct 3-Tier Cutover.
