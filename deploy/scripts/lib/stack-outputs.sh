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
  echo "${WGS_DEPLOY_STATE:-$root/.deploy-state.json}"
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
  # cloud-init requires #!/bin/bash on line 1 (CDK UserData.forLinux() does this; run-instances does not).
  cat <<EOF
#!/bin/bash
export AWS_REGION=${region}
export WGS_BUCKET=${bucket}
export WGS_DB_SECRET_ARN=${db_secret_arn}
export WGS_JWT_SECRET_ARN=${jwt_secret_arn}
export WGS_RDS_ENDPOINT=${rds_endpoint}
${script}
EOF
}

wgs_ssm_ping_status() {
  local instance_id="$1"
  aws ssm describe-instance-information \
    --filters "Key=InstanceIds,Values=${instance_id}" \
    --query 'InstanceInformationList[0].PingStatus' \
    --output text \
    --region "$REGION" 2>/dev/null || echo "None"
}

# Run a shell command on an instance via SSM and wait for completion.
# Sets WGS_SSM_STATUS, WGS_SSM_STDOUT, WGS_SSM_STDERR. Returns 0 on Success.
wgs_ssm_run_shell() {
  local instance_id="$1"
  local command="$2"
  local poll_timeout="${3:-120}"

  local command_id
  command_id=$(aws ssm send-command \
    --instance-ids "$instance_id" \
    --document-name AWS-RunShellScript \
    --parameters "$(jq -n --arg cmd "$command" '{commands:[$cmd]}')" \
    --query Command.CommandId \
    --output text \
    --region "$REGION")

  local elapsed=0
  while [[ "$elapsed" -lt "$poll_timeout" ]]; do
    local status
    status=$(aws ssm get-command-invocation \
      --command-id "$command_id" \
      --instance-id "$instance_id" \
      --query Status \
      --output text \
      --region "$REGION" 2>/dev/null || echo Pending)

    case "$status" in
      Success|Failed|Cancelled|TimedOut)
        WGS_SSM_STATUS="$status"
        WGS_SSM_STDOUT=$(aws ssm get-command-invocation \
          --command-id "$command_id" \
          --instance-id "$instance_id" \
          --query StandardOutputContent \
          --output text \
          --region "$REGION" 2>/dev/null || true)
        WGS_SSM_STDERR=$(aws ssm get-command-invocation \
          --command-id "$command_id" \
          --instance-id "$instance_id" \
          --query StandardErrorContent \
          --output text \
          --region "$REGION" 2>/dev/null || true)
        [[ "$status" == "Success" ]]
        return
        ;;
    esac
    sleep 2
    elapsed=$((elapsed + 2))
  done

  WGS_SSM_STATUS=TimedOut
  WGS_SSM_STDOUT=""
  WGS_SSM_STDERR=""
  return 1
}

# True when cloud-init rejected user-data (missing shebang, double-base64, etc.).
# Sets WGS_USERDATA_CORRUPT_REASON when true (snippet from cloud-init-output.log).
wgs_candidate_userdata_corrupt() {
  local instance_id="$1"
  WGS_USERDATA_CORRUPT_REASON=""
  if ! wgs_ssm_run_shell "$instance_id" \
    'if grep -q "Unhandled non-multipart" /var/log/cloud-init-output.log 2>/dev/null; then
  grep -m1 "Unhandled non-multipart" /var/log/cloud-init-output.log
  echo corrupt
else
  echo ok
fi' 60; then
    return 1
  fi
  if [[ "$WGS_SSM_STDOUT" == *corrupt* ]]; then
    WGS_USERDATA_CORRUPT_REASON=$(echo "$WGS_SSM_STDOUT" | grep "Unhandled non-multipart" | head -1)
    return 0
  fi
  return 1
}
