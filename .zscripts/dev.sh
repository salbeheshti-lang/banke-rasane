#!/bin/bash
# Custom dev startup script — takes priority over the default bun+db:push flow
# in /start.sh. The default flow dies on `bun run db:push` (no such script in
# package.json) which, under `set -e`, kills the subshell before `bun run dev`
# ever runs. This script skips the non-existent db:push step.
set -e
cd /home/z/my-project
bun install --frozen-lockfile 2>/dev/null || bun install
exec bun run dev
