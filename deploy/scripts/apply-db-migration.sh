#!/usr/bin/env bash
# Apply a SQL migration file on RDS via the active EC2 instance (mysqldump client).
#
# Usage:
#   ./deploy/scripts/apply-db-migration.sh <path-to.sql> [instance-id]
#
# Each statement is attempted individually; "Duplicate column" errors are ignored.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=lib/stack-outputs.sh
source "$ROOT/deploy/scripts/lib/stack-outputs.sh"

SQL_FILE="${1:-}"
INSTANCE_ID="${2:-}"
REGION="${AWS_REGION:-us-east-1}"

if [[ -z "$SQL_FILE" || ! -f "$SQL_FILE" ]]; then
  echo "Usage: $0 <path-to.sql> [instance-id]"
  exit 1
fi

if [[ -z "$INSTANCE_ID" ]]; then
  INSTANCE_ID="$(wgs_find_instance_by_role active)"
fi

if [[ -z "$INSTANCE_ID" || "$INSTANCE_ID" == "None" ]]; then
  echo "Could not find active instance. Pass instance-id as second argument."
  exit 1
fi

BUCKET="$(wgs_stack_output BucketName)"
BASENAME="$(basename "$SQL_FILE")"
S3_KEY="deploy/migrations/${BASENAME}"

echo "Uploading $SQL_FILE to s3://${BUCKET}/${S3_KEY} ..."
aws s3 cp "$SQL_FILE" "s3://${BUCKET}/${S3_KEY}" --region "$REGION"

REMOTE_CMD=$(cat <<EOF
set -euo pipefail
wgs_env() { grep -E "^\${1}=" /opt/wgs/.env | head -1 | cut -d= -f2-; }
DB_HOST=\$(wgs_env DB_HOST)
DB_PORT=\$(wgs_env DB_PORT)
DB_USERNAME=\$(wgs_env DB_USERNAME)
DB_PASSWORD=\$(wgs_env DB_PASSWORD)
DB_DATABASE=\$(wgs_env DB_DATABASE)
TMP="/tmp/wgs-migration-\$\$.sql"
aws s3 cp "s3://${BUCKET}/${S3_KEY}" "\$TMP" --region "${REGION}"
stmt=""
while IFS= read -r line || [[ -n "\$line" ]]; do
  stmt="\${stmt}\${line}"$'\n'
  if [[ "\$line" =~ \;[[:space:]]*\$ ]]; then
    stmt_trimmed="\$(echo "\$stmt" | sed '/^[[:space:]]*--/d;/^[[:space:]]*$/d' | tr '\n' ' ')"
    if [[ -z "\${stmt_trimmed// }" ]]; then
      stmt=""
      continue
    fi
    if mysql -h "\$DB_HOST" -P "\${DB_PORT:-3306}" -u "\$DB_USERNAME" -p"\${DB_PASSWORD}" "\$DB_DATABASE" -e "\$stmt_trimmed" 2>/tmp/wgs-mig-err; then
      echo "OK: \${stmt_trimmed:0:80}..."
    else
      err=\$(cat /tmp/wgs-mig-err)
      if echo "\$err" | grep -qiE 'duplicate column|already exists'; then
        echo "SKIP (exists): \${stmt_trimmed:0:80}..."
      else
        echo "FAIL: \$err"
        echo "Statement: \$stmt_trimmed"
        rm -f "\$TMP" /tmp/wgs-mig-err
        exit 1
      fi
    fi
    stmt=""
  fi
done < "\$TMP"
rm -f "\$TMP" /tmp/wgs-mig-err
echo "Migration complete."
EOF
)

echo "Applying migration on instance $INSTANCE_ID ..."
if ! wgs_ssm_run_shell "$INSTANCE_ID" "$REMOTE_CMD" 300; then
  echo "SSM failed: ${WGS_SSM_STATUS:-unknown}"
  echo "$WGS_SSM_STDERR"
  exit 1
fi
echo "$WGS_SSM_STDOUT"
