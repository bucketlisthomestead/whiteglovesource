#!/usr/bin/env bash
# Daily PostgreSQL dump from RDS -> S3 (prefix backups/postgresql/)
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/wgs}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env}"
REGION="${AWS_REGION:-us-east-1}"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

: "${S3_BUCKET:?S3_BUCKET required}"
: "${DB_HOST:?DB_HOST required}"
: "${DB_DATABASE:?DB_DATABASE required}"
: "${DB_USERNAME:?DB_USERNAME required}"
: "${DB_PASSWORD:?DB_PASSWORD required}"

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
KEY="backups/postgresql/${DB_DATABASE}-${STAMP}.sql.gz"
TMP="/tmp/wgs-postgresql-backup-$$.sql.gz"

export PGPASSWORD="$DB_PASSWORD"
pg_dump \
  -h "${DB_HOST}" \
  -p "${DB_PORT:-5432}" \
  -U "${DB_USERNAME}" \
  -d "${DB_DATABASE}" \
  --no-owner \
  --no-acl \
  | gzip > "$TMP"

aws s3 cp "$TMP" "s3://${S3_BUCKET}/${KEY}" --region "$REGION"
rm -f "$TMP"

echo "[wgs-backup] Uploaded s3://${S3_BUCKET}/${KEY}"
