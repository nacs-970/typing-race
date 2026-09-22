# Milestones

## v1.0 MVP (Shipped: 2026-09-23)

**Phases completed:** 12 phases, 28 plans, 32 tasks

**Key accomplishments:**

- Bun-workspace monorepo with Zod 4 wire-contract (REQ-13), Bun.serve+Hono /health + /ws, and Vite+React SPA — end-to-end WS round-trip proven via Node client through Vite proxy.
- Single-process Bun deploy (REQ-12): prod serves built SPA + WS + /health from one port; dev proxies through Vite. WS knobs locked, precompression on the wire, both modes independently demoable.
- Investigated 03-VERIFICATION.md's Gap B ("aggregateWordCorrectness never called from production code") and found it was a verifier miss, not a real defect — Phase 3's own decision D-13 explicitly scopes this function to the server data model, "not UI." Reverted an initial build attempt that had wired it into UI rendering before this was found, and recorded a formal override instead.
- Added a proactive notification, fired when a room's second-to-last player leaves, reaching the one remaining player — not only reactively on that client's next failed action. Retargeted from an initial `size===0` attempt that a re-verification pass proved has zero real recipients, to `size===1`, which does.
- Added a local-client "Reconnecting... (Ns)" progress bar driven by real connection-status state, and removed the unreachable version-mismatch toast case that a prior SUMMARY had overclaimed as wired.
- Fixed a real production-breaking bug: `ClientManager.isDraining()` never reset after an engine-only crash-restart in split-mode topology, permanently disabling room creation on an otherwise-healthy gateway. Flagged as CR-B1 in code review, explicitly scoped out as "pre-existing," never actually fixed — closed here.
- Restored the dropped `session_taken_over` notify-then-evict behavior in `RoomManager.rejoinPlayer()` — two `bridge.publishToGateway()` calls gated by a named `isMultiTabTakeover` boolean, matching the pre-Phase-7 monolith implementation exactly.

---
