#!/usr/bin/env bash
# Sync deploy artifacts to EC2 and restart Docker Compose.
# Usage: ./deploy/scripts/push-and-deploy.sh [user@host]
#
# Requires: ssh/scp access (prefer SSM port-forward or Session Manager plugin).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HOST="${1:-}"
REMOTE_DIR=/opt/wgs

if [[ -z "$HOST" ]]; then
  echo "Usage: $0 user@elastic-ip-or-host"
  echo "Example: $0 ec2-user@203.0.113.10"
  exit 1
fi

echo "Building frontend and backend locally..."
(cd "$ROOT/frontend" && npm run build)
(cd "$ROOT/backend" && npm run build)

echo "Syncing to $HOST:$REMOTE_DIR ..."
rsync -avz --delete \
  --exclude node_modules \
  --exclude .git \
  --exclude backend/node_modules \
  --exclude frontend/node_modules \
  --exclude infra/cdk.out \
  "$ROOT/backend" \
  "$ROOT/frontend" \
  "$ROOT/content" \
  "$ROOT/deploy" \
  "$HOST:$REMOTE_DIR/"

echo "Restarting containers on remote..."
ssh "$HOST" "cd $REMOTE_DIR/deploy && docker compose -f docker-compose.prod.yml --env-file $REMOTE_DIR/.env up -d --build"

echo "Deploy complete. Check: http://\${HOST#*@}/api/health"
