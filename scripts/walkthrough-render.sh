#!/usr/bin/env bash
# Record walkthrough video — does not start frontend, backend, or Mailpit.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Walkthrough render (servers must already be running)"

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
  echo "==> Cleared Mailpit inbox"
else
  echo "WARNING: Mailpit not on :8025 — email chapters may fail"
fi

rm -rf walkthrough-results
cd e2e
npx playwright test walkthrough.spec.ts

VIDEO="$(find "$ROOT/walkthrough-results" -name video.webm 2>/dev/null | head -1 || true)"
if [[ -z "${VIDEO}" ]]; then
  echo "ERROR: No video.webm produced"
  exit 1
fi

echo "==> Exporting MP4"
cd "$ROOT"
node scripts/export-walkthrough.mjs "$VIDEO"

echo ""
echo "Output: walkthrough-output/walkthrough.mp4"
