#!/usr/bin/env bash
# Local MySQL -> PostgreSQL migration test (Docker Compose, no AWS).
#
# Usage:
#   ./scripts/migrate-mysql-to-postgresql-local.sh [--skip-backup] [--verify-api]
#
# Prerequisites:
#   docker compose, mysql client (optional for backup)
#
# After migration, test the API against PostgreSQL:
#   DB_TYPE=postgres DB_PORT=5432 npm run start:dev   # in backend/
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/lib/load-dev-env.sh
source "$ROOT/scripts/lib/load-dev-env.sh"
load_dev_env "$ROOT"
require_env DB_PASSWORD "Copy .env.example to .env and set DB_PASSWORD."

run_with_timeout() {
  local secs="$1"
  shift
  if command -v timeout &>/dev/null; then
    timeout "$secs" "$@"
  elif command -v gtimeout &>/dev/null; then
    gtimeout "$secs" "$@"
  else
    "$@" &
    local pid=$!
    local elapsed=0
    while kill -0 "$pid" 2>/dev/null && [[ "$elapsed" -lt "$secs" ]]; do
      sleep 1
      elapsed=$((elapsed + 1))
    done
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      return 124
    fi
    wait "$pid"
  fi
}

SKIP_BACKUP=false
VERIFY_API=false
for arg in "$@"; do
  case "$arg" in
    --skip-backup) SKIP_BACKUP=true ;;
    --verify-api) VERIFY_API=true ;;
    -h|--help)
      sed -n '2,14p' "$0"
      exit 0
      ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USER="${MYSQL_USER:-wgds}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:-$DB_PASSWORD}"
MYSQL_DATABASE="${MYSQL_DATABASE:-white_glove_delivery}"

PG_HOST="${PG_HOST:-127.0.0.1}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-wgds}"
PG_PASSWORD="${PG_PASSWORD:-$DB_PASSWORD}"
PG_DATABASE="${PG_DATABASE:-white_glove_delivery}"

echo "==> Starting PostgreSQL (docker compose) ..."
docker compose up -d postgres

USE_DOCKER_MYSQL=false
if docker compose up -d mysql 2>/dev/null; then
  if docker compose ps mysql --format '{{.State}}' 2>/dev/null | grep -qi running; then
    USE_DOCKER_MYSQL=true
  fi
fi

if [[ "$USE_DOCKER_MYSQL" != true ]]; then
  echo "    Docker MySQL unavailable (port 3306 in use?) — using host MySQL at ${MYSQL_HOST}:${MYSQL_PORT}"
  if ! mysql -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" -h "$MYSQL_HOST" -P "$MYSQL_PORT" -e "SELECT 1" "$MYSQL_DATABASE" &>/dev/null; then
    echo "ERROR: Cannot connect to host MySQL. Stop local MySQL or free port 3306."
    exit 1
  fi
fi

mysql_exec() {
  if [[ "$USE_DOCKER_MYSQL" == true ]]; then
    docker compose exec -T mysql mysql -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$@"
  else
    mysql -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" -h "$MYSQL_HOST" -P "$MYSQL_PORT" "$@"
  fi
}

mysqldump_exec() {
  if [[ "$USE_DOCKER_MYSQL" == true ]]; then
    docker compose exec -T mysql mysqldump -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$@"
  else
    if mysqldump -u root --set-gtid-purged=OFF "$@" "$MYSQL_DATABASE" &>/dev/null; then
      mysqldump -u root --set-gtid-purged=OFF "$@" "$MYSQL_DATABASE"
    else
      mysqldump -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" -h "$MYSQL_HOST" -P "$MYSQL_PORT" "$@" "$MYSQL_DATABASE"
    fi
  fi
}

echo "==> Waiting for PostgreSQL ..."
for i in $(seq 1 60); do
  if docker compose exec -T postgres pg_isready -U "$PG_USER" -d "$PG_DATABASE" >/dev/null 2>&1; then
    break
  fi
  [[ "$i" -eq 60 ]] && { echo "Timed out waiting for PostgreSQL."; exit 1; }
  sleep 2
done

