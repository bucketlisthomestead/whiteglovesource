#!/usr/bin/env bash
# Launch a candidate EC2 instance (same config as active, no Elastic IP).
#
# Usage: ./deploy/scripts/launch-candidate.sh
#
# Outputs candidate instance id and public IP; updates deploy/.deploy-state.json
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=lib/stack-outputs.sh
source "$ROOT/deploy/scripts/lib/stack-outputs.sh"

REGION="${AWS_REGION:-us-east-1}"
APP_NAME="$(wgs_stack_output AppName)"
BUCKET="$(wgs_stack_output BucketName)"
JWT_SECRET_ARN="$(wgs_stack_output JwtSecretArn)"
PG_ENDPOINT="$(wgs_postgres_endpoint)"
PG_SECRET_ARN="$(wgs_pg_secret_arn)"
SG_ID="$(wgs_stack_output InstanceSecurityGroupId)"
ROLE_NAME="$(wgs_stack_output InstanceProfileName)"
INSTANCE_TYPE="${WGS_INSTANCE_TYPE:-t4g.small}"

ACTIVE_ID="$(wgs_find_instance_by_role active)"
if [[ -z "$ACTIVE_ID" || "$ACTIVE_ID" == "None" ]]; then
  ACTIVE_ID="$(wgs_stack_output InstanceId)"
fi

if [[ -z "$ACTIVE_ID" || "$ACTIVE_ID" == "None" ]]; then
  echo "Could not resolve active instance id."
  exit 1
fi

SUBNET_ID=$(aws ec2 describe-instances \
  --instance-ids "$ACTIVE_ID" \
  --query 'Reservations[0].Instances[0].SubnetId' \
  --output text \
  --region "$REGION")

AMI_ID=$(aws ec2 describe-instances \
  --instance-ids "$ACTIVE_ID" \
  --query 'Reservations[0].Instances[0].ImageId' \
  --output text \
  --region "$REGION")

EXISTING_CANDIDATE="$(wgs_find_instance_by_role candidate)"
if [[ -n "$EXISTING_CANDIDATE" && "$EXISTING_CANDIDATE" != "None" ]]; then
  STATE=$(aws ec2 describe-instances \
    --instance-ids "$EXISTING_CANDIDATE" \
    --query 'Reservations[0].Instances[0].State.Name' \
    --output text \
    --region "$REGION")
  if [[ "$STATE" == "running" || "$STATE" == "pending" ]]; then
    REUSE_CANDIDATE=true
    if [[ "$(wgs_ssm_ping_status "$EXISTING_CANDIDATE")" == "Online" ]] \
      && wgs_candidate_userdata_corrupt "$EXISTING_CANDIDATE"; then
      echo "Candidate $EXISTING_CANDIDATE: cloud-init rejected user-data (bootstrap will never finish)."
      echo "  Cleaning up broken candidate and launching a fresh one (one-time if prior deploy used bad user-data)."
      [[ -n "${WGS_USERDATA_CORRUPT_REASON:-}" ]] && echo "  ${WGS_USERDATA_CORRUPT_REASON}"
      echo "  Terminating $EXISTING_CANDIDATE ..."
      aws ec2 terminate-instances --instance-ids "$EXISTING_CANDIDATE" --region "$REGION" >/dev/null
      aws ec2 wait instance-terminated --instance-ids "$EXISTING_CANDIDATE" --region "$REGION" 2>/dev/null \
        || sleep 30
      REUSE_CANDIDATE=false
    fi
    if [[ "$REUSE_CANDIDATE" == true ]]; then
      CAND_IP="$(wgs_instance_public_ip "$EXISTING_CANDIDATE")"
      echo "Reusing existing candidate: $EXISTING_CANDIDATE ($CAND_IP)"
      wgs_write_deploy_state "$(jq -n \
        --arg active "$ACTIVE_ID" \
        --arg candidate "$EXISTING_CANDIDATE" \
        --arg candIp "$CAND_IP" \
        --arg eip "$(wgs_stack_output ElasticIp)" \
        '{activeInstanceId:$active,candidateInstanceId:$candidate,candidatePublicIp:$candIp,elasticIp:$eip}')"
      echo "CANDIDATE_INSTANCE_ID=$EXISTING_CANDIDATE"
      echo "CANDIDATE_PUBLIC_IP=$CAND_IP"
      exit 0
    fi
  fi
  if [[ "$STATE" == "stopped" ]]; then
    echo "Starting stopped candidate $EXISTING_CANDIDATE ..."
    aws ec2 start-instances --instance-ids "$EXISTING_CANDIDATE" --region "$REGION" >/dev/null
    aws ec2 wait instance-running --instance-ids "$EXISTING_CANDIDATE" --region "$REGION"
    CAND_IP="$(wgs_instance_public_ip "$EXISTING_CANDIDATE")"
    wgs_write_deploy_state "$(jq -n \
      --arg active "$ACTIVE_ID" \
      --arg candidate "$EXISTING_CANDIDATE" \
      --arg candIp "$CAND_IP" \
      --arg eip "$(wgs_stack_output ElasticIp)" \
      '{activeInstanceId:$active,candidateInstanceId:$candidate,candidatePublicIp:$candIp,elasticIp:$eip}')"
    echo "CANDIDATE_INSTANCE_ID=$EXISTING_CANDIDATE"
    echo "CANDIDATE_PUBLIC_IP=$CAND_IP"
    exit 0
  fi
fi

USER_DATA="$(wgs_build_user_data "$REGION" "$BUCKET" "$JWT_SECRET_ARN" "$PG_ENDPOINT" "$PG_SECRET_ARN")" \
  || { echo "Failed to build EC2 user-data (see errors above)."; exit 1; }

echo "Launching candidate instance (type=$INSTANCE_TYPE, subnet=$SUBNET_ID) ..."
INSTANCE_ID=$(aws ec2 run-instances \
  --image-id "$AMI_ID" \
  --instance-type "$INSTANCE_TYPE" \
  --subnet-id "$SUBNET_ID" \
  --security-group-ids "$SG_ID" \
  --iam-instance-profile "Name=${ROLE_NAME}" \
  --user-data "$USER_DATA" \
  --block-device-mappings '[{"DeviceName":"/dev/xvda","Ebs":{"VolumeSize":30,"VolumeType":"gp3","Encrypted":true}}]' \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=${APP_NAME}-app-candidate},{Key=wgs-role,Value=candidate},{Key=wgs-app,Value=${APP_NAME}}]" \
  --query 'Instances[0].InstanceId' \
  --output text \
  --region "$REGION")

echo "Waiting for candidate $INSTANCE_ID to enter running state ..."
aws ec2 wait instance-running --instance-ids "$INSTANCE_ID" --region "$REGION"

CAND_IP="$(wgs_instance_public_ip "$INSTANCE_ID")"
EIP="$(wgs_stack_output ElasticIp)"

wgs_write_deploy_state "$(jq -n \
  --arg active "$ACTIVE_ID" \
  --arg candidate "$INSTANCE_ID" \
  --arg candIp "$CAND_IP" \
  --arg eip "$EIP" \
  '{activeInstanceId:$active,candidateInstanceId:$candidate,candidatePublicIp:$candIp,elasticIp:$eip}')"

echo ""
echo "Candidate launched."
echo "CANDIDATE_INSTANCE_ID=$INSTANCE_ID"
echo "CANDIDATE_PUBLIC_IP=$CAND_IP"
echo "Deploy with: ./deploy/scripts/push-and-deploy-ssm.sh $INSTANCE_ID"
