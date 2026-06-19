#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/lib/load-dev-env.sh
source "$ROOT/scripts/lib/load-dev-env.sh"
load_dev_env "$ROOT"
require_env DB_PASSWORD "Copy .env.example to .env and set DB_PASSWORD."

echo "==> White Glove Source — Database Setup"

# Prefer Homebrew MySQL (docker compose plugin not available on all setups)
if command -v brew &>/dev/null && brew list mysql &>/dev/null 2>&1; then
  echo "==> Starting MySQL via Homebrew..."
  brew services start mysql
  echo "    Waiting for MySQL to accept connections..."
  for i in {1..30}; do
    if mysqladmin ping -u root --silent 2>/dev/null; then
      break
    fi
    sleep 1
  done
elif command -v docker &>/dev/null && docker compose version &>/dev/null 2>&1; then
  echo "==> Starting MySQL via Docker Compose..."
  docker compose up -d
  echo "    Waiting for MySQL container..."
  sleep 8
else
  echo "ERROR: No MySQL found. Install with: brew install mysql"
  echo "       Or install Docker with the compose plugin."
  exit 1
fi

echo "==> Creating database and user..."
mysql -u root <<SQL
CREATE DATABASE IF NOT EXISTS white_glove_delivery;
CREATE USER IF NOT EXISTS 'wgds'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON white_glove_delivery.* TO 'wgds'@'localhost';
FLUSH PRIVILEGES;
SQL

echo "==> Repairing known local schema/data issues..."
mysql -u wgds -p"${DB_PASSWORD}" white_glove_delivery <<'SQL' || true
-- Backfill contract_proposals.projectId from proposalStorageKey when empty
-- (TypeORM uuid columns on MySQL can persist '' and block the unique index on sync)
UPDATE contract_proposals
SET projectId = SUBSTRING_INDEX(SUBSTRING_INDEX(proposalStorageKey, '/', 2), '/', -1)
WHERE (projectId = '' OR projectId IS NULL)
  AND proposalStorageKey LIKE 'project-docs/%/%';

-- Remove orphan rows that still have no projectId
DELETE FROM contract_proposals
WHERE projectId = '' OR projectId IS NULL;
SQL

echo "==> Verifying connection..."
mysql -u wgds -p"${DB_PASSWORD}" -e "SELECT 'Database ready' AS status;" white_glove_delivery

echo ""
echo "Database is ready. Start the backend with:"
echo "  cd backend && npm run start:dev"
