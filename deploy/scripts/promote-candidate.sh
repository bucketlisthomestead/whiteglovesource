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

ALLOC_ID=$(aws ec2 describe-addresses \
  --public-ips "$EIP" \
  --query 'Addresses[0].AllocationId' \
  --output text \
  --region "$REGION")

if [[ -z "$ALLOC_ID" || "$ALLOC_ID" == "None" ]]; then
  echo "Could not find allocation id for Elastic IP $EIP"
  exit 1
fi

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
