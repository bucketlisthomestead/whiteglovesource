#!/usr/bin/env bash
# Promote candidate: swap Elastic IP, tag roles, stop old active instance.
#
# Usage:
#   ./deploy/scripts/promote-candidate.sh [--terminate-old]
#
# Only run after verify-candidate.sh (or blue-green health wait) succeeds.
# Expect a brief EIP reassociation blip (~seconds); the old instance serves
# until disassociation, then the candidate receives live traffic.
#
# Keeps the previous active instance stopped by default (rollback: restart + EIP swap back).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=lib/stack-outputs.sh
source "$ROOT/deploy/scripts/lib/stack-outputs.sh"

REGION="${AWS_REGION:-us-east-1}"
TERMINATE_OLD=false

for arg in "$@"; do
  case "$arg" in
    --terminate-old) TERMINATE_OLD=true ;;
    -h|--help)
      echo "Usage: $0 [--terminate-old]"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg"
      exit 1
      ;;
  esac
done

STATE="$(wgs_read_deploy_state)"
ACTIVE_ID=$(echo "$STATE" | jq -r '.activeInstanceId // empty')
CANDIDATE_ID=$(echo "$STATE" | jq -r '.candidateInstanceId // empty')
EIP=$(echo "$STATE" | jq -r '.elasticIp // empty')

if [[ -z "$CANDIDATE_ID" || "$CANDIDATE_ID" == "null" ]]; then
  CANDIDATE_ID="$(wgs_find_instance_by_role candidate)"
fi
if [[ -z "$ACTIVE_ID" || "$ACTIVE_ID" == "null" ]]; then
  ACTIVE_ID="$(wgs_find_instance_by_role active)"
fi
if [[ -z "$EIP" || "$EIP" == "null" ]]; then
  EIP="$(wgs_stack_output ElasticIp)"
fi

if [[ -z "$CANDIDATE_ID" || "$CANDIDATE_ID" == "None" ]]; then
  echo "No candidate instance found."
  exit 1
fi
if [[ -z "$ACTIVE_ID" || "$ACTIVE_ID" == "None" ]]; then
  echo "No active instance found."
  exit 1
fi
if [[ "$ACTIVE_ID" == "$CANDIDATE_ID" ]]; then
  echo "Active and candidate are the same instance ($ACTIVE_ID)."
  exit 1
fi

echo "Pre-flight: verifying candidate bootstrap and health ..."
CAND_IP="$(wgs_instance_public_ip "$CANDIDATE_ID")"
if [[ -z "$CAND_IP" || "$CAND_IP" == "None" ]]; then
  echo "Could not resolve candidate public IP for $CANDIDATE_ID."
  exit 1
fi

if wgs_candidate_userdata_corrupt "$CANDIDATE_ID"; then
  echo "ERROR: Candidate user-data/bootstrap is broken on $CANDIDATE_ID."
  [[ -n "${WGS_USERDATA_CORRUPT_REASON:-}" ]] && echo "  ${WGS_USERDATA_CORRUPT_REASON}"
  echo "  Terminate the candidate and re-run blue-green deploy."
  exit 1
fi

if ! wgs_ssm_run_shell "$CANDIDATE_ID" \
  'test -f /opt/wgs/.env && echo ready || echo missing' 90 \
  || [[ "${WGS_SSM_STDOUT:-}" != *ready* ]]; then
  echo "ERROR: Candidate bootstrap incomplete (/opt/wgs/.env missing on $CANDIDATE_ID)."
  echo "  Run: ./deploy/scripts/push-and-deploy-ssm.sh $CANDIDATE_ID"
  exit 1
fi

if ! curl -sf --max-time 10 "http://${CAND_IP}/api/health" >/dev/null 2>&1; then
  echo "ERROR: Candidate health check failed at http://${CAND_IP}/api/health"
  echo "  Fix the candidate before promoting live traffic."
  exit 1
fi
echo "Candidate pre-flight OK (http://${CAND_IP}/api/health)."

ALLOC_ID=$(aws ec2 describe-addresses \
  --public-ips "$EIP" \
  --query 'Addresses[0].AllocationId' \
  --output text \
  --region "$REGION")

if [[ -z "$ALLOC_ID" || "$ALLOC_ID" == "None" ]]; then
  echo "Could not find allocation id for Elastic IP $EIP"
  exit 1
fi

CAND_IP="$(wgs_instance_public_ip "$CANDIDATE_ID")"
echo "=== Preflight: verify candidate before moving live traffic ==="
if ! wgs_verify_candidate_ready "$CANDIDATE_ID" "$CAND_IP"; then
  echo ""
  echo "Promotion aborted — live site stays on $ACTIVE_ID ($EIP)."
  echo "Fix the candidate, then re-run promote. With --terminate-old, the old instance is NOT removed until preflight passes."
  exit 1
fi

echo ""
echo "Disassociating EIP $EIP from $ACTIVE_ID ..."
ASSOC_ID=$(aws ec2 describe-addresses \
  --public-ips "$EIP" \
  --query 'Addresses[0].AssociationId' \
  --output text \
  --region "$REGION" 2>/dev/null || true)

if [[ -n "$ASSOC_ID" && "$ASSOC_ID" != "None" ]]; then
  aws ec2 disassociate-address --association-id "$ASSOC_ID" --region "$REGION"
fi

echo "Associating EIP $EIP with candidate $CANDIDATE_ID ..."
aws ec2 associate-address \
  --allocation-id "$ALLOC_ID" \
  --instance-id "$CANDIDATE_ID" \
  --region "$REGION" >/dev/null

aws ec2 create-tags \
  --resources "$CANDIDATE_ID" \
  --tags "Key=wgs-role,Value=active" "Key=Name,Value=$(wgs_stack_output AppName)-app-active" \
  --region "$REGION"

aws ec2 create-tags \
  --resources "$ACTIVE_ID" \
  --tags "Key=wgs-role,Value=retired" "Key=Name,Value=$(wgs_stack_output AppName)-app-retired" \
  --region "$REGION"

if [[ "$TERMINATE_OLD" == true ]]; then
  echo "Terminating retired instance $ACTIVE_ID ..."
  aws ec2 terminate-instances --instance-ids "$ACTIVE_ID" --region "$REGION" >/dev/null
else
  echo "Stopping retired instance $ACTIVE_ID (keep for rollback) ..."
  aws ec2 stop-instances --instance-ids "$ACTIVE_ID" --region "$REGION" >/dev/null
fi

wgs_write_deploy_state "$(jq -n \
  --arg active "$CANDIDATE_ID" \
  --arg retired "$ACTIVE_ID" \
  --arg eip "$EIP" \
  '{activeInstanceId:$active,retiredInstanceId:$retired,elasticIp:$eip}')"

echo ""
echo "Promotion complete."
echo "Active instance: $CANDIDATE_ID"
echo "Live URL: http://$EIP/"
echo "Retired instance: $ACTIVE_ID (stopped; restart and swap EIP to roll back)"
