#!/bin/bash
cd /home/z/my-project
export NEXT_TELEMETRY_DISABLED=1
exec node /home/z/my-project/node_modules/.bin/next dev -p 3000 > /home/z/my-project/dev.log 2>&1
