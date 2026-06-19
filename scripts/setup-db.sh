#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/lib/load-dev-env.sh
source "$ROOT/scripts/lib/load-dev-env.sh"
load_dev_env "$ROOT"
require_env DB_PASSWORD "Copy .env.example to .env and set DB_PASSWORD."

DB_TYPE="${DB_TYPE:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-}"
DB_USERNAME="${DB_USERNAME:-wgds}"
DB_DATABASE="${DB_DATABASE:-white_glove_delivery}"

if [[ "$DB_TYPE" == "postgres" ]]; then
  DB_PORT="${DB_PORT:-5432}"
else
  DB_PORT="${DB_PORT:-3306}"
fi

echo "==> White Glove Source — Database Setup (${DB_TYPE})"

wait_for_postgres() {
  echo "    Waiting for PostgreSQL to accept connections..."
  if command -v docker &>/dev/null && docker compose version &>/dev/null 2>&1 \
    && docker compose ps --status running postgres &>/dev/null 2>&1; then
    for i in {1..30}; do
      if docker compose exec -T postgres pg_isready -U "$DB_USERNAME" -d "$DB_DATABASE" >/dev/null 2>&1; then
        return 0
      fi
      sleep 1
    done
  elif command -v pg_isready &>/dev/null; then
    for i in {1..30}; do
      if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" >/dev/null 2>&1; then
        return 0
      fi
      sleep 1
    done
  fi
  return 1
}

verify_postgres() {
  if command -v docker &>/dev/null && docker compose version &>/dev/null 2>&1 \
    && docker compose ps --status running postgres &>/dev/null 2>&1; then
    docker compose exec -T postgres psql -U "$DB_USERNAME" -d "$DB_DATABASE" \
      -c "SELECT 'Database ready' AS status;"
    return
  fi
  if command -v psql &>/dev/null; then
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_DATABASE" \
      -c "SELECT 'Database ready' AS status;"
    return
  fi
  echo "ERROR: psql not found and postgres container is not running."
  exit 1
}

setup_postgres() {
  if command -v docker &>/dev/null && docker compose version &>/dev/null 2>&1; then
    echo "==> Starting PostgreSQL via Docker Compose..."
    export MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-local-dev-unused}"
    export DB_PASSWORD
    docker compose up -d postgres
    wait_for_postgres || {
      echo "ERROR: PostgreSQL did not become ready in time."
      exit 1
    }
  elif command -v brew &>/dev/null && brew list postgresql@16 &>/dev/null 2>&1; then
    echo "==> Starting PostgreSQL via Homebrew..."
    brew services start postgresql@16
    wait_for_postgres || {
      echo "ERROR: PostgreSQL did not become ready in time."
      exit 1
    }
  else
    echo "ERROR: No PostgreSQL found. Install Docker with the compose plugin,"
    echo "       or: brew install postgresql@16"
    exit 1
  fi

  echo "==> Verifying connection..."
  verify_postgres
}

setup_mysql() {
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
    export MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-local-dev-unused}"
    export DB_PASSWORD
    docker compose up -d mysql
    echo "    Waiting for MySQL container..."
    sleep 8
  else
    echo "ERROR: No MySQL found. Install with: brew install mysql"
    echo "       Or install Docker with the compose plugin."
    exit 1
  fi

  echo "==> Creating database and user..."
  mysql -u root <<SQL
CREATE DATABASE IF NOT EXISTS ${DB_DATABASE};
CREATE USER IF NOT EXISTS '${DB_USERNAME}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON ${DB_DATABASE}.* TO '${DB_USERNAME}'@'localhost';
FLUSH PRIVILEGES;
SQL

  echo "==> Repairing known local schema/data issues..."
  mysql -u "$DB_USERNAME" -p"${DB_PASSWORD}" "$DB_DATABASE" <<'SQL' || true
UPDATE contract_proposals
SET projectId = SUBSTRING_INDEX(SUBSTRING_INDEX(proposalStorageKey, '/', 2), '/', -1)
WHERE (projectId = '' OR projectId IS NULL)
  AND proposalStorageKey LIKE 'project-docs/%/%';

DELETE FROM contract_proposals
WHERE projectId = '' OR projectId IS NULL;
SQL

  echo "==> Verifying connection..."
  mysql -u "$DB_USERNAME" -p"${DB_PASSWORD}" -e "SELECT 'Database ready' AS status;" "$DB_DATABASE"
}

if [[ "$DB_TYPE" == "postgres" ]]; then
  setup_postgres
else
  setup_mysql
fi

echo ""
echo "Database is ready (${DB_TYPE} on ${DB_HOST}:${DB_PORT}). Start the backend with:"
echo "  cd backend && npm run start:dev"
if [[ "$DB_TYPE" == "postgres" ]]; then
  echo ""
  echo "Migrating existing MySQL data locally:"
  echo "  ./scripts/migrate-mysql-to-postgresql-local.sh"
fi
