#!/usr/bin/env bash
# Install daily PostgreSQL backup cron on EC2 (called from user-data and SSM deploy).
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/wgs}"
SCRIPT="${APP_DIR}/deploy/scripts/backup-postgresql-to-s3.sh"

if [[ ! -f "$SCRIPT" ]]; then
  echo "Missing $SCRIPT"
  exit 1
fi

if ! command -v pg_dump &>/dev/null; then
  dnf install -y postgresql15 2>/dev/null || true
fi

install -m 755 "$SCRIPT" /usr/local/bin/wgs-backup-postgresql
rm -f /etc/cron.d/wgs-mysql-backup
cat > /etc/cron.d/wgs-postgresql-backup <<'CRON'
15 3 * * * root /usr/local/bin/wgs-backup-postgresql >> /var/log/wgs-postgresql-backup.log 2>&1
CRON
echo "Installed PostgreSQL backup cron (/etc/cron.d/wgs-postgresql-backup)"
