#!/bin/bash
cd /home/z/my-project
# Check if next-server is running
if ! pgrep -f "next-server" > /dev/null; then
  date >> /home/z/my-project/keep-alive.log
  > dev.log
  NODE_OPTIONS="--max-old-space-size=1024" nohup bun run dev > dev.log 2>&1 &
  disown
fi
# Check if API service is running
if ! pgrep -f "bun --hot.*index" > /dev/null; then
  cd /home/z/my-project/mini-services/api-service
  nohup bun --hot index.js > /home/z/my-project/api-service.log 2>&1 &
  disown
  cd /home/z/my-project
fi
