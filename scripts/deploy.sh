#!/usr/bin/env bash
#
# scripts/deploy.sh — Phase 1 Plan 03 pre-flight for Fly.io deploy
#
# PURPOSE
#   This script BUILDS the deploy infrastructure artifacts (Dockerfile,
#   fly.toml, .dockerignore). It does NOT execute `fly deploy` — Phase 6
#   owns the actual Fly.io account setup, `fly auth login`, and live
#   `fly deploy` invocation. If you ran this script during Phase 1, it
#   prints what would happen and exits 0. That is the intended behavior.
#
# USAGE
#   ./scripts/deploy.sh            # pre-flight checks + would-be deploy print
#   ./scripts/deploy.sh --dry-run  # alias; same behavior
#
# EXIT CODES
#   0 — all pre-flight checks passed; nothing deployed (by design)
#   1 — a pre-flight check failed (missing tool, missing file, missing build)
#
# WHY NO AUTO-DEPLOY
#   Phase 1 is the foundation. There is no Fly.io account, no `fly` CLI,
#   no card on file. Auto-deploying here would either fail (no fly) or,
#   worse, succeed against the wrong account. Phase 6 will run the actual
#   `fly deploy --strategy immediate --remote-only` after Phase 5 polish
#   lands and the operator has confirmed the account / region / name.

set -euo pipefail

readonly HEADER="=========================================================="
readonly APP_NAME="typing-race"
readonly REGION="ord"
readonly WOULD_DEPLOY_CMD="fly deploy --strategy immediate --remote-only"

printf "%s\n" "$HEADER"
printf "Phase 1 Plan 03 — pre-flight for Fly.io deploy\n"
printf "%s\n" "$HEADER"
printf "\n"
printf "This script validates deploy prerequisites. It does NOT run\n"
printf "  %s\n" "$WOULD_DEPLOY_CMD"
printf "That command is owned by Phase 6.\n"
printf "\n"

fail=0

printf "[1/5] checking docker ... "
if command -v docker >/dev/null 2>&1; then
  printf "ok (%s)\n" "$(docker --version 2>/dev/null | head -1)"
else
  printf "MISSING\n"
  fail=1
fi

printf "[2/5] checking bun ... "
if command -v bun >/dev/null 2>&1; then
  printf "ok (%s)\n" "$(bun --version 2>/dev/null)"
else
  printf "MISSING\n"
  fail=1
fi

printf "[3/5] checking Dockerfile ... "
if [[ -f Dockerfile ]]; then
  printf "ok\n"
else
  printf "MISSING\n"
  fail=1
fi

printf "[4/5] checking fly.toml ... "
if [[ -f fly.toml ]]; then
  printf "ok\n"
else
  printf "MISSING\n"
  fail=1
fi

printf "[5/5] checking apps/web/dist/index.html ... "
if [[ -f apps/web/dist/index.html ]]; then
  printf "ok\n"
else
  printf "MISSING\n"
  printf "       run: bun --filter 'apps/web' run build  (or cd apps/web && bun run build)\n"
  fail=1
fi

printf "\n"
if [[ $fail -ne 0 ]]; then
  printf "%s\n" "$HEADER"
  printf "PRE-FLIGHT FAILED — fix the lines marked MISSING above.\n"
  printf "%s\n" "$HEADER"
  exit 1
fi

printf "All pre-flight checks passed.\n"
printf "\n"
printf -- "--- Would deploy (NOT executed) ---\n"
printf "App           : %s\n" "$APP_NAME"
printf "Primary region: %s\n" "$REGION"
printf "Dockerfile    : Dockerfile\n"
printf "Strategy      : immediate (atomic, in-flight races terminate — acceptable for v1 demo)\n"
printf "Build command : docker build -t %s:deploy .\n" "$APP_NAME"
printf "Deploy command: %s\n" "$WOULD_DEPLOY_CMD"
printf "\n"
printf -- "- Phase 6 prerequisites (run BEFORE the deploy command) -\n"
printf "  fly auth login                  # authenticate the fly CLI\n"
printf "  add card at fly.io/dashboard    # required even for free tier\n"
printf -- "  fly launch --no-deploy          # (only if first deploy) creates app\n"
printf "\n"
printf "If app name '%s' is taken, rename in fly.toml and re-run.\n" "$APP_NAME"
printf "\n"
printf "%s\n" "$HEADER"
printf "Pre-flight complete. Exit 0 \xe2\x80\x94 no deploy attempted (by design).\n"
printf "%s\n" "$HEADER"
exit 0