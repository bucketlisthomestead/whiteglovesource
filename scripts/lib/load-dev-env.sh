#!/usr/bin/env bash
# Source local-only env files (gitignored). Safe to call multiple times.
load_dev_env() {
  local root="${1:-}"
  if [[ -z "$root" ]]; then
    root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  fi
  local f
  for f in "$root/.env" "$root/.env.localstack" "$root/backend/.env"; do
    if [[ -f "$f" ]]; then
      set -a
      # shellcheck disable=SC1090
      source "$f"
      set +a
    fi
  done
}

require_env() {
  local name="$1"
  local hint="${2:-Set it in .env (copy from .env.example) or backend/.env}"
  if [[ -z "${!name:-}" ]]; then
    echo "ERROR: ${name} is required. ${hint}" >&2
    exit 1
  fi
}
