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
STATE_FILE="$ROOT/deploy/.pg-migrate-state.json"
REMOTE_SCRIPT_KEY="deploy/scripts/run-mysql-to-postgresql-remote.sh"

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

echo "Uploading remote migration script to s3://${BUCKET}/${REMOTE_SCRIPT_KEY} ..."
aws s3 cp "$ROOT/deploy/scripts/lib/run-mysql-to-postgresql-remote.sh" \
  "s3://${BUCKET}/${REMOTE_SCRIPT_KEY}" --region "$REGION"

REMOTE=$(cat <<EOF
set -euo pipefail
wgs_env() { grep -E "^\${1}=" /opt/wgs/.env | head -1 | cut -d= -f2-; }
export MYSQL_HOST=\$(wgs_env DB_HOST)
export MYSQL_USER=\$(wgs_env DB_USERNAME)
export MYSQL_PASSWORD=\$(wgs_env DB_PASSWORD)
export MYSQL_DATABASE=\$(wgs_env DB_DATABASE)
export PG_HOST='${WGS_PG_ENDPOINT}'
PG_JSON=\$(aws secretsmanager get-secret-value --secret-id '${WGS_PG_SECRET_ARN}' --region '${REGION}' --query SecretString --output text)
export PG_USER=\$(echo "\$PG_JSON" | jq -r '.username')
export PG_PASSWORD=\$(echo "\$PG_JSON" | jq -r '.password')
export PG_DATABASE=\$(echo "\$PG_JSON" | jq -r '.dbname // "white_glove_delivery"')
export S3_BUCKET='${BUCKET}'
export AWS_REGION='${REGION}'
export SKIP_BACKUP='${WGS_SKIP_MYSQL_BACKUP:-0}'
SCRIPT=/tmp/wgs-pg-migrate-remote.sh
aws s3 cp "s3://${BUCKET}/${REMOTE_SCRIPT_KEY}" "\$SCRIPT" --region '${REGION}'
chmod +x "\$SCRIPT"
"\$SCRIPT"
EOF
)

echo "Running pgloader migration on $INSTANCE_ID via SSM (may take 10–30 min) ..."
if ! wgs_ssm_run_shell "$INSTANCE_ID" "$REMOTE" 3600; then
  echo "SSM failed: ${WGS_SSM_STATUS:-unknown}"
  echo "$WGS_SSM_STDERR"
  echo "$WGS_SSM_STDOUT"
  exit 1
fi
echo "$WGS_SSM_STDOUT"
