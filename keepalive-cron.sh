#!/bin/bash
cd /home/z/my-project

# Start API if not running
if ! pgrep -f "bun --hot.*index" > /dev/null 2>&1; then
  cd /home/z/my-project/mini-services/api-service
  setsid bun --hot index.js < /dev/null > /home/z/my-project/api-service.log 2>&1 &
  disown
  cd /home/z/my-project
  sleep 5
fi

# Start Next if not running
if ! pgrep -f "next-server" > /dev/null 2>&1; then
  rm -f /home/z/my-project/.next/dev/lock 2>/dev/null
  setsid env NODE_OPTIONS="--max-old-space-size=1024" bun run dev < /dev/null > /home/z/my-project/dev.log 2>&1 &
  disown
fi
