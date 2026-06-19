#!/usr/bin/env bash
# Update /opt/wgs/.env on EC2 to point the API at PostgreSQL (post-migration cutover).
#
# Usage:
#   ./deploy/scripts/cutover-env-to-postgresql.sh [instance-id]
#
# Options via env:
#   RESTART_API=1     Restart wgs-api container after updating .env (default: 1)
#   PG_SECRET_ARN     Override PgSecretArn stack output
#   PG_ENDPOINT       Override PostgresEndpoint stack output
#
# Prerequisites:
#   - migrate-mysql-to-postgresql.sh completed successfully
#   - App image includes pg driver (npm install pg in backend)
#   - DB_TYPE=postgres supported in app.module.ts
#
# Does NOT delete MySQL RDS or rotate Secrets Manager wgs/db secret.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=lib/stack-outputs.sh
source "$ROOT/deploy/scripts/lib/stack-outputs.sh"

REGION="${AWS_REGION:-us-east-1}"
INSTANCE_ID="${1:-$(wgs_find_instance_by_role active)}"
RESTART_API="${RESTART_API:-1}"
PG_ENDPOINT="${PG_ENDPOINT:-$(wgs_stack_output PostgresEndpoint)}"
PG_SECRET_ARN="${PG_SECRET_ARN:-$(wgs_stack_output PgSecretArn)}"
STATE_FILE="$ROOT/deploy/.pg-migrate-state.json"
if [[ -f "$STATE_FILE" ]]; then
  PG_ENDPOINT="${PG_ENDPOINT:-$(jq -r '.pgEndpoint // empty' "$STATE_FILE")}"
  PG_SECRET_ARN="${PG_SECRET_ARN:-$(jq -r '.pgSecretArn // empty' "$STATE_FILE")}"
fi

if [[ -z "$INSTANCE_ID" || "$INSTANCE_ID" == "None" ]]; then
  echo "No instance id." >&2
  exit 1
fi
if [[ -z "$PG_ENDPOINT" || "$PG_ENDPOINT" == "None" || -z "$PG_SECRET_ARN" || "$PG_SECRET_ARN" == "None" ]]; then
  echo "PostgreSQL stack outputs missing. Deploy with -c enablePostgresRds=true" >&2
  exit 1
fi

PG_JSON=$(aws secretsmanager get-secret-value \
  --secret-id "$PG_SECRET_ARN" \
  --region "$REGION" \
  --query SecretString \
  --output text)

PG_USER=$(echo "$PG_JSON" | jq -r '.username')
PG_PASS=$(echo "$PG_JSON" | jq -r '.password')
PG_DB=$(echo "$PG_JSON" | jq -r '.dbname // .database // "white_glove_delivery"')

REMOTE=$(cat <<REMOTE
set -euo pipefail
ENV=/opt/wgs/.env
if [[ ! -f "\$ENV" ]]; then
  echo "Missing \$ENV"
  exit 1
fi
cp "\$ENV" "\${ENV}.bak-mysql-\$(date -u +%Y%m%dT%H%M%SZ)"

grep -v -E '^(DB_|TYPEORM_SYNCHRONIZE=)' "\$ENV" > "\${ENV}.tmp" || true
cat >> "\${ENV}.tmp" <<ENVEOF
DB_TYPE=postgres
DB_HOST=${PG_ENDPOINT}
DB_PORT=5432
DB_USERNAME=${PG_USER}
DB_PASSWORD=$(printf '%q' "$PG_PASS")
DB_DATABASE=${PG_DB}
TYPEORM_SYNCHRONIZE=false
ENVEOF
mv "\${ENV}.tmp" "\$ENV"
chmod 600 "\$ENV"
chown ec2-user:ec2-user "\$ENV"
echo "Updated \$ENV for PostgreSQL (backup at \${ENV}.bak-mysql-*)"
if [[ "${RESTART_API}" == "1" ]] && docker ps --format '{{.Names}}' | grep -qx wgs-api; then
  cd /opt/wgs
  docker compose -f deploy/docker-compose.prod.yml up -d --force-recreate api
  echo "Restarted wgs-api"
fi
REMOTE
)

echo "Cutting over ${INSTANCE_ID} to PostgreSQL ${PG_ENDPOINT} ..."
if wgs_ssm_run_shell "$INSTANCE_ID" "$REMOTE" 180; then
  echo "$WGS_SSM_STDOUT"
  echo "Cutover complete on ${INSTANCE_ID}."
else
  echo "SSM failed (status=${WGS_SSM_STATUS:-unknown})" >&2
  echo "$WGS_SSM_STDOUT"
  echo "$WGS_SSM_STDERR" >&2
  exit 1
fi
