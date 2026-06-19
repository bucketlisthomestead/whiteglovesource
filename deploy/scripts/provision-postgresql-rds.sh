#!/usr/bin/env bash
# Provision a PostgreSQL RDS instance in the same VPC as the existing MySQL RDS.
#
# Creates a Secrets Manager secret (wgs/pg by default), security group, and
# db.t4g.micro PostgreSQL 16 instance. MySQL RDS is left running for rollback.
#
# Usage:
#   ./deploy/scripts/provision-postgresql-rds.sh [--identifier wgs-postgres]
#
# Outputs (also written to deploy/.pg-migrate-state.json):
#   WGS_PG_ENDPOINT, WGS_PG_SECRET_ARN, WGS_PG_INSTANCE_ID
#
# Prerequisites:
#   AWS_PROFILE=wgs-deploy, CDK stack with MySQL RDS already deployed
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=lib/stack-outputs.sh
source "$ROOT/deploy/scripts/lib/stack-outputs.sh"
# shellcheck source=lib/db-env.sh
source "$ROOT/deploy/scripts/lib/db-env.sh"

REGION="${AWS_REGION:-us-east-1}"
PG_IDENTIFIER="${WGS_PG_INSTANCE_ID:-wgs-postgres}"
SECRET_NAME="${WGS_PG_SECRET_NAME:-wgs/pg}"
DB_NAME="white_glove_delivery"
DB_USER="wgds"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --identifier)
      PG_IDENTIFIER="${2:?}"
      shift 2
      ;;
    --identifier=*)
      PG_IDENTIFIER="${1#*=}"
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [--identifier wgs-postgres]"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

MYSQL_ENDPOINT="$(wgs_stack_output RdsEndpoint)"
INSTANCE_SG="$(wgs_stack_output InstanceSecurityGroupId)"

if [[ -z "$MYSQL_ENDPOINT" || "$MYSQL_ENDPOINT" == "None" ]]; then
  echo "MySQL RdsEndpoint stack output missing."
  exit 1
fi

# Reuse existing PostgreSQL instance if already provisioned.
EXISTING=$(aws rds describe-db-instances \
  --db-instance-identifier "$PG_IDENTIFIER" \
  --region "$REGION" \
  --query 'DBInstances[0].DBInstanceStatus' \
  --output text 2>/dev/null || echo "None")

if [[ "$EXISTING" != "None" && -n "$EXISTING" ]]; then
  echo "PostgreSQL instance $PG_IDENTIFIER already exists (status=$EXISTING)."
  PG_ENDPOINT=$(aws rds describe-db-instances \
    --db-instance-identifier "$PG_IDENTIFIER" \
    --query 'DBInstances[0].Endpoint.Address' \
    --output text \
    --region "$REGION")
  PG_SECRET_ARN=$(aws secretsmanager describe-secret \
    --secret-id "$SECRET_NAME" \
    --query ARN \
    --output text \
    --region "$REGION" 2>/dev/null || true)
  if [[ -z "$PG_SECRET_ARN" || "$PG_SECRET_ARN" == "None" ]]; then
    echo "WARN: Could not find secret $SECRET_NAME — set WGS_PG_SECRET_ARN manually."
    exit 1
  fi
