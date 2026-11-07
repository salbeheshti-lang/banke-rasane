#!/usr/bin/env bash
# Keeps the BankResaneh API service (port 3002) alive.
# Checks every 5 seconds; restarts if the health endpoint fails.
set -u
API_DIR="/home/z/my-project/mini-services/api-service"
LOG="/tmp/api-watch.log"
HEALTH_URL="http://127.0.0.1:3002/api/health"

while true; do
  # Check if API is alive
  if curl -sf --max-time 3 "$HEALTH_URL" > /dev/null 2>&1; then
    : # alive, nothing to do
  else
    echo "[$(date)] API down — starting..." >> "$LOG"
    cd "$API_DIR" || exit 1
    # Start in background, fully detached
    nohup bun --hot index.js >> /tmp/api-service.log 2>&1 &
    disown
    # Wait for it to come up
    for i in 1 2 3 4 5 6 7 8 9 10; do
      sleep 1
      if curl -sf --max-time 2 "$HEALTH_URL" > /dev/null 2>&1; then
        echo "[$(date)] API up after ${i}s" >> "$LOG"
        break
      fi
    done
  fi
  sleep 5
done
