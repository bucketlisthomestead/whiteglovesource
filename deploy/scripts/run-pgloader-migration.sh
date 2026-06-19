#!/usr/bin/env bash
# Copy MySQL RDS data to PostgreSQL on EC2 via SSM (pgloader + row-count verification).
#
# Usage:
#   ./deploy/scripts/run-pgloader-migration.sh [instance-id]
#
# Environment:
#   WGS_PG_ENDPOINT, WGS_PG_SECRET_ARN  (or CDK PostgresEndpoint / PgSecretArn outputs)
#   WGS_SKIP_MYSQL_BACKUP=1             Skip mysqldump to S3
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=lib/stack-outputs.sh
source "$ROOT/deploy/scripts/lib/stack-outputs.sh"
# shellcheck source=lib/db-env.sh
source "$ROOT/deploy/scripts/lib/db-env.sh"

REGION="${AWS_REGION:-us-east-1}"
INSTANCE_ID="${1:-$(wgs_find_instance_by_role active)}"
BUCKET="$(wgs_stack_output BucketName)"
DB_SECRET_ARN="$(wgs_stack_output DbSecretArn)"
STATE_FILE="$ROOT/deploy/.pg-migrate-state.json"

WGS_PG_ENDPOINT="${WGS_PG_ENDPOINT:-$(wgs_stack_output PostgresEndpoint)}"
WGS_PG_SECRET_ARN="${WGS_PG_SECRET_ARN:-$(wgs_stack_output PgSecretArn)}"

if [[ -f "$STATE_FILE" ]]; then
  WGS_PG_ENDPOINT="${WGS_PG_ENDPOINT:-$(jq -r '.pgEndpoint // empty' "$STATE_FILE")}"
  WGS_PG_SECRET_ARN="${WGS_PG_SECRET_ARN:-$(jq -r '.pgSecretArn // empty' "$STATE_FILE")}"
fi

if [[ -z "$INSTANCE_ID" || "$INSTANCE_ID" == "None" ]]; then
  echo "Could not find EC2 instance. Pass instance-id as first argument."
  exit 1
fi

if [[ -z "${WGS_PG_ENDPOINT:-}" || -z "${WGS_PG_SECRET_ARN:-}" || "$WGS_PG_ENDPOINT" == "None" || "$WGS_PG_SECRET_ARN" == "None" ]]; then
  echo "PostgreSQL target not configured. Set WGS_PG_ENDPOINT + WGS_PG_SECRET_ARN,"
  echo "deploy CDK with -c enablePostgresRds=true, or run provision-postgresql-rds.sh."
  exit 1
fi

MYSQL_JSON=$(wgs_fetch_db_secret "$DB_SECRET_ARN" "$REGION")
PG_JSON=$(wgs_fetch_db_secret "$WGS_PG_SECRET_ARN" "$REGION")

MYSQL_USER=$(wgs_secret_field "$MYSQL_JSON" username)
MYSQL_PASS=$(wgs_secret_field "$MYSQL_JSON" password)
MYSQL_DB=$(wgs_secret_field "$MYSQL_JSON" dbname)
MYSQL_HOST=$(wgs_secret_field "$MYSQL_JSON" host)
[[ -z "$MYSQL_HOST" ]] && MYSQL_HOST="$(wgs_stack_output RdsEndpoint)"

PG_USER=$(wgs_secret_field "$PG_JSON" username)
PG_PASS=$(wgs_secret_field "$PG_JSON" password)
PG_DB=$(wgs_secret_field "$PG_JSON" dbname)

REMOTE_LIB_B64=$(base64 < "$ROOT/deploy/scripts/lib/run-mysql-to-postgresql-remote.sh" | tr -d '\n')

REMOTE=$(cat <<REMOTE
set -euo pipefail
echo '$REMOTE_LIB_B64' | base64 -d > /tmp/wgs-pg-migrate-remote.sh
chmod +x /tmp/wgs-pg-migrate-remote.sh
export MYSQL_HOST='${MYSQL_HOST}'
export MYSQL_USER='${MYSQL_USER}'
export MYSQL_PASSWORD='$(printf '%s' "$MYSQL_PASS" | sed "s/'/'\\\\''/g")'
export MYSQL_DATABASE='${MYSQL_DB}'
export PG_HOST='${WGS_PG_ENDPOINT}'
export PG_USER='${PG_USER}'
export PG_PASSWORD='$(printf '%s' "$PG_PASS" | sed "s/'/'\\\\''/g")'
export PG_DATABASE='${PG_DB}'
export S3_BUCKET='${BUCKET}'
export AWS_REGION='${REGION}'
export SKIP_BACKUP='${WGS_SKIP_MYSQL_BACKUP:-0}'
/tmp/wgs-pg-migrate-remote.sh
REMOTE
)

echo "Running pgloader migration on $INSTANCE_ID via SSM (may take 10–30 min) ..."
if ! wgs_ssm_run_shell "$INSTANCE_ID" "$REMOTE" 3600; then
  echo "SSM failed: ${WGS_SSM_STATUS:-unknown}"
  echo "$WGS_SSM_STDERR"
  exit 1
fi
echo "$WGS_SSM_STDOUT"
