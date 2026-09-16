# Typing race

FDE resume project. Multiplayer typing race game — realtime, fun, demos great ("open two laptops, watch cursors move").

## Core loop
- Create room → share 6-char code → friends join lobby.
- Countdown → everyone types same passage → live opponent cursors on track view.
- Race ends → WPM/accuracy board → rematch.

## Architecture
- **Vite + React/TypeScript** frontend (or Preact for smaller bundle).
- **Bun + Hono** backend — native WebSockets, runs anywhere (Node/Bun/Deno/Workers).
- Rooms: in-memory Map fine for demo (honest tradeoff); Redis/KV if scaling story needed.
- Passage source: public-domain corpus bundled or fetched.
- Shared TS types between client/server for WS message schemas.

## Hard parts = interview gold
- Clock sync so all clients start same moment.
- Server-authoritative input validation (anti-cheat: server counts correct keystrokes; client only renders).
- Reconnect mid-race without corrupting state.
- Backspace handling + per-word correctness for accurate WPM.
- Latency smoothing for remote cursors (interpolation).

## Scope cut (2 weekends)
- v1: rooms, race, WPM board. No accounts, no persistent leaderboard, English passages only.
- v2 polish: themes, ghost replay, share result image.

## Resume bullet
"Built real-time multiplayer typing-race game with WebSocket rooms, server-authoritative input validation, and sub-100ms cursor sync across clients; deployed at [url]."
