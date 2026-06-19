#!/usr/bin/env bash
set -euo pipefail

NAME=wgds-mailpit
IMAGE=axllent/mailpit:latest

if docker ps -a --format '{{.Names}}' | grep -qx "$NAME"; then
  docker start "$NAME" >/dev/null
  echo "Started existing container: $NAME"
else
  docker run -d --name "$NAME" -p 1025:1025 -p 8025:8025 "$IMAGE" >/dev/null
  echo "Created and started: $NAME"
fi

echo "SMTP:  localhost:1025"
echo "Inbox: http://localhost:8025"
