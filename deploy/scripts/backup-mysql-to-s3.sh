#!/usr/bin/env bash
# Daily MySQL dump from RDS -> S3 (prefix backups/mysql/)
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
KEY="backups/mysql/${DB_DATABASE}-${STAMP}.sql.gz"
TMP="/tmp/wgs-mysql-backup-$$.sql.gz"

mysqldump \
  -h "${DB_HOST}" \
  -P "${DB_PORT:-3306}" \
  -u "${DB_USERNAME}" \
  -p"${DB_PASSWORD}" \
  --single-transaction \
  --routines \
  --triggers \
  "${DB_DATABASE}" | gzip > "$TMP"

aws s3 cp "$TMP" "s3://${S3_BUCKET}/${KEY}" --region "$REGION"
rm -f "$TMP"

echo "[wgs-backup] Uploaded s3://${S3_BUCKET}/${KEY}"
