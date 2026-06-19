#!/usr/bin/env bash
# Run Playwright deploy smoke tests against a candidate instance.
#
# Usage:
#   ./deploy/scripts/verify-candidate.sh [candidate-public-ip-or-host]
#
# Reads candidate IP from deploy/.deploy-state.json if not passed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=lib/stack-outputs.sh
source "$ROOT/deploy/scripts/lib/stack-outputs.sh"

CAND_HOST="${1:-}"

if [[ -z "$CAND_HOST" ]]; then
  STATE="$(wgs_read_deploy_state)"
  CAND_ID=$(echo "$STATE" | jq -r '.candidateInstanceId // empty')
  if [[ -n "$CAND_ID" ]]; then
    CAND_HOST="$(wgs_instance_public_ip "$CAND_ID")"
  fi
fi

if [[ -z "$CAND_HOST" || "$CAND_HOST" == "None" ]]; then
  echo "Usage: $0 [candidate-public-ip]"
  echo "Or launch a candidate first: ./deploy/scripts/launch-candidate.sh"
  exit 1
fi

BASE_URL="http://${CAND_HOST}"
echo "Running deploy smoke tests against $BASE_URL ..."

if [[ ! -d "$ROOT/e2e/node_modules" ]]; then
  echo "Installing Playwright (first run) ..."
  npm run walkthrough:install --prefix "$ROOT"
fi

cd "$ROOT/e2e"
BASE_URL="$BASE_URL" npx playwright test deploy-smoke.spec.ts --config playwright.deploy.config.ts

echo ""
echo "Smoke tests passed for $BASE_URL"
