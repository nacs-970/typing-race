#!/usr/bin/env bash
#
# scripts/smoke-test.sh — Phase 6 local production smoke test
#

set -euo pipefail

readonly HEADER="=========================================================="
printf "%s\n" "$HEADER"
printf "Phase 6 — Local Smoke Test\n"
printf "%s\n" "$HEADER"

printf "[1/4] Building client bundle... "
bun run build >/dev/null 2>&1
printf "ok\n"

printf "[2/4] Booting unified server in background... "
MODE=unified PORT=8080 bun run start >server.log 2>&1 &
SERVER_PID=$!
printf "ok (PID %s)\n" "$SERVER_PID"

cleanup() {
  printf "Cleaning up... killing server PID %s\n" "$SERVER_PID"
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT

printf "[3/4] Polling GET /health... "
HEALTH_OK=0
for i in {1..20}; do
  if curl -sf http://localhost:8080/health >/dev/null; then
    HEALTH_OK=1
    break
  fi
  sleep 0.5
done

if [[ $HEALTH_OK -eq 0 ]]; then
  printf "FAILED\n"
  cat server.log
  printf "SMOKE FAILED\n"
  exit 1
fi
printf "ok\n"

printf "[4/4] Opening WS connection and awaiting hello... "
if ! bun -e 'const ws = new WebSocket("ws://localhost:8080/ws"); const t = setTimeout(()=>process.exit(1), 3000); ws.onmessage = e => { if (e.data.includes("\"hello\"")) { clearTimeout(t); ws.close(); process.exit(0); } }; ws.onerror = () => process.exit(1);' >/dev/null 2>&1; then
  printf "FAILED\n"
  printf "SMOKE FAILED\n"
  exit 1
fi
printf "ok\n"

printf "\n%s\n" "$HEADER"
printf "SMOKE OK\n"
printf "%s\n" "$HEADER"
exit 0
