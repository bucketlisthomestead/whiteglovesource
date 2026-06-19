#!/usr/bin/env bash
set -euo pipefail
export PATH=/usr/local/bin:$PATH

urlencode() {
  jq -n --arg v "$1" '$v|@uri' -r
}

MYSQL_JSON=$(aws secretsmanager get-secret-value --secret-id arn:aws:secretsmanager:us-east-1:536579406753:secret:wgs/db-EPvQXk --region us-east-1 --query SecretString --output text)
MYSQL_USER=$(echo "$MYSQL_JSON" | jq -r .username)
MYSQL_PASSWORD=$(echo "$MYSQL_JSON" | jq -r .password)
MYSQL_DATABASE=$(echo "$MYSQL_JSON" | jq -r .dbname)
MYSQL_HOST=wgsstack-dbinstance9e2e5045-gfvf7p5dhtbq.cttrtjhyp7dk.us-east-1.rds.amazonaws.com

PG_JSON=$(aws secretsmanager get-secret-value --secret-id arn:aws:secretsmanager:us-east-1:536579406753:secret:wgs/pg-ZHlJGW --region us-east-1 --query SecretString --output text)
PG_USER=$(echo "$PG_JSON" | jq -r .username)
PG_PASSWORD=$(echo "$PG_JSON" | jq -r .password)
PG_DATABASE=$(echo "$PG_JSON" | jq -r .dbname)
PG_HOST=wgs-postgres.cttrtjhyp7dk.us-east-1.rds.amazonaws.com

MYSQL_PASS_ENC=$(urlencode "$MYSQL_PASSWORD")
PG_PASS_ENC=$(urlencode "$PG_PASSWORD")
echo "mysql_enc_len=${#MYSQL_PASS_ENC} pg_enc_len=${#PG_PASS_ENC}"

LOAD=/tmp/test-mysql.load
cat > "$LOAD" <<EOF
LOAD DATABASE
     FROM mysql://${MYSQL_USER}:${MYSQL_PASS_ENC}@${MYSQL_HOST}:3306/${MYSQL_DATABASE}
     INTO postgresql://${PG_USER}:${PG_PASS_ENC}@${PG_HOST}:5432/${PG_DATABASE}?sslmode=disable
 WITH include drop, create tables, workers = 2, concurrency = 1
 CAST type datetime to timestamptz drop default drop not null using zero-dates-to-null;
EOF

echo "Running pgloader dry-run connection test ..."
pgloader --dry-run "$LOAD" 2>&1 | head -20
