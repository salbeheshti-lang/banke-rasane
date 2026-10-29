#!/bin/bash
# Keeps the BankResaneh API service (port 3002) alive across restarts.
cd /home/z/my-project/mini-services/api-service
while true; do
  setsid bun run dev >> /home/z/my-project/mini-services/api-service/api.log 2>&1 < /dev/null
  echo "$(date) - api-service exited, restarting in 2s..." >> /home/z/my-project/mini-services/api-service/api.log
  sleep 2
done
