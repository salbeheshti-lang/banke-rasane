#!/bin/bash
# Startup script — starts both API and Next.js dev server.
# This script runs in the background and keeps both services alive.

LOG=/home/z/my-project/startup.log
echo "[$(date +%T)] Starting services..." > $LOG

# Kill any existing processes
pkill -9 -f "next-server" 2>/dev/null
pkill -9 -f "bun run dev" 2>/dev/null
pkill -9 -f "bun --hot" 2>/dev/null
sleep 3

# Start API service
cd /home/z/my-project/mini-services/api-service
nohup bun --hot index.js > /home/z/my-project/api-service.log 2>&1 &
echo "[$(date +%T)] API PID: $!" >> $LOG

# Wait for API to be ready
for i in $(seq 1 10); do
  sleep 2
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 5 http://localhost:3002/api/health 2>/dev/null)
  if [ "$code" = "200" ]; then
    echo "[$(date +%T)] API ready" >> $LOG
    break
  fi
done

# Start Next.js dev server
cd /home/z/my-project
rm -rf .next
NODE_OPTIONS="--max-old-space-size=1024" nohup bun run dev > /home/z/my-project/dev.log 2>&1 &
echo "[$(date +%T)] Next PID: $!" >> $LOG

# Wait for Next to be ready
for i in $(seq 1 15); do
  sleep 3
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 10 http://localhost:3000/ 2>/dev/null)
  if [ "$code" = "200" ]; then
    echo "[$(date +%T)] Next ready" >> $LOG
    break
  fi
done

# Final check
PREVIEW=$(curl -s -o /dev/null -w "%{http_code}" -m 10 http://localhost:3000/ 2>/dev/null)
API=$(curl -s -o /dev/null -w "%{http_code}" -m 10 http://localhost:3002/api/health 2>/dev/null)
echo "[$(date +%T)] Final: Preview=$PREVIEW API=$API" >> $LOG

# Keep the script alive so the child processes don't get killed
echo "[$(date +%T)] Services running. Keeping alive..." >> $LOG

# Simple watchdog loop
while true; do
  sleep 30
  if ! pgrep -f "next-server" > /dev/null 2>&1; then
    echo "[$(date +%T)] next-server died, restarting..." >> $LOG
    cd /home/z/my-project
    rm -f .next/dev/lock 2>/dev/null
    NODE_OPTIONS="--max-old-space-size=1024" nohup bun run dev > /home/z/my-project/dev.log 2>&1 &
    sleep 20
  fi
  if ! pgrep -f "bun --hot.*index" > /dev/null 2>&1; then
    echo "[$(date +%T)] api-service died, restarting..." >> $LOG
    cd /home/z/my-project/mini-services/api-service
    nohup bun --hot index.js > /home/z/my-project/api-service.log 2>&1 &
    cd /home/z/my-project
    sleep 5
  fi
done
