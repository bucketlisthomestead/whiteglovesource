#!/usr/bin/env bash
# Shared CloudFormation output helpers for WgsStack deploy scripts.
set -euo pipefail

STACK_NAME="${WGS_STACK_NAME:-WgsStack}"
REGION="${AWS_REGION:-us-east-1}"

wgs_stack_output() {
  local key="$1"
  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='${key}'].OutputValue" \
    --output text \
    --region "$REGION"
}

wgs_deploy_state_file() {
  local root
  root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  echo "${WGS_DEPLOY_STATE:-$root/deploy/.deploy-state.json}"
}

wgs_read_deploy_state() {
  local file
  file="$(wgs_deploy_state_file)"
  if [[ -f "$file" ]]; then
    cat "$file"
  else
    echo '{}'
  fi
}

wgs_write_deploy_state() {
  local json="$1"
  local file
  file="$(wgs_deploy_state_file)"
  mkdir -p "$(dirname "$file")"
  echo "$json" > "$file"
}

wgs_find_instance_by_role() {
  local role="$1"
  aws ec2 describe-instances \
    --filters \
      "Name=tag:wgs-role,Values=${role}" \
      "Name=instance-state-name,Values=running,pending,stopping,stopped" \
    --query 'Reservations[].Instances[] | sort_by(@, &LaunchTime) | [-1].InstanceId' \
    --output text \
    --region "$REGION"
}

wgs_instance_public_ip() {
  local instance_id="$1"
  aws ec2 describe-instances \
    --instance-ids "$instance_id" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text \
    --region "$REGION"
}

wgs_build_user_data() {
  local region="$1"
  local bucket="$2"
  local db_secret_arn="$3"
  local jwt_secret_arn="$4"
  local rds_endpoint="$5"
  local root
  root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  local script
  script="$(cat "$root/deploy/scripts/user-data.sh")"
  cat <<EOF
export AWS_REGION=${region}
export WGS_BUCKET=${bucket}
export WGS_DB_SECRET_ARN=${db_secret_arn}
export WGS_JWT_SECRET_ARN=${jwt_secret_arn}
export WGS_RDS_ENDPOINT=${rds_endpoint}
${script}
EOF
}
