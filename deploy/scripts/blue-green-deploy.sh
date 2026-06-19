#!/usr/bin/env bash
# Blue/green deploy orchestrator: candidate -> deploy -> verify -> promote.
#
# Use this for zero-downtime app deploys. In-place push-and-deploy-ssm.sh always
# recreates the API container on the live instance (~30s–2min blip via nginx 502).
#
# Usage:
#   ./deploy/scripts/blue-green-deploy.sh [--skip-verify] [--terminate-old]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=lib/stack-outputs.sh
source "$ROOT/deploy/scripts/lib/stack-outputs.sh"
SKIP_VERIFY=false
TERMINATE_OLD=false

for arg in "$@"; do
  case "$arg" in
    --skip-verify) SKIP_VERIFY=true ;;
    --terminate-old) TERMINATE_OLD=true ;;
    -h|--help)
      cat <<EOF
Usage: $0 [--skip-verify] [--terminate-old]

  --skip-verify    Skip Playwright smoke tests before promote
  --terminate-old  After a successful promote, terminate (not just stop) the
                   retired instance. Without this flag the retired instance is
                   stopped but left recoverable.

If deploy fails before promote (bootstrap, health check, verify), the candidate
instance is left running for inspection; terminate it manually when done.
EOF
      exit 0
      ;;
    *)
      echo "Unknown option: $arg"
      exit 1
      ;;
  esac
done

echo "=== Step 1: Launch candidate ==="
# Do not capture stdout in $() — that buffers all output until launch finishes (minutes of silence).
"$ROOT/deploy/scripts/launch-candidate.sh"

STATE_FILE="$(wgs_deploy_state_file)"
CANDIDATE_ID=$(jq -r '.candidateInstanceId // empty' "$STATE_FILE" 2>/dev/null || true)
CANDIDATE_IP=$(jq -r '.candidatePublicIp // empty' "$STATE_FILE" 2>/dev/null || true)
if [[ -z "$CANDIDATE_IP" && -n "$CANDIDATE_ID" ]]; then
  CANDIDATE_IP="$(wgs_instance_public_ip "$CANDIDATE_ID")"
fi

if [[ -z "$CANDIDATE_ID" ]]; then
  echo "Failed to resolve candidate instance id."
  exit 1
fi

REGION="${AWS_REGION:-us-east-1}"

echo ""
echo "=== Step 1b: Wait for candidate SSM + bootstrap ==="
for i in $(seq 1 60); do
  PING="$(wgs_ssm_ping_status "$CANDIDATE_ID")"
  if [[ "$PING" == "Online" ]]; then
    echo "SSM agent online on $CANDIDATE_ID."
    break
  fi
  if [[ "$i" -eq 60 ]]; then
    echo "Timed out waiting for SSM on $CANDIDATE_ID (PingStatus=$PING)."
    exit 1
  fi
  echo "  waiting for SSM agent... (${i}/60, PingStatus=${PING})"
  sleep 10
done

if wgs_candidate_userdata_corrupt "$CANDIDATE_ID"; then
  echo ""
  echo "ERROR: Candidate user-data was not executed (cloud-init rejected it)."
  echo "  Common causes: missing #!/bin/bash on line 1, or legacy double-base64 encoding."
  [[ -n "${WGS_USERDATA_CORRUPT_REASON:-}" ]] && echo "  ${WGS_USERDATA_CORRUPT_REASON}"
  echo "  Terminate the candidate and re-run deploy (launch-candidate.sh will also auto-clean on retry):"
  echo "    aws ec2 terminate-instances --instance-ids $CANDIDATE_ID --region $REGION"
  echo "    ./deploy/scripts/blue-green-deploy.sh"
  exit 1
fi

wgs_show_bootstrap_diagnostics() {
  if ! wgs_ssm_run_shell "$CANDIDATE_ID" \
    'echo "cloud-init: $(cloud-init status 2>/dev/null || echo unknown)"; \
if [[ -f /var/log/wgs-user-data.log ]]; then echo "--- wgs-user-data.log (last 15 lines) ---"; tail -15 /var/log/wgs-user-data.log; \
elif [[ -f /var/log/cloud-init-output.log ]]; then echo "--- cloud-init-output.log (last 15 lines) ---"; tail -15 /var/log/cloud-init-output.log; \
else echo "no user-data log yet"; fi' 90; then
    echo "  (diagnostics unavailable: SSM command ${WGS_SSM_STATUS:-TimedOut})"
    return
  fi
  echo "$WGS_SSM_STDOUT" | sed 's/^/  /'
  [[ -n "${WGS_SSM_STDERR:-}" ]] && echo "  stderr: $WGS_SSM_STDERR"
}

BOOTSTRAP_OK=false
for i in $(seq 1 60); do
  if wgs_ssm_run_shell "$CANDIDATE_ID" \
    'test -f /opt/wgs/.env && echo ready || echo waiting' 90 \
    && [[ "$WGS_SSM_STDOUT" == *ready* ]]; then
    echo "Candidate bootstrap complete (/opt/wgs/.env present)."
    BOOTSTRAP_OK=true
    break
  fi

  OUT="${WGS_SSM_STDOUT:-}"
  STATUS="${WGS_SSM_STATUS:-unknown}"
  if [[ "$i" -eq 60 ]]; then
    echo ""
    echo "Timed out waiting for candidate user-data (/opt/wgs/.env)."
    echo "Last SSM check: status=${STATUS}, output=${OUT:-none}"
    echo ""
    echo "Bootstrap diagnostics:"
    wgs_show_bootstrap_diagnostics
    exit 1
  fi

  echo "  waiting for user-data bootstrap... (${i}/60, ssm=${STATUS}, check=${OUT:-none})"
  if (( i == 1 || i % 5 == 0 )); then
    echo "  --- bootstrap diagnostics (${i}/60) ---"
    wgs_show_bootstrap_diagnostics
  fi
  sleep 15
done
[[ "$BOOTSTRAP_OK" == true ]] || exit 1

echo ""
echo "=== Step 2: Deploy app to candidate $CANDIDATE_ID ==="
"$ROOT/deploy/scripts/push-and-deploy-ssm.sh" "$CANDIDATE_ID"

echo ""
echo "=== Step 3: Wait for candidate HTTP health ==="
HEALTH_OK=false
for i in $(seq 1 36); do
  if curl -sf "http://${CANDIDATE_IP}/api/health" >/dev/null 2>&1; then
    echo "Candidate health check OK at http://${CANDIDATE_IP}/api/health"
    HEALTH_OK=true
    break
  fi
  echo "  waiting for http://${CANDIDATE_IP}/api/health ... (${i}/36)"
  sleep 5
done
if [[ "$HEALTH_OK" != true ]]; then
  echo "Timed out waiting for http://${CANDIDATE_IP}/api/health — not promoting."
  exit 1
fi

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
