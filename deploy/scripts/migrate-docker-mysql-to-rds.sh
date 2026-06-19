#!/usr/bin/env bash
# One-time migration: dump MySQL from Docker on active EC2, restore to RDS.
#
# Usage:
#   ./deploy/scripts/migrate-docker-mysql-to-rds.sh [active-instance-id]
#
# Prerequisites:
#   - CDK stack deployed with RDS
#   - Active instance still running Docker MySQL with data
#   - SSM access to the instance
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=lib/stack-outputs.sh
source "$ROOT/deploy/scripts/lib/stack-outputs.sh"

REGION="${AWS_REGION:-us-east-1}"
INSTANCE_ID="${1:-$(wgs_find_instance_by_role active)}"
RDS_ENDPOINT="$(wgs_stack_output RdsEndpoint)"
DB_SECRET_ARN="$(wgs_stack_output DbSecretArn)"

if [[ -z "$INSTANCE_ID" || "$INSTANCE_ID" == "None" ]]; then
  INSTANCE_ID="$(wgs_stack_output InstanceId)"
fi

if [[ -z "$RDS_ENDPOINT" || "$RDS_ENDPOINT" == "None" ]]; then
  echo "RdsEndpoint stack output missing. Deploy CDK with RDS first."
  exit 1
fi

echo "Migrating Docker MySQL on $INSTANCE_ID -> RDS $RDS_ENDPOINT"

REMOTE=$(cat <<'REMOTE'
set -euo pipefail
APP_DIR=/opt/wgs
source "$APP_DIR/.env"

dnf install -y mariadb105 2>/dev/null || true

if ! docker ps --format '{{.Names}}' | grep -qx wgs-mysql; then
  echo "wgs-mysql container not running on this instance."
  exit 1
fi

DUMP=/tmp/wgs-migrate.sql
docker exec wgs-mysql mysqldump \
  -u root \
  -p"${MYSQL_ROOT_PASSWORD:-$DB_PASSWORD}" \
  --single-transaction \
  --routines \
  --triggers \
  "${DB_DATABASE}" > "$DUMP"

echo "Dump size: $(wc -c < "$DUMP") bytes"

mysql -h "${RDS_HOST}" -P 3306 -u "${DB_USERNAME}" -p"${DB_PASSWORD}" "${DB_DATABASE}" < "$DUMP"
rm -f "$DUMP"
echo "Restore to RDS complete."
REMOTE
)

DB_JSON=$(aws secretsmanager get-secret-value \
  --secret-id "$DB_SECRET_ARN" \
  --region "$REGION" \
  --query SecretString \
  --output text)

DB_USER=$(echo "$DB_JSON" | jq -r '.username')
DB_PASS=$(echo "$DB_JSON" | jq -r '.password')
DB_NAME=$(echo "$DB_JSON" | jq -r '.dbname')

FULL_REMOTE="export RDS_HOST=${RDS_ENDPOINT}
export DB_USERNAME=${DB_USER}
export DB_PASSWORD=${DB_PASS}
export DB_DATABASE=${DB_NAME}
${REMOTE}"

B64=$(printf '%s' "$FULL_REMOTE" | base64 | tr -d '\n')

echo "Running migration via SSM on $INSTANCE_ID ..."
COMMAND_ID=$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunShellScript \
  --timeout-seconds 3600 \
  --parameters "{\"commands\":[\"echo $B64 | base64 -d | bash\"]}" \
  --query Command.CommandId \
  --output text \
  --region "$REGION")

for _ in $(seq 1 60); do
  STATUS=$(aws ssm get-command-invocation \
    --command-id "$COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --query Status \
    --output text \
    --region "$REGION" 2>/dev/null || echo Pending)
  if [[ "$STATUS" == "Success" ]]; then
    aws ssm get-command-invocation \
      --command-id "$COMMAND_ID" \
      --instance-id "$INSTANCE_ID" \
      --query StandardOutputContent \
      --output text \
      --region "$REGION"
    echo ""
    echo "Migration complete. Set TYPEORM_SYNCHRONIZE=false on instances and redeploy without Docker MySQL."
    exit 0
  fi
  if [[ "$STATUS" == "Failed" || "$STATUS" == "Cancelled" || "$STATUS" == "TimedOut" ]]; then
    aws ssm get-command-invocation \
      --command-id "$COMMAND_ID" \
      --instance-id "$INSTANCE_ID" \
      --query '[StandardOutputContent,StandardErrorContent]' \
      --output text \
      --region "$REGION"
    exit 1
  fi
  sleep 10
done

echo "Timed out waiting for SSM command $COMMAND_ID"
exit 1
