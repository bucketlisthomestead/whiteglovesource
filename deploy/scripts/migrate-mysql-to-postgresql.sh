#!/usr/bin/env bash
# MySQL -> PostgreSQL migration (data copy and optional blue/green cutover).
#
# Usage:
#   ./deploy/scripts/migrate-mysql-to-postgresql.sh [options] [instance-id]
#
# Data migration only (default):
#   ./deploy/scripts/migrate-mysql-to-postgresql.sh --dry-run
#   ./deploy/scripts/migrate-mysql-to-postgresql.sh
#
# Full cutover (data + candidate deploy + promote):
#   ./deploy/scripts/migrate-mysql-to-postgresql.sh --cutover --provision-pg
#
# Options:
#   --dry-run          Print resolved config and exit
#   --cutover          After data migration, blue/green deploy against PostgreSQL
#   --provision-pg     Create PostgreSQL RDS via CLI (see provision-postgresql-rds.sh)
#   --skip-data        Skip pgloader (data already migrated)
#   --skip-backup      Skip mysqldump to S3
#   --skip-verify      Skip Playwright smoke tests before promote
#   --terminate-old    Terminate retired instance after promote
#   --pg-endpoint H    PostgreSQL hostname override
#   --pg-secret-arn A  PostgreSQL secret ARN override
#
# PostgreSQL target resolution (first match wins):
#   1. --pg-endpoint / --pg-secret-arn
#   2. CDK stack outputs (PostgresEndpoint, PgSecretArn) after enablePostgresRds deploy
#   3. deploy/.pg-migrate-state.json from provision-postgresql-rds.sh
#   4. WGS_PG_ENDPOINT / WGS_PG_SECRET_ARN env vars
#
# Environment: AWS_PROFILE=wgs-deploy, AWS_REGION=us-east-1
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=lib/stack-outputs.sh
source "$ROOT/deploy/scripts/lib/stack-outputs.sh"
# shellcheck source=lib/db-env.sh
source "$ROOT/deploy/scripts/lib/db-env.sh"

REGION="${AWS_REGION:-us-east-1}"
DRY_RUN=false
CUTOVER=false
PROVISION_PG=false
SKIP_DATA=false
SKIP_BACKUP=false
SKIP_VERIFY=false
TERMINATE_OLD=false
INSTANCE_ID=""
WGS_PG_ENDPOINT="${WGS_PG_ENDPOINT:-}"
WGS_PG_SECRET_ARN="${WGS_PG_SECRET_ARN:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --cutover) CUTOVER=true; shift ;;
    --provision-pg) PROVISION_PG=true; shift ;;
    --skip-data) SKIP_DATA=true; shift ;;
    --skip-backup) SKIP_BACKUP=true; shift ;;
    --skip-verify) SKIP_VERIFY=true; shift ;;
    --terminate-old) TERMINATE_OLD=true; shift ;;
    --pg-endpoint) WGS_PG_ENDPOINT="${2:?}"; shift 2 ;;
    --pg-endpoint=*) WGS_PG_ENDPOINT="${1#*=}"; shift ;;
    --pg-secret-arn) WGS_PG_SECRET_ARN="${2:?}"; shift 2 ;;
    --pg-secret-arn=*) WGS_PG_SECRET_ARN="${1#*=}"; shift ;;
    -h|--help) sed -n '2,35p' "$0"; exit 0 ;;
    i-*) INSTANCE_ID="$1"; shift ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

STATE_FILE="$ROOT/deploy/.pg-migrate-state.json"
[[ -z "$INSTANCE_ID" ]] && INSTANCE_ID="$(wgs_find_instance_by_role active)"

echo "=== Step 1: PostgreSQL target ==="
if [[ "$PROVISION_PG" == true ]]; then
  "$ROOT/deploy/scripts/provision-postgresql-rds.sh"
fi

WGS_PG_ENDPOINT="${WGS_PG_ENDPOINT:-$(wgs_stack_output PostgresEndpoint)}"
WGS_PG_SECRET_ARN="${WGS_PG_SECRET_ARN:-$(wgs_stack_output PgSecretArn)}"
if [[ -f "$STATE_FILE" ]]; then
  WGS_PG_ENDPOINT="${WGS_PG_ENDPOINT:-$(jq -r '.pgEndpoint // empty' "$STATE_FILE")}"
  WGS_PG_SECRET_ARN="${WGS_PG_SECRET_ARN:-$(jq -r '.pgSecretArn // empty' "$STATE_FILE")}"
fi

