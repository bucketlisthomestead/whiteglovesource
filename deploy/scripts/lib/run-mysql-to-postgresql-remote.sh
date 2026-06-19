#!/usr/bin/env bash
# Runs on EC2 via SSM during MySQL -> PostgreSQL migration.
# Expects env: MYSQL_* PG_* S3_BUCKET AWS_REGION; optional SKIP_BACKUP=1
set -euo pipefail

: "${MYSQL_HOST:?MYSQL_HOST required}"
: "${MYSQL_USER:?MYSQL_USER required}"
: "${MYSQL_PASSWORD:?MYSQL_PASSWORD required}"
: "${MYSQL_DATABASE:?MYSQL_DATABASE required}"
: "${PG_HOST:?PG_HOST required}"
: "${PG_USER:?PG_USER required}"
: "${PG_PASSWORD:?PG_PASSWORD required}"
: "${PG_DATABASE:?PG_DATABASE required}"
: "${S3_BUCKET:?S3_BUCKET required}"

REGION="${AWS_REGION:-us-east-1}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
PG_PORT="${PG_PORT:-5432}"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
WORKDIR="/tmp/wgs-pg-migrate-${STAMP}"
mkdir -p "$WORKDIR"

urlencode() {
  jq -n --arg v "$1" '$v|@uri' -r
}

MYSQL_PASS_ENC=$(urlencode "$MYSQL_PASSWORD")
PG_PASS_ENC=$(urlencode "$PG_PASSWORD")

RDS_CA="${WORKDIR}/rds-global-bundle.pem"
curl -fsSL "https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem" -o "$RDS_CA" || true
export PGSSLMODE="${PGSSLMODE:-disable}"
export PGSSLROOTCERT="${PGSSLROOTCERT:-$RDS_CA}"

echo "[wgs-pg-migrate] Installing clients (mariadb105, postgresql15) ..."
dnf install -y mariadb105 postgresql15 2>/dev/null || true

echo "[wgs-pg-migrate] Ensuring pgloader is available ..."
PGLOADER_BIN=""
ARCH=$(uname -m)
if [[ "$ARCH" == "x86_64" ]] && ! command -v pgloader >/dev/null 2>&1; then
  BUILD_SCRIPT="/tmp/build-pgloader-x86.sh"
  aws s3 cp "s3://${S3_BUCKET}/deploy/scripts/build-pgloader-x86.sh" "$BUILD_SCRIPT" --region "$REGION"
  chmod +x "$BUILD_SCRIPT"
  "$BUILD_SCRIPT"
fi
if command -v pgloader >/dev/null 2>&1 && [[ "$ARCH" == "x86_64" ]]; then
  PGLOADER_BIN="pgloader"
elif docker info >/dev/null 2>&1; then
  echo "[wgs-pg-migrate] Setting up amd64 emulation for pgloader on ${ARCH} ..."
  dnf install -y qemu-user-static 2>/dev/null || true
  docker run --rm --privileged tonistiigi/binfmt:latest --install all 2>/dev/null \
    || docker run --rm --privileged multiarch/qemu-user-static --reset -p yes 2>/dev/null \
    || true
  docker pull --platform linux/amd64 dimitri/pgloader:latest
  PGLOADER_BIN="docker run --rm --network host -v ${WORKDIR}:${WORKDIR} dimitri/pgloader:latest pgloader"
else
  echo "ERROR: pgloader not found and Docker unavailable."
  exit 1
fi

if [[ "${SKIP_BACKUP:-0}" != "1" ]]; then
  DUMP="${WORKDIR}/mysql-pre-migrate.sql.gz"
  echo "[wgs-pg-migrate] Backing up MySQL to ${DUMP} ..."
  mysqldump \
    -h "$MYSQL_HOST" \
    -P "$MYSQL_PORT" \
    -u "$MYSQL_USER" \
    -p"$MYSQL_PASSWORD" \
    --single-transaction \
    --routines \
    --triggers \
    "$MYSQL_DATABASE" | gzip > "$DUMP"

  S3_KEY="backups/mysql/pre-postgresql-migrate-${MYSQL_DATABASE}-${STAMP}.sql.gz"
  aws s3 cp "$DUMP" "s3://${S3_BUCKET}/${S3_KEY}" --region "$REGION"
  echo "[wgs-pg-migrate] MySQL backup uploaded to s3://${S3_BUCKET}/${S3_KEY}"
