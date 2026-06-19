#!/bin/bash
# EC2 bootstrap for White Glove Moving Service (Amazon Linux 2023 ARM).
# Expects env vars set by CDK user-data wrapper:
#   WGS_BUCKET, WGS_DB_SECRET_ARN, WGS_JWT_SECRET_ARN, WGS_RDS_ENDPOINT, AWS_REGION
# Optional: WGS_EIP_ALLOCATION_ID (active instance only; associate Elastic IP on boot)

set -euo pipefail
exec > >(tee /var/log/wgs-user-data.log) 2>&1

echo "[wgs] Starting user-data bootstrap at $(date -Is)"

# --- Packages: Docker + AWS CLI v2 + PostgreSQL client for RDS backups ---
dnf update -y
dnf install -y docker cronie jq postgresql15
systemctl enable --now docker
usermod -aG docker ec2-user

mkdir -p /usr/local/lib/docker/cli-plugins
curl -fsSL "https://github.com/docker/compose/releases/download/v2.32.4/docker-compose-linux-aarch64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
ln -sf /usr/local/lib/docker/cli-plugins/docker-compose /usr/local/bin/docker-compose

if ! command -v aws &>/dev/null; then
  curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o /tmp/awscliv2.zip
  unzip -q /tmp/awscliv2.zip -d /tmp
  /tmp/aws/install
  rm -rf /tmp/aws /tmp/awscliv2.zip
fi

# --- App layout ---
APP_DIR=/opt/wgs
mkdir -p "$APP_DIR"/{deploy,content/site,uploads,storage,scripts}
chown -R ec2-user:ec2-user "$APP_DIR"

# --- Fetch secrets into .env (created on first boot; deploy script refreshes on updates) ---
REGION="${AWS_REGION:-us-east-1}"
JWT_JSON=$(aws secretsmanager get-secret-value --secret-id "$WGS_JWT_SECRET_ARN" --region "$REGION" --query SecretString --output text)
JWT_SECRET=$(echo "$JWT_JSON" | jq -r '.secret')

# PostgreSQL (production default)
if [[ -n "${WGS_PG_RDS_ENDPOINT:-}" && -n "${WGS_PG_DB_SECRET_ARN:-}" ]]; then
  PG_JSON=$(aws secretsmanager get-secret-value --secret-id "$WGS_PG_DB_SECRET_ARN" --region "$REGION" --query SecretString --output text)
  DB_TYPE=postgres
  DB_HOST="${WGS_PG_RDS_ENDPOINT}"
  DB_PORT=5432
  DB_USERNAME=$(echo "$PG_JSON" | jq -r '.username')
  DB_PASSWORD=$(echo "$PG_JSON" | jq -r '.password')
  DB_DATABASE=$(echo "$PG_JSON" | jq -r '.dbname // .database // "white_glove_delivery"')
elif [[ -n "${WGS_DB_SECRET_ARN:-}" ]]; then
  # Legacy MySQL bootstrap (pre-cutover instances only)
  DB_JSON=$(aws secretsmanager get-secret-value --secret-id "$WGS_DB_SECRET_ARN" --region "$REGION" --query SecretString --output text)
  DB_TYPE=mysql
  DB_PASSWORD=$(echo "$DB_JSON" | jq -r '.password')
  DB_USERNAME=$(echo "$DB_JSON" | jq -r '.username')
  DB_DATABASE=$(echo "$DB_JSON" | jq -r '.dbname')
  DB_HOST="${WGS_RDS_ENDPOINT:-$(echo "$DB_JSON" | jq -r '.host // empty')}"
  DB_PORT=3306
else
  echo "[wgs] ERROR: PostgreSQL env vars not set (WGS_PG_RDS_ENDPOINT + WGS_PG_DB_SECRET_ARN)"
  exit 1
fi

# First boot on empty RDS: set TYPEORM_SYNCHRONIZE=true once, then false for subsequent deploys
TYPEORM_SYNCHRONIZE="${TYPEORM_SYNCHRONIZE:-false}"

cat > "$APP_DIR/.env" <<EOF
NODE_ENV=production
TYPEORM_SYNCHRONIZE=${TYPEORM_SYNCHRONIZE}
PORT=3000

DB_TYPE=${DB_TYPE}
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT:-3306}
DB_USERNAME=${DB_USERNAME}
DB_PASSWORD=${DB_PASSWORD}
DB_DATABASE=${DB_DATABASE}

JWT_SECRET=${JWT_SECRET}

STORAGE_BACKEND=s3
S3_BUCKET=${WGS_BUCKET}
AWS_REGION=${REGION}

CORS_ORIGIN=
EOF
chmod 600 "$APP_DIR/.env"
chown ec2-user:ec2-user "$APP_DIR/.env"

# --- Backup cron (daily 03:15 UTC) ---
if [[ -x "$APP_DIR/deploy/scripts/install-backup-cron.sh" ]]; then
  bash "$APP_DIR/deploy/scripts/install-backup-cron.sh"
fi

# --- Start stack if compose file already present (re-deploy / AMI refresh) ---
if [[ -f "$APP_DIR/deploy/docker-compose.prod.yml" ]]; then
  cd "$APP_DIR/deploy"
  docker compose -f docker-compose.prod.yml --env-file "$APP_DIR/.env" pull --ignore-pull-failures || true
  docker compose -f docker-compose.prod.yml --env-file "$APP_DIR/.env" up -d --build
fi

# --- Associate Elastic IP on active instance (skipped for candidates) ---
# Retry: CDK may delete the old CloudFormation EIPAssociation after this instance boots,
# leaving the EIP unassociated if the first attempt ran too early.
if [[ -n "${WGS_EIP_ALLOCATION_ID:-}" ]]; then
  INSTANCE_ID=$(curl -fsS -H "X-aws-ec2-metadata-token: $(curl -fsS -X PUT \
    http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60')" \
    http://169.254.169.254/latest/meta-data/instance-id)
  for attempt in $(seq 1 12); do
    CURRENT=$(aws ec2 describe-addresses \
      --allocation-ids "$WGS_EIP_ALLOCATION_ID" \
      --region "$REGION" \
      --query 'Addresses[0].InstanceId' \
      --output text 2>/dev/null || true)
    if [[ "$CURRENT" == "$INSTANCE_ID" ]]; then
      echo "[wgs] Elastic IP already associated with this instance"
      break
    fi
    echo "[wgs] Associating Elastic IP allocation $WGS_EIP_ALLOCATION_ID (attempt $attempt) ..."
    if [[ -n "$CURRENT" && "$CURRENT" != "None" ]]; then
      ASSOC=$(aws ec2 describe-addresses \
        --allocation-ids "$WGS_EIP_ALLOCATION_ID" \
        --region "$REGION" \
        --query 'Addresses[0].AssociationId' \
        --output text)
      aws ec2 disassociate-address --association-id "$ASSOC" --region "$REGION" || true
      sleep 5
    fi
    if aws ec2 associate-address \
      --allocation-id "$WGS_EIP_ALLOCATION_ID" \
      --instance-id "$INSTANCE_ID" \
      --region "$REGION"; then
      echo "[wgs] Elastic IP associated successfully"
      break
    fi
    echo "[wgs] EIP association failed; retrying in 30s ..."
    sleep 30
  done
fi

echo "[wgs] User-data bootstrap complete at $(date -Is)"
