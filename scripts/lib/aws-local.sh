#!/usr/bin/env bash
# AWS CLI wrapper for LocalStack (awslocal or aws --endpoint-url).
set -euo pipefail

LOCALSTACK_ENDPOINT="${LOCALSTACK_ENDPOINT:-http://localhost:4566}"
AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-test}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-test}"
export AWS_DEFAULT_REGION="$AWS_REGION"

aws_local() {
  if command -v awslocal &>/dev/null; then
    awslocal "$@"
  else
    aws --endpoint-url="$LOCALSTACK_ENDPOINT" "$@"
  fi
}

wait_for_localstack() {
  local max="${1:-60}"
  echo "==> Waiting for LocalStack at $LOCALSTACK_ENDPOINT ..."
  for ((i = 1; i <= max; i++)); do
    if curl -sf "$LOCALSTACK_ENDPOINT/_localstack/health" >/dev/null 2>&1; then
      echo "    LocalStack is ready."
      return 0
    fi
    sleep 2
  done
  echo "ERROR: LocalStack did not become healthy within $((max * 2))s." >&2
  return 1
}