fi

LOAD_FILE="${WORKDIR}/pgloader.load"
cat > "$LOAD_FILE" <<EOF
LOAD DATABASE
     FROM mysql://${MYSQL_USER}:${MYSQL_PASS_ENC}@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}
     INTO postgresql://${PG_USER}:${PG_PASS_ENC}@${PG_HOST}:${PG_PORT}/${PG_DATABASE}?sslmode=disable

 WITH include drop, create tables, create indexes, reset sequences,
      workers = 4, concurrency = 1,
      batch rows = 1000,
      prefetch rows = 1000

 CAST type datetime to timestamptz drop default drop not null using zero-dates-to-null,
      type date drop not null drop default using zero-dates-to-null,
      type json to jsonb drop typemod

 SET PostgreSQL PARAMETERS
      maintenance_work_mem to '256MB',
      work_mem to '64MB'

 SET MySQL PARAMETERS
      net_read_timeout  = '120',
      net_write_timeout = '120';
EOF

LOG_FILE="${WORKDIR}/pgloader.log"
echo "[wgs-pg-migrate] Running pgloader (log: ${LOG_FILE}) ..."
set +e
# shellcheck disable=SC2086
$PGLOADER_BIN "$LOAD_FILE" 2>&1 | tee "$LOG_FILE"
PGLOADER_STATUS=${PIPESTATUS[0]}
set -e

PG_LOG_KEY="backups/postgresql/pgloader-${PG_DATABASE}-${STAMP}.log"
aws s3 cp "$LOG_FILE" "s3://${S3_BUCKET}/${PG_LOG_KEY}" --region "$REGION"
echo "[wgs-pg-migrate] pgloader log uploaded to s3://${S3_BUCKET}/${PG_LOG_KEY}"

if [[ "$PGLOADER_STATUS" -ne 0 ]] || grep -qE 'ERROR mysql:|^KABOOM!' "$LOG_FILE"; then
  echo "ERROR: pgloader failed (status=$PGLOADER_STATUS)"
  tail -50 "$LOG_FILE" || true
  exit 1
fi

echo "[wgs-pg-migrate] Moving tables to public schema ..."
PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" <<SQL
ALTER SCHEMA public RENAME TO public_old;
ALTER SCHEMA ${MYSQL_DATABASE} RENAME TO public;
DROP SCHEMA IF EXISTS public_old CASCADE;
GRANT ALL ON SCHEMA public TO ${PG_USER};
GRANT ALL ON ALL TABLES IN SCHEMA public TO ${PG_USER};
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${PG_USER};
ALTER DATABASE ${PG_DATABASE} SET search_path TO public;
ALTER ROLE ${PG_USER} SET search_path TO public;
SQL

echo "[wgs-pg-migrate] Converting MySQL tinyint (smallint) booleans to PostgreSQL boolean ..."
PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" <<'SQL'
DO $$
DECLARE
  r RECORD;
  def boolean;
BEGIN
  FOR r IN
    SELECT table_name, column_name, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND data_type = 'smallint'
  LOOP
    def := COALESCE(r.column_default LIKE '%1%', false);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I DROP DEFAULT', r.table_name, r.column_name);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I TYPE boolean USING (%I != 0)', r.table_name, r.column_name, r.column_name);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I SET DEFAULT %s', r.table_name, r.column_name, def);
  END LOOP;
END $$;
SQL

echo "[wgs-pg-migrate] Verifying row counts ..."
MYSQL_TABLES=$(mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" \
  -N -e "SELECT table_name FROM information_schema.tables WHERE table_schema='${MYSQL_DATABASE}' AND table_type='BASE TABLE' ORDER BY table_name" \
  "$MYSQL_DATABASE")

MISMATCH=0
while IFS= read -r table; do
  [[ -z "$table" ]] && continue
  mysql_count=$(mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" \
    -N -e "SELECT COUNT(*) FROM \`${table}\`" "$MYSQL_DATABASE")
  pg_count=$(PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" -t -A \
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
done <<< "$MYSQL_TABLES"

rm -rf "$WORKDIR"

if [[ "$MISMATCH" -gt 0 ]]; then
  echo "ERROR: ${MISMATCH} table(s) failed row-count verification."
  exit 1
fi

echo "[wgs-pg-migrate] Migration and verification complete."
