#!/usr/bin/env bash
set -euo pipefail

NAME=wgds-mailpit

if docker ps -a --format '{{.Names}}' | grep -qx "$NAME"; then
  docker stop "$NAME" >/dev/null
  echo "Stopped: $NAME"
else
  echo "No mail container named $NAME"
fi
