#!/usr/bin/env bash
# Provision LocalStack resources to mirror production (S3 bucket + Secrets Manager).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/lib/aws-local.sh
source "$ROOT/scripts/lib/aws-local.sh"
# shellcheck source=scripts/lib/load-dev-env.sh
source "$ROOT/scripts/lib/load-dev-env.sh"
load_dev_env "$ROOT"

BUCKET="${WGS_LOCAL_BUCKET:-wgs-local-app}"
DB_SECRET_NAME="${WGS_DB_SECRET_NAME:-wgs/db}"
JWT_SECRET_NAME="${WGS_JWT_SECRET_NAME:-wgs/jwt}"
DB_PASSWORD="${WGS_LOCAL_DB_PASSWORD:-${DB_PASSWORD:-}}"
JWT_SECRET="${WGS_LOCAL_JWT_SECRET:-localstack-dev-jwt-secret-change-me}"

if [[ -z "$DB_PASSWORD" ]]; then
  echo "ERROR: DB_PASSWORD (or WGS_LOCAL_DB_PASSWORD) is required. Set it in .env.localstack or .env." >&2
  exit 1
fi

wait_for_localstack 60

if command -v jq &>/dev/null; then
  LS_META="$(curl -sf "${LOCALSTACK_ENDPOINT}/_localstack/health" 2>/dev/null || true)"
  if [[ -n "$LS_META" ]]; then
    echo "    Target: ${LOCALSTACK_ENDPOINT} ($(echo "$LS_META" | jq -r '.edition // "community"') $(echo "$LS_META" | jq -r '.version // "unknown"'), persistence: $(echo "$LS_META" | jq -r '.features.persistence // "unknown"'))"
  fi
fi

echo "==> Ensuring S3 bucket s3://${BUCKET} ..."
if aws_local s3 ls "s3://${BUCKET}" >/dev/null 2>&1; then
  echo "    Bucket already exists."
else
  aws_local s3 mb "s3://${BUCKET}"
fi

if [[ -d "$ROOT/content" ]]; then
  echo "==> Seeding CMS content/ to s3://${BUCKET}/content/ ..."
  aws_local s3 sync "$ROOT/content/" "s3://${BUCKET}/content/" --delete
else
  echo "==> No content/ directory found; skipping CMS seed."
fi

create_or_update_secret() {
  local name="$1"
  local payload="$2"
  if aws_local secretsmanager describe-secret --secret-id "$name" >/dev/null 2>&1; then
    aws_local secretsmanager put-secret-value \
      --secret-id "$name" \
      --secret-string "$payload" >/dev/null
    echo "    Updated secret ${name}"
  else
    aws_local secretsmanager create-secret \
      --name "$name" \
      --description "LocalStack dev secret (${name})" \
      --secret-string "$payload" >/dev/null
    echo "    Created secret ${name}"
  fi
}

echo "==> Ensuring Secrets Manager secrets (mirrors CDK wgs/db + wgs/jwt) ..."
create_or_update_secret "$DB_SECRET_NAME" "$(jq -nc \
  --arg u wgds \
  --arg p "$DB_PASSWORD" \
  --arg db white_glove_delivery \
  --arg host localhost \
  '{username:$u,password:$p,dbname:$db,host:$host}')"
create_or_update_secret "$JWT_SECRET_NAME" "$(jq -nc \
  --arg s "$JWT_SECRET" \
  --arg app wgs \
  '{secret:$s,app:$app}')"

echo ""
echo "LocalStack resources ready:"
echo "  S3 bucket:        ${BUCKET}"
echo "  DB secret:        ${DB_SECRET_NAME}"
echo "  JWT secret:       ${JWT_SECRET_NAME}"
echo "  Endpoint:         ${LOCALSTACK_ENDPOINT}"
echo ""
echo "Verify:"
echo "  aws --endpoint-url=${LOCALSTACK_ENDPOINT} s3 ls s3://${BUCKET}/"
echo "  aws --endpoint-url=${LOCALSTACK_ENDPOINT} secretsmanager list-secrets"
