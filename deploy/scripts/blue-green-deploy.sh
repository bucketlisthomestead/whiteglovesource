#!/usr/bin/env bash
# Blue/green deploy orchestrator: candidate -> deploy -> verify -> promote.
#
# Usage:
#   ./deploy/scripts/blue-green-deploy.sh [--skip-verify] [--terminate-old]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SKIP_VERIFY=false
TERMINATE_OLD=false

for arg in "$@"; do
  case "$arg" in
    --skip-verify) SKIP_VERIFY=true ;;
    --terminate-old) TERMINATE_OLD=true ;;
    -h|--help)
      echo "Usage: $0 [--skip-verify] [--terminate-old]"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg"
      exit 1
      ;;
  esac
done

echo "=== Step 1: Launch candidate ==="
LAUNCH_OUT=$("$ROOT/deploy/scripts/launch-candidate.sh")
echo "$LAUNCH_OUT"

CANDIDATE_ID=$(echo "$LAUNCH_OUT" | sed -n 's/^CANDIDATE_INSTANCE_ID=//p' | tail -1)
CANDIDATE_IP=$(echo "$LAUNCH_OUT" | sed -n 's/^CANDIDATE_PUBLIC_IP=//p' | tail -1)

if [[ -z "$CANDIDATE_ID" ]]; then
  echo "Failed to resolve candidate instance id."
  exit 1
fi

echo ""
echo "=== Step 2: Deploy app to candidate $CANDIDATE_ID ==="
"$ROOT/deploy/scripts/push-and-deploy-ssm.sh" "$CANDIDATE_ID"

echo ""
echo "=== Step 3: Wait for candidate HTTP ==="
for i in $(seq 1 30); do
  if curl -sf "http://${CANDIDATE_IP}/api/health" >/dev/null 2>&1; then
    echo "Candidate health check OK."
    break
  fi
  if [[ "$i" -eq 30 ]]; then
    echo "Timed out waiting for http://${CANDIDATE_IP}/api/health"
    exit 1
  fi
  sleep 10
done

if [[ "$SKIP_VERIFY" == false ]]; then
  echo ""
  echo "=== Step 4: Playwright smoke tests ==="
  "$ROOT/deploy/scripts/verify-candidate.sh" "$CANDIDATE_IP"
else
  echo ""
  echo "=== Step 4: Skipped (--skip-verify) ==="
fi

echo ""
echo "=== Step 5: Promote candidate ==="
PROMOTE_ARGS=()
[[ "$TERMINATE_OLD" == true ]] && PROMOTE_ARGS+=(--terminate-old)
"$ROOT/deploy/scripts/promote-candidate.sh" "${PROMOTE_ARGS[@]}"

echo ""
echo "Blue/green deploy finished."
