#!/bin/bash
# Watchdog to keep Next.js dev server alive
cd /home/z/my-project
LOG="/home/z/my-project/watchdog.log"
echo "[$(date +%T)] watchdog starting" >> $LOG
while true; do
  if ! pgrep -f "next-server" > /dev/null; then
    echo "[$(date +%T)] next-server not running, starting..." >> $LOG
    # Truncate log to prevent growth
    > dev.log
    NODE_OPTIONS="--max-old-space-size=1024" nohup bun run dev > dev.log 2>&1 &
    disown
    # Wait for first compile
    for i in 1 2 3 4 5 6 7 8 9 10; do
      sleep 5
      code=$(curl -s -o /dev/null -w "%{http_code}" -m 10 http://localhost:3000/ 2>/dev/null)
      if [ "$code" = "200" ]; then
        echo "[$(date +%T)] server ready (HTTP 200)" >> $LOG
        break
      fi
    done
  fi
  sleep 5
done
