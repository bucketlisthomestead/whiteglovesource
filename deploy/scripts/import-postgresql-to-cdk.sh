#!/usr/bin/env bash
# Import existing PostgreSQL RDS resources into WgsStack (one-time).
#
# CloudFormation import requires removing static Postgres outputs first, then
# importing DbInstanceSubnetGroup, PgSecret, and PgDbInstance. Use when adopting
# CLI-provisioned wgs-postgres into full CDK management.
#
# Usage:
#   ./deploy/scripts/import-postgresql-to-cdk.sh [--dry-run]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INFRA="$ROOT/../infra"
REGION="${AWS_REGION:-us-east-1}"
DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

PG_ID="${WGS_PG_INSTANCE_ID:-wgs-postgres}"
PG_SECRET_ARN="${WGS_PG_SECRET_ARN:-arn:aws:secretsmanager:us-east-1:536579406753:secret:wgs/pg-ZHlJGW}"
SUBNET_GROUP="${WGS_PG_SUBNET_GROUP:-wgsstack-dbinstancesubnetgroup5ef3ca8a-7gox0h5xob7u}"

echo "PostgreSQL CDK import helper"
echo "  Instance:     $PG_ID"
echo "  Secret:       $PG_SECRET_ARN"
echo "  Subnet group: $SUBNET_GROUP"
echo ""
echo "The stack currently references these resources via CDK lookups (fromSecretCompleteArn /"
echo "fromDatabaseInstanceAttributes). Full CloudFormation ownership requires:"
echo "  1. Remove PostgresEndpoint / PgSecretArn static outputs (cdk deploy)"
echo "  2. Import resources (see infra/resources-to-import.json + import-template.json)"
echo "  3. Switch wgs-stack.ts to managed rds.DatabaseInstance + secretsmanager.Secret"
echo "  4. cdk deploy"
echo ""
echo "See infra/README.md section 'PostgreSQL in CDK'."

if [[ "$DRY_RUN" == true ]]; then
  exit 0
fi

echo "No automatic import executed — run the steps above or contact ops before importing live RDS."
