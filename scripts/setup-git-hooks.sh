#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "ERROR: Not a git repository."
  echo "       Run 'git init' first, then run this script again."
  exit 1
fi

git config core.hooksPath .githooks

HOOKS_PATH="$(git config --get core.hooksPath)"
if [[ "$HOOKS_PATH" != ".githooks" ]]; then
  echo "ERROR: Failed to set core.hooksPath (got: ${HOOKS_PATH:-<unset>})"
  exit 1
fi

chmod +x .githooks/pre-commit

echo "Git hooks enabled."
echo "  core.hooksPath = .githooks"
echo "  pre-commit     = secret scan (scripts/pre-commit-scan.sh)"