# Ensure MySQL has schema/data (TypeORM sync or existing volume).
MYSQL_TABLES=$(mysql_exec -N -e \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${MYSQL_DATABASE}' AND table_type='BASE TABLE'" \
  "$MYSQL_DATABASE" 2>/dev/null || echo "0")

if [[ "$MYSQL_TABLES" == "0" ]]; then
  echo "==> MySQL is empty — seeding via backend (TYPEORM_SYNCHRONIZE + seed) ..."
  if [[ ! -f "$ROOT/backend/.env" ]]; then
    cp "$ROOT/backend/.env.example" "$ROOT/backend/.env"
  fi
  (cd "$ROOT/backend" && npm run build)
  (cd "$ROOT/backend" && \
    DB_HOST=127.0.0.1 DB_PORT=3306 DB_TYPE=mysql TYPEORM_SYNCHRONIZE=true \
    run_with_timeout 120 npm run start:prod) || true
  MYSQL_TABLES=$(mysql_exec -N -e \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${MYSQL_DATABASE}' AND table_type='BASE TABLE'" \
    "$MYSQL_DATABASE")
fi

echo "    MySQL tables: $MYSQL_TABLES"
if [[ "$MYSQL_TABLES" == "0" ]]; then
  echo "ERROR: MySQL still has no tables. Run the backend against MySQL first, then retry."
  exit 1
fi

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
WORKDIR="$ROOT/.local/pg-migrate-${STAMP}"
mkdir -p "$WORKDIR"
DUMP_FILE="${WORKDIR}/mysql-pre-migrate.sql.gz"

echo "==> Dumping source MySQL to ${DUMP_FILE} ..."
mysqldump_exec --skip-lock-tables --routines --triggers \
  | gzip > "$DUMP_FILE"

# pgloader cannot auth to MySQL 9+ from its bundled client; stage data in MySQL 8.
echo "==> Staging MySQL 8 copy for pgloader (port 3307) ..."
docker compose -f docker-compose.yml -f docker-compose.migrate.yml up -d mysql-migrate postgres

for i in $(seq 1 60); do
  if docker compose -f docker-compose.yml -f docker-compose.migrate.yml exec -T mysql-migrate \
    mysqladmin ping -h localhost -uroot -p"${MYSQL_ROOT_PASSWORD}" --silent 2>/dev/null \
    && docker compose exec -T postgres pg_isready -U "$PG_USER" -d "$PG_DATABASE" >/dev/null 2>&1; then
    break
  fi
  [[ "$i" -eq 60 ]] && { echo "Timed out waiting for staging databases."; exit 1; }
  sleep 2
done

echo "==> Restoring dump into MySQL 8 staging container ..."
gunzip -c "$DUMP_FILE" \
  | docker compose -f docker-compose.yml -f docker-compose.migrate.yml exec -T mysql-migrate \
    mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" "$MYSQL_DATABASE"

# pgloader on the compose network (service DNS names).
PGLOADER_MYSQL_HOST="mysql-migrate"
PGLOADER_PG_HOST="postgres"
PGLOADER_MYSQL_PORT="3306"
PGLOADER_PG_PORT="5432"

urlencode() {
  python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$1"
}
MYSQL_PASS_ENC=$(urlencode "$MYSQL_PASSWORD")
PG_PASS_ENC=$(urlencode "$PG_PASSWORD")

LOAD_FILE="${WORKDIR}/pgloader.load"
cat > "$LOAD_FILE" <<EOF
LOAD DATABASE
     FROM mysql://${MYSQL_USER}:${MYSQL_PASS_ENC}@${PGLOADER_MYSQL_HOST}:${PGLOADER_MYSQL_PORT}/${MYSQL_DATABASE}
     INTO postgresql://${PG_USER}:${PG_PASS_ENC}@${PGLOADER_PG_HOST}:${PGLOADER_PG_PORT}/${PG_DATABASE}

 WITH include drop, create tables, create indexes, reset sequences,
      workers = 2, concurrency = 1,
      batch rows = 1000

 CAST type datetime to timestamptz drop default drop not null using zero-dates-to-null,
      type date drop not null drop default using zero-dates-to-null,
      type json to jsonb drop typemod

 SET PostgreSQL PARAMETERS
      maintenance_work_mem to '128MB',
      work_mem to '32MB';
EOF

COMPOSE_NETWORK=$(docker inspect wgds-postgres --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}')

echo "==> Running pgloader on Docker network ${COMPOSE_NETWORK} ..."
docker pull dimitri/pgloader:latest 2>/dev/null || true
set +e
docker run --rm \
  --platform linux/amd64 \
  --network "$COMPOSE_NETWORK" \
  -v "${LOAD_FILE}:/load.load:ro" \
  dimitri/pgloader:latest \
  pgloader /load.load 2>&1 | tee "${WORKDIR}/pgloader.log"
PG_STATUS=${PIPESTATUS[0]}
set -e

if [[ "$PG_STATUS" -ne 0 ]]; then
  echo "ERROR: pgloader failed (exit $PG_STATUS). Log: ${WORKDIR}/pgloader.log"
  exit "$PG_STATUS"
fi

echo "==> Moving tables to public schema (TypeORM default) ..."
docker compose exec -T postgres psql -U "$PG_USER" -d "$PG_DATABASE" <<SQL
ALTER SCHEMA public RENAME TO public_old;
ALTER SCHEMA ${MYSQL_DATABASE} RENAME TO public;
DROP SCHEMA public_old CASCADE;
GRANT ALL ON SCHEMA public TO ${PG_USER};
GRANT ALL ON ALL TABLES IN SCHEMA public TO ${PG_USER};
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${PG_USER};
SQL

echo "==> Verifying row counts ..."
MISMATCH=0
TABLES=$(docker compose -f docker-compose.yml -f docker-compose.migrate.yml exec -T mysql-migrate \
  mysql -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" -N -e \
  "SELECT table_name FROM information_schema.tables WHERE table_schema='${MYSQL_DATABASE}' AND table_type='BASE TABLE' ORDER BY table_name" \
  "$MYSQL_DATABASE")

while IFS= read -r table; do
  [[ -z "$table" ]] && continue
  mysql_count=$(docker compose -f docker-compose.yml -f docker-compose.migrate.yml exec -T mysql-migrate \
    mysql -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" -N -e "SELECT COUNT(*) FROM \`${table}\`" "$MYSQL_DATABASE")
  pg_count=$(docker compose exec -T postgres psql -U "$PG_USER" -d "$PG_DATABASE" -t -A \
    -c "SELECT COUNT(*) FROM public.\"${table}\"" 2>/dev/null || echo "ERR")
  if [[ "$pg_count" == "ERR" ]]; then
    echo "  ${table}: mysql=${mysql_count} postgres=MISSING"
    MISMATCH=$((MISMATCH + 1))
  elif [[ "$mysql_count" != "$pg_count" ]]; then
    echo "  ${table}: mysql=${mysql_count} postgres=${pg_count} MISMATCH"
    MISMATCH=$((MISMATCH + 1))
  else
    echo "  ${table}: ${mysql_count} rows OK"
  fi
done <<< "$TABLES"

if [[ "$MISMATCH" -gt 0 ]]; then
  echo "ERROR: ${MISMATCH} table(s) failed verification."
  exit 1
fi

echo ""
echo "==> Local migration succeeded."
echo "    Log: ${WORKDIR}/pgloader.log"
echo ""
echo "Test API against PostgreSQL:"
echo "  cd backend && DB_TYPE=postgres DB_HOST=127.0.0.1 DB_PORT=5432 npm run start:dev"

if [[ "$VERIFY_API" == true ]]; then
  echo ""
  echo "==> Smoke test: starting API on PostgreSQL ..."
  (cd "$ROOT/backend" && \
    DB_TYPE=postgres DB_HOST=127.0.0.1 DB_PORT=5432 DB_USERNAME="$PG_USER" \
    DB_PASSWORD="$PG_PASSWORD" DB_DATABASE="$PG_DATABASE" TYPEORM_SYNCHRONIZE=false \
    run_with_timeout 90 npm run start:prod) &
  API_PID=$!
  for i in $(seq 1 30); do
    if curl -sf http://127.0.0.1:3001/api/health >/dev/null 2>&1; then
      echo "    Health check OK: http://127.0.0.1:3001/api/health"
      kill "$API_PID" 2>/dev/null || true
      wait "$API_PID" 2>/dev/null || true
      exit 0
    fi
    sleep 2
  done
  kill "$API_PID" 2>/dev/null || true
  echo "ERROR: API health check failed on PostgreSQL."
  exit 1
fi