else
  MYSQL_META=$(aws rds describe-db-instances \
    --region "$REGION" \
    --query "DBInstances[?Endpoint.Address=='${MYSQL_ENDPOINT}'] | [0]" \
    --output json)
  if [[ "$MYSQL_META" == "null" || -z "$MYSQL_META" ]]; then
    echo "Could not find MySQL RDS instance for endpoint $MYSQL_ENDPOINT"
    exit 1
  fi

  SUBNET_GROUP=$(echo "$MYSQL_META" | jq -r '.DBSubnetGroup.DBSubnetGroupName')
  VPC_ID=$(echo "$MYSQL_META" | jq -r '.DBSubnetGroup.VpcId')

  PG_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)

  echo "Creating Secrets Manager secret $SECRET_NAME ..."
  PG_SECRET_ARN=$(aws secretsmanager create-secret \
    --name "$SECRET_NAME" \
    --description "PostgreSQL credentials for White Glove Moving Service" \
    --secret-string "$(jq -n \
      --arg u "$DB_USER" \
      --arg p "$PG_PASS" \
      --arg d "$DB_NAME" \
      '{username:$u,password:$p,dbname:$d}')" \
    --query ARN \
    --output text \
    --region "$REGION" 2>/dev/null || \
    aws secretsmanager describe-secret \
      --secret-id "$SECRET_NAME" \
      --query ARN \
      --output text \
      --region "$REGION")

  echo "Creating security group for PostgreSQL RDS ..."
  PG_SG=$(aws ec2 create-security-group \
    --group-name "${PG_IDENTIFIER}-sg" \
    --description "WGS PostgreSQL RDS - EC2 only on 5432" \
    --vpc-id "$VPC_ID" \
    --query GroupId \
    --output text \
    --region "$REGION" 2>/dev/null || \
    aws ec2 describe-security-groups \
      --filters "Name=group-name,Values=${PG_IDENTIFIER}-sg" "Name=vpc-id,Values=$VPC_ID" \
      --query 'SecurityGroups[0].GroupId' \
      --output text \
      --region "$REGION")

  aws ec2 authorize-security-group-ingress \
    --group-id "$PG_SG" \
    --protocol tcp \
    --port 5432 \
    --source-group "$INSTANCE_SG" \
    --region "$REGION" 2>/dev/null || true

  echo "Launching PostgreSQL RDS $PG_IDENTIFIER (db.t4g.micro) ..."
  aws rds create-db-instance \
    --db-instance-identifier "$PG_IDENTIFIER" \
    --db-instance-class db.t4g.micro \
    --engine postgres \
    --engine-version 16 \
    --master-username "$DB_USER" \
    --master-user-password "$PG_PASS" \
    --db-name "$DB_NAME" \
    --allocated-storage 20 \
    --max-allocated-storage 50 \
    --storage-encrypted \
    --no-publicly-accessible \
    --backup-retention-period 7 \
    --db-subnet-group-name "$SUBNET_GROUP" \
    --vpc-security-group-ids "$PG_SG" \
    --region "$REGION" >/dev/null

  echo "Waiting for PostgreSQL RDS to become available (5–15 min) ..."
  aws rds wait db-instance-available \
    --db-instance-identifier "$PG_IDENTIFIER" \
    --region "$REGION"

  PG_ENDPOINT=$(aws rds describe-db-instances \
    --db-instance-identifier "$PG_IDENTIFIER" \
    --query 'DBInstances[0].Endpoint.Address' \
    --output text \
    --region "$REGION")

  # Store host in secret for convenience.
  SECRET_JSON=$(wgs_fetch_db_secret "$PG_SECRET_ARN" "$REGION")
  aws secretsmanager put-secret-value \
    --secret-id "$PG_SECRET_ARN" \
    --secret-string "$(echo "$SECRET_JSON" | jq --arg h "$PG_ENDPOINT" '. + {host:$h}')" \
    --region "$REGION" >/dev/null

  INSTANCE_ROLE_ARN="$(wgs_stack_output InstanceProfileArn)"
  if [[ -n "$INSTANCE_ROLE_ARN" && "$INSTANCE_ROLE_ARN" != "None" ]]; then
    echo "Granting EC2 role read access to PostgreSQL secret ..."
    aws secretsmanager put-resource-policy \
      --secret-id "$PG_SECRET_ARN" \
      --resource-policy "$(jq -n \
        --arg role "$INSTANCE_ROLE_ARN" \
        --arg arn "$PG_SECRET_ARN" \
        '{
          Version: "2012-10-17",
          Statement: [{
            Effect: "Allow",
            Principal: { AWS: $role },
            Action: "secretsmanager:GetSecretValue",
            Resource: $arn
          }]
        }')" \
      --region "$REGION" >/dev/null 2>&1 || true
  fi
fi

STATE_FILE="$ROOT/deploy/.pg-migrate-state.json"
mkdir -p "$(dirname "$STATE_FILE")"
jq -n \
  --arg endpoint "$PG_ENDPOINT" \
  --arg secret "$PG_SECRET_ARN" \
  --arg id "$PG_IDENTIFIER" \
  --arg created "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{pgEndpoint:$endpoint,pgSecretArn:$secret,pgInstanceId:$id,createdAt:$created}' \
  > "$STATE_FILE"

echo ""
echo "PostgreSQL RDS ready."
echo "  Endpoint:     $PG_ENDPOINT"
echo "  Secret ARN:   $PG_SECRET_ARN"
echo "  Instance ID:  $PG_IDENTIFIER"
echo "  State file:   $STATE_FILE"
echo ""
echo "Export for migration:"
echo "  export WGS_PG_ENDPOINT=$PG_ENDPOINT"
echo "  export WGS_PG_SECRET_ARN=$PG_SECRET_ARN"
