#!/usr/bin/env bash
# Run the walkthrough in a visible browser (no video mux). Servers must already be running.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE="${1:-watch}"

if ! curl -sf -o /dev/null http://localhost:5173/; then
  echo "ERROR: Frontend not running at http://localhost:5173"
  exit 1
fi

if ! curl -sf -o /dev/null http://localhost:3001/api/catalog/pieces; then
  echo "ERROR: Backend not running at http://localhost:3001"
  exit 1
fi

if curl -sf -o /dev/null http://localhost:8025/; then
  curl -sf -X DELETE http://localhost:8025/api/v1/messages || true
fi

export WALKTHROUGH_HEADED=1

cd e2e

if [[ "$MODE" == "debug" ]]; then
  echo "==> Debug mode — Playwright Inspector will open; step with the ▶ button"
  echo "    Trace saved to walkthrough-results/ if the run fails"
  export WALKTHROUGH_DEBUG=1
  npx playwright test walkthrough.spec.ts --debug
elif [[ "$MODE" == "ui" ]]; then
  echo "==> UI mode — use the Playwright time-travel panel"
  npx playwright test walkthrough.spec.ts --ui
else
  echo "==> Watch mode — visible browser, still records video.webm"
  npx playwright test walkthrough.spec.ts
fi
