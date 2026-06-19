#!/usr/bin/env bash
# Shared helpers for reading DB credentials from Secrets Manager and /opt/wgs/.env.
set -euo pipefail

# Read a key from /opt/wgs/.env without sourcing (safe for special characters).
wgs_env_from_file() {
  local file="$1"
  local key="$2"
  grep -E "^${key}=" "$file" | head -1 | cut -d= -f2-
}

wgs_urlencode() {
  python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$1"
}

wgs_escape_pgloader_single_quoted() {
  # Escape single quotes for pgloader WITH password '...' literals.
  printf '%s' "$1" | sed "s/'/''/g"
}

wgs_fetch_db_secret() {
  local secret_arn="$1"
  local region="${2:-${AWS_REGION:-us-east-1}}"
  aws secretsmanager get-secret-value \
    --secret-id "$secret_arn" \
    --region "$region" \
    --query SecretString \
    --output text
}

wgs_secret_field() {
  local json="$1"
  local field="$2"
  echo "$json" | jq -r --arg f "$field" '.[$f] // empty'
}
