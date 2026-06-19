#!/usr/bin/env bash
# Run docker compose with dev secrets from gitignored env files.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/lib/load-dev-env.sh
source "$ROOT/scripts/lib/load-dev-env.sh"
load_dev_env "$ROOT"

export DB_PASSWORD
export MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-local-dev-unused}"

exec docker compose "$@"
