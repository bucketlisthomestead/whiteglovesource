#!/usr/bin/env bash
# Stand up LocalStack + local dependencies and wire the app like production (S3, Secrets Manager).
#
# Usage:
#   ./deploy/scripts/deploy-localstack.sh              # infra + init + DB + app (nginx :80)
#   ./deploy/scripts/deploy-localstack.sh --infra-only # skip app containers (Postgres/LocalStack only)
#   ./deploy/scripts/deploy-localstack.sh --backend    # copy .env.localstack -> backend/.env
#
# Prerequisites: Docker, AWS CLI v2 (or pip install localstack[aws] for awslocal), jq, curl
# /etc/hosts: 127.0.0.1 local.whiteglovesource.com
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/lib/load-dev-env.sh
source "$ROOT/scripts/lib/load-dev-env.sh"
load_dev_env "$ROOT"
require_env DB_PASSWORD "Copy .env.example to .env and set DB_PASSWORD."

RUN_APP=1
WRITE_BACKEND_ENV=0
for arg in "$@"; do
  case "$arg" in
    --infra-only) RUN_APP=0 ;;
    --docker) echo "NOTE: --docker is deprecated; app stack starts by default." >&2 ;;
    --backend) WRITE_BACKEND_ENV=1 ;;
    -h|--help)
      sed -n '2,13p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

LOCAL_DOMAIN="${LOCAL_DOMAIN:-local.whiteglovesource.com}"

echo "==> White Glove Source — LocalStack local deploy"
echo "    Workspace: $ROOT"
echo "    App URL:     http://${LOCAL_DOMAIN}"

if ! grep -qE "[[:space:]]${LOCAL_DOMAIN}([[:space:]]|$)" /etc/hosts 2>/dev/null; then
  echo ""
  echo "WARN: Add this line to /etc/hosts (requires sudo):"
  echo "  127.0.0.1 ${LOCAL_DOMAIN}"
  echo ""
fi

if ! command -v docker &>/dev/null; then
  echo "ERROR: Docker is required." >&2
  exit 1
fi
if ! docker compose version &>/dev/null; then
  echo "ERROR: docker compose plugin is required." >&2
  exit 1
fi
if ! command -v aws &>/dev/null && ! command -v awslocal &>/dev/null; then
  echo "ERROR: Install AWS CLI v2 or awslocal (pip install 'localstack[aws]')." >&2
  exit 1
fi
if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required for Secrets Manager bootstrap." >&2
  exit 1
fi

LOCALSTACK_SERVICES=(postgres mailpit localstack)

echo "==> Starting PostgreSQL, Mailpit, and LocalStack ..."
LOCALSTACK_ENDPOINT="${LOCALSTACK_ENDPOINT:-http://localhost:4566}"
if curl -sf "${LOCALSTACK_ENDPOINT}/_localstack/health" >/dev/null 2>&1; then
  echo "    LocalStack already running at ${LOCALSTACK_ENDPOINT} — starting DB/Mailpit only."
  if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qx 'wgds-localstack'; then
    if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -qx 'wgds-localstack'; then
      echo ""
      echo "WARN: Port 4566 is in use by another LocalStack (not wgds-localstack)."
      echo "      S3 init below targets that instance. If the S3 UI stays empty, stop the"
      echo "      other LocalStack (e.g. awslocal-localstack-1) and run: npm run localstack:up"
      echo ""
    fi
  fi
  export DB_PASSWORD
  export MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-local-dev-unused}"
  docker compose -f docker-compose.yml up -d postgres mailpit
else
  export DB_PASSWORD
  export MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-local-dev-unused}"
  docker compose -f docker-compose.yml -f docker-compose.localstack.yml up -d "${LOCALSTACK_SERVICES[@]}"
fi

chmod +x "$ROOT/scripts/localstack-init.sh"
"$ROOT/scripts/localstack-init.sh"

echo "==> Verifying PostgreSQL database ..."
export DB_TYPE=postgres
export DB_PORT=5432
for i in {1..30}; do
  if docker compose exec -T postgres pg_isready -U wgds -d white_glove_delivery >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
if ! docker compose exec -T postgres pg_isready -U wgds -d white_glove_delivery >/dev/null 2>&1; then
  echo "ERROR: PostgreSQL did not become ready. Run: npm run db:setup" >&2
  exit 1
fi
docker compose exec -T postgres psql -U wgds -d white_glove_delivery \
  -c "SELECT 'PostgreSQL ready' AS status;"
echo "    PostgreSQL ready (wgds / white_glove_delivery on :5432)."

ENV_FILE="$ROOT/.env.localstack"
if [[ ! -f "$ENV_FILE" ]]; then
  cp "$ROOT/.env.localstack.example" "$ENV_FILE"
  echo "==> Created $ENV_FILE from example."
else
  echo "==> Using existing $ENV_FILE"
fi

if [[ "$WRITE_BACKEND_ENV" -eq 1 ]]; then
  cp "$ENV_FILE" "$ROOT/backend/.env"
  echo "==> Copied $ENV_FILE -> backend/.env"
fi

if [[ "$RUN_APP" -eq 1 ]]; then
  echo "==> Building and starting app stack (nginx :80 -> frontend + api) ..."
  docker compose \
    -f deploy/docker-compose.localstack.yml \
    --env-file "$ENV_FILE" \
    up -d --build
  echo ""
  echo "App: http://${LOCAL_DOMAIN}"
  echo "Health: curl -s http://${LOCAL_DOMAIN}/api/health"
else
  echo ""
  echo "Infra only — start app stack manually:"
  echo "  docker compose -f deploy/docker-compose.localstack.yml --env-file .env.localstack up -d --build"
fi

echo ""
echo "LocalStack health:  curl -s http://localhost:4566/_localstack/health | jq ."
echo "S3 bucket listing:  aws --endpoint-url=http://localhost:4566 s3 ls s3://wgs-local-app/"