if [[ -z "$WGS_PG_ENDPOINT" || "$WGS_PG_ENDPOINT" == "None" || -z "$WGS_PG_SECRET_ARN" || "$WGS_PG_SECRET_ARN" == "None" ]]; then
  echo "PostgreSQL not configured. Use one of:" >&2
  echo "  cd infra && npx cdk deploy -c enablePostgresRds=true" >&2
  echo "  ./deploy/scripts/migrate-mysql-to-postgresql.sh --provision-pg" >&2
  echo "  --pg-endpoint / --pg-secret-arn" >&2
  exit 1
fi

export WGS_PG_ENDPOINT WGS_PG_SECRET_ARN
MYSQL_ENDPOINT="$(wgs_stack_output RdsEndpoint)"

echo "  MySQL:      $MYSQL_ENDPOINT"
echo "  PostgreSQL: $WGS_PG_ENDPOINT"
echo "  PG secret:  $WGS_PG_SECRET_ARN"
echo "  Instance:   $INSTANCE_ID"

if [[ "$DRY_RUN" == true ]]; then
  echo "Dry run OK — no changes made."
  exit 0
fi

echo ""
echo "=== Step 2: Data migration (pgloader) ==="
if [[ "$SKIP_DATA" == true ]]; then
  echo "Skipped (--skip-data)."
else
  [[ "$SKIP_BACKUP" == true ]] && export WGS_SKIP_MYSQL_BACKUP=1
  "$ROOT/deploy/scripts/run-pgloader-migration.sh" "$INSTANCE_ID"
fi

if [[ "$CUTOVER" != true ]]; then
  echo ""
  echo "Data migration complete. Next steps:"
  echo "  ./deploy/scripts/cutover-env-to-postgresql.sh [instance-id]"
  echo "  ./deploy/scripts/blue-green-deploy.sh"
  echo "Or re-run with --cutover for automated blue/green promote."
  exit 0
fi

echo ""
echo "=== Step 3: Launch candidate ==="
"$ROOT/deploy/scripts/launch-candidate.sh"

DEPLOY_STATE="$(wgs_deploy_state_file)"
CANDIDATE_ID=$(jq -r '.candidateInstanceId // empty' "$DEPLOY_STATE" 2>/dev/null || true)
CANDIDATE_IP=$(jq -r '.candidatePublicIp // empty' "$DEPLOY_STATE" 2>/dev/null || true)
[[ -z "$CANDIDATE_IP" && -n "$CANDIDATE_ID" ]] && CANDIDATE_IP="$(wgs_instance_public_ip "$CANDIDATE_ID")"

echo ""
echo "=== Step 4: Wait for candidate bootstrap ==="
for i in $(seq 1 60); do
  if [[ "$(wgs_ssm_ping_status "$CANDIDATE_ID")" == "Online" ]] \
    && wgs_ssm_run_shell "$CANDIDATE_ID" 'test -f /opt/wgs/.env && echo ready' 90 \
    && [[ "$WGS_SSM_STDOUT" == *ready* ]]; then
    break
  fi
  [[ "$i" -eq 60 ]] && { echo "Timed out waiting for candidate."; exit 1; }
  sleep 15
done

echo ""
echo "=== Step 5: Point candidate at PostgreSQL ==="
PG_ENDPOINT="$WGS_PG_ENDPOINT" PG_SECRET_ARN="$WGS_PG_SECRET_ARN" \
  "$ROOT/deploy/scripts/cutover-env-to-postgresql.sh" "$CANDIDATE_ID"

echo ""
echo "=== Step 6: Deploy app to candidate ==="
"$ROOT/deploy/scripts/push-and-deploy-ssm.sh" "$CANDIDATE_ID"

echo ""
echo "=== Step 7: Health + smoke tests ==="
for i in $(seq 1 36); do
  curl -sf "http://${CANDIDATE_IP}/api/health" >/dev/null 2>&1 && break
  [[ "$i" -eq 36 ]] && { echo "Candidate health check failed."; exit 1; }
  sleep 5
done

if [[ "$SKIP_VERIFY" == false ]]; then
  "$ROOT/deploy/scripts/verify-candidate.sh" "$CANDIDATE_IP"
fi

echo ""
echo "=== Step 8: Promote ==="
PROMOTE_ARGS=()
[[ "$TERMINATE_OLD" == true ]] && PROMOTE_ARGS+=(--terminate-old)
"$ROOT/deploy/scripts/promote-candidate.sh" "${PROMOTE_ARGS[@]}"

EIP="$(wgs_stack_output ElasticIp)"
echo ""
echo "Cutover complete: http://${EIP}/ (PostgreSQL: ${WGS_PG_ENDPOINT})"
