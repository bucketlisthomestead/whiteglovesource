#!/usr/bin/env bash
# Build, upload to S3, and deploy on EC2 via SSM (no SSH required).
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
mkdir -p "\$APP_DIR"
aws s3 cp "s3://${BUCKET}/${ARTIFACT_KEY}" /tmp/wgs-app.tar.gz --region "${REGION}"
tar -xzf /tmp/wgs-app.tar.gz -C "\$APP_DIR"
rm -f /tmp/wgs-app.tar.gz
chown -R ec2-user:ec2-user "\$APP_DIR"
if [[ ! -f "\$APP_DIR/.env" ]]; then
  echo "Missing \$APP_DIR/.env — wait for EC2 user-data, then retry."
  exit 1
fi
cd "\$APP_DIR/deploy"
docker compose -f docker-compose.prod.yml --env-file "\$APP_DIR/.env" up -d --build
docker compose -f docker-compose.prod.yml ps
# Ensure Elastic IP is attached (survives CDK instance replacement / CFN EIPAssociation removal)
ALLOC=\$(aws cloudformation describe-stacks --stack-name WgsStack \
  --query "Stacks[0].Outputs[?OutputKey=='ElasticIpAllocationId'].OutputValue" --output text --region "${REGION}" 2>/dev/null || true)
if [[ -n "\$ALLOC" && "\$ALLOC" != "None" ]]; then
  IID=\$(curl -fsS -H "X-aws-ec2-metadata-token: \$(curl -fsS -X PUT \
    http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60')" \
    http://169.254.169.254/latest/meta-data/instance-id)
  CURRENT=\$(aws ec2 describe-addresses --allocation-ids "\$ALLOC" --region "${REGION}" \
    --query 'Addresses[0].InstanceId' --output text 2>/dev/null || true)
  if [[ "\$CURRENT" != "\$IID" ]]; then
    echo "Re-associating Elastic IP \$ALLOC with \$IID ..."
    aws ec2 associate-address --allocation-id "\$ALLOC" --instance-id "\$IID" --region "${REGION}" || true
  fi
fi
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
  sleep 10
done

echo "Timed out waiting for SSM (check command $COMMAND_ID in AWS console)."
exit 1
