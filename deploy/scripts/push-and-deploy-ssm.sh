#!/usr/bin/env bash
# Build, upload to S3, and deploy on EC2 via SSM (no SSH required).
#
# In-place deploy: builds images while old containers serve traffic, recreates
# api, waits for /api/health, then updates nginx. Expect ~30s–2min API blip.
# For zero downtime use blue-green-deploy.sh instead.
#
# EIP reassociation runs at the START for active instances only (drift recovery
# after CDK replace). Candidate deploys never move the live Elastic IP.
#
# Usage:
#   ./deploy/scripts/push-and-deploy-ssm.sh <instance-id> [s3-bucket]
#
# Example:
#   ./deploy/scripts/push-and-deploy-ssm.sh i-08809779e3617a84e
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
INSTANCE_ID="${1:-}"
BUCKET="${2:-}"
REGION="${AWS_REGION:-us-east-1}"
ARTIFACT_KEY="deploy/wgs-app.tar.gz"

if [[ -z "$INSTANCE_ID" ]]; then
  echo "Usage: $0 <instance-id> [s3-bucket]"
  exit 1
fi

if [[ -z "$BUCKET" ]]; then
  BUCKET=$(aws cloudformation describe-stacks --stack-name WgsStack \
    --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" --output text --region "$REGION")
fi

if [[ -z "$BUCKET" || "$BUCKET" == "None" ]]; then
  echo "Could not resolve S3 bucket. Pass it as the second argument."
  exit 1
fi

echo "Building frontend and backend..."
(cd "$ROOT/frontend" && npm run build)
(cd "$ROOT/backend" && npm run build)

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "Packaging app tarball..."
tar -czf "$TMP/wgs-app.tar.gz" \
  -C "$ROOT" \
  --exclude backend/node_modules \
  --exclude frontend/node_modules \
  backend frontend content deploy

echo "Uploading to s3://$BUCKET/$ARTIFACT_KEY ..."
aws s3 cp "$TMP/wgs-app.tar.gz" "s3://$BUCKET/$ARTIFACT_KEY" --region "$REGION"

cat > "$TMP/remote-deploy.sh" <<REMOTE
#!/bin/bash
set -euo pipefail
APP_DIR=/opt/wgs
REGION="${REGION}"
HEALTH_URL="http://127.0.0.1/api/health"
HEALTH_TIMEOUT_SEC=180

INSTANCE_ID=\$(curl -fsS -H "X-aws-ec2-metadata-token: \$(curl -fsS -X PUT \
  http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60')" \
  http://169.254.169.254/latest/meta-data/instance-id)

INSTANCE_ROLE=\$(aws ec2 describe-tags \
  --filters "Name=resource-id,Values=\$INSTANCE_ID" "Name=key,Values=wgs-role" \
  --query 'Tags[0].Value' --output text --region "\$REGION" 2>/dev/null || true)
[[ "\$INSTANCE_ROLE" == "None" || -z "\$INSTANCE_ROLE" ]] && INSTANCE_ROLE=""

# EIP reassociation runs FIRST and only on the active instance (or when EIP is unassociated).
# Candidate deploys must never move the live Elastic IP — promote-candidate.sh handles that.
wgs_ensure_elastic_ip() {
  local alloc current
  alloc=\$(aws cloudformation describe-stacks --stack-name WgsStack \
    --query "Stacks[0].Outputs[?OutputKey=='ElasticIpAllocationId'].OutputValue" --output text --region "\$REGION" 2>/dev/null || true)
  [[ -z "\$alloc" || "\$alloc" == "None" ]] && return 0

  current=\$(aws ec2 describe-addresses --allocation-ids "\$alloc" --region "\$REGION" \
    --query 'Addresses[0].InstanceId' --output text 2>/dev/null || true)
  [[ "\$current" == "\$INSTANCE_ID" ]] && return 0

  if [[ "\$INSTANCE_ROLE" == "candidate" || "\$INSTANCE_ROLE" == "retired" ]]; then
    echo "Skipping EIP reassociation (wgs-role=\$INSTANCE_ROLE; live traffic stays on active instance)."
    return 0
  fi

  if [[ -z "\$current" || "\$current" == "None" ]]; then
    echo "Elastic IP unassociated — attaching to \$INSTANCE_ID ..."
  elif [[ "\$INSTANCE_ROLE" == "active" || -z "\$INSTANCE_ROLE" ]]; then
    echo "Elastic IP drift detected — re-associating with active instance \$INSTANCE_ID ..."
  else
    echo "Skipping EIP reassociation (instance \$INSTANCE_ID is not active)."
    return 0
  fi

  aws ec2 associate-address --allocation-id "\$alloc" --instance-id "\$INSTANCE_ID" --region "\$REGION" || true
}

wgs_ensure_elastic_ip

mkdir -p "\$APP_DIR"
aws s3 cp "s3://${BUCKET}/${ARTIFACT_KEY}" /tmp/wgs-app.tar.gz --region "\$REGION"
tar -xzf /tmp/wgs-app.tar.gz -C "\$APP_DIR"
rm -f /tmp/wgs-app.tar.gz
chown -R ec2-user:ec2-user "\$APP_DIR"
if [[ -x "\$APP_DIR/deploy/scripts/install-backup-cron.sh" ]]; then
  bash "\$APP_DIR/deploy/scripts/install-backup-cron.sh"
fi
if [[ ! -f "\$APP_DIR/.env" ]]; then
  echo "Missing \$APP_DIR/.env — wait for EC2 user-data, then retry."
  exit 1
fi

cd "\$APP_DIR/deploy"
COMPOSE="docker compose -f docker-compose.prod.yml --env-file \$APP_DIR/.env"

echo "Building images (existing containers keep serving traffic) ..."
\$COMPOSE build api nginx

echo "Recreating API container ..."
\$COMPOSE up -d --no-build --force-recreate api

api_health_ok() {
  docker exec wgs-api node -e "
    require('http').get('http://127.0.0.1:3000/api/health', (r) => {
      process.exit(r.statusCode === 200 ? 0 : 1);
    }).on('error', () => process.exit(1));
  " 2>/dev/null
}

echo "Waiting for API health (timeout \${HEALTH_TIMEOUT_SEC}s) ..."
deadline=\$(( \$(date +%s) + HEALTH_TIMEOUT_SEC ))
while [[ \$(date +%s) -lt \$deadline ]]; do
  if api_health_ok; then
    echo "API health check OK."
    break
  fi
  sleep 2
done
if ! api_health_ok; then
  echo "ERROR: timed out waiting for API health"
  \$COMPOSE ps
  docker logs wgs-api --tail 80 2>&1 || true
  exit 1
fi

echo "Updating nginx (recreates only if image changed) ..."
\$COMPOSE up -d --no-build nginx

echo "Waiting for \$HEALTH_URL via nginx ..."
deadline=\$(( \$(date +%s) + 60 ))
while [[ \$(date +%s) -lt \$deadline ]]; do
  if curl -sf "\$HEALTH_URL" >/dev/null 2>&1; then
    echo "Nginx health check OK."
    break
  fi
  sleep 2
done
if ! curl -sf "\$HEALTH_URL" >/dev/null 2>&1; then
  echo "ERROR: timed out waiting for \$HEALTH_URL"
  \$COMPOSE ps
  docker logs wgs-nginx --tail 40 2>&1 || true
  exit 1
fi

\$COMPOSE ps
REMOTE

B64=$(base64 < "$TMP/remote-deploy.sh" | tr -d '\n')

echo "Running deploy on $INSTANCE_ID via SSM (Docker build may take several minutes)..."
COMMAND_ID=$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunShellScript \
  --timeout-seconds 3600 \
  --parameters "{\"commands\":[\"echo $B64 | base64 -d | bash\"]}" \
  --query Command.CommandId \
  --output text \
  --region "$REGION")

echo "SSM command: $COMMAND_ID"

for _ in $(seq 1 90); do
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
    EIP=$(aws cloudformation describe-stacks --stack-name WgsStack \
      --query "Stacks[0].Outputs[?OutputKey=='ElasticIp'].OutputValue" --output text --region "$REGION" 2>/dev/null || true)
    echo ""
    echo "Deploy complete."
    [[ -n "$EIP" && "$EIP" != "None" ]] && echo "Try: http://$EIP/  and  http://$EIP/api/health"
    exit 0
  fi
  if [[ "$STATUS" == "Failed" || "$STATUS" == "Cancelled" || "$STATUS" == "TimedOut" ]]; then
    echo "SSM deploy failed ($STATUS):"
    aws ssm get-command-invocation \
      --command-id "$COMMAND_ID" \
      --instance-id "$INSTANCE_ID" \
      --query '[StandardOutputContent,StandardErrorContent]' \
      --output text \
      --region "$REGION"
    exit 1
  fi
  echo "  SSM deploy in progress... status=${STATUS} (poll ${_}/90)"
  sleep 10
done

echo "Timed out waiting for SSM (check command $COMMAND_ID in AWS console)."
exit 1
