#!/usr/bin/env bash
# ============================================================================
#  BankResaneh — Reset dev database to a clean state
#
#  Usage:  bash scripts/reset-dev-db.sh
#
#  What it does:
#    1. Stops the API service (if running)
#    2. Deletes the SQLite database file
#    3. Restarts the API, which re-creates the DB with:
#         - Default admin (admin/admin) with must_change_password=1
#         - All 1302 shows from talk-shows-data.json
#         - id=1 marked as super_admin
#    4. Optionally clears must_change_password so admin can use all endpoints
#       immediately in the dev preview (pass --no-must-change flag)
#
#  This script is for DEVELOPMENT ONLY. Do not use in production.
# ============================================================================
set -eu

DB_PATH="/home/z/my-project/mini-services/api-service/bankresaneh.sqlite"
API_DIR="/home/z/my-project/mini-services/api-service"
CLEAR_MUST_CHANGE="${1:-}"

# Color codes
if [ -t 1 ]; then
  GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
else
  GREEN=''; YELLOW=''; RED=''; CYAN=''; NC=''
fi

echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  BankResaneh — Dev DB Reset${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo

# Step 1: Stop the API service
echo -e "${YELLOW}→ Stopping API service...${NC}"
pkill -f "bun --hot index.js" 2>/dev/null || true
sleep 2
if ss -tlnp 2>/dev/null | grep -q ":3002"; then
  echo "  WARN: port 3002 still in use, force-killing..."
  fuser -k 3002/tcp 2>/dev/null || true
  sleep 2
fi
echo -e "  ${GREEN}✓ stopped${NC}"

# Step 2: Delete the DB
if [ -f "$DB_PATH" ]; then
  echo -e "${YELLOW}→ Deleting database at:$NC $DB_PATH"
  rm -f "$DB_PATH"
  rm -f "${DB_PATH}-wal" "${DB_PATH}-shm" 2>/dev/null || true
  echo -e "  ${GREEN}✓ deleted${NC}"
else
  echo -e "  ${YELLOW}(no DB file found — will be created fresh)${NC}"
fi

# Step 3: Restart the API (it will seed a fresh DB)
echo -e "${YELLOW}→ Restarting API service...${NC}"
cd "$API_DIR"
(setsid bun --hot index.js > /tmp/api.log 2>&1 < /dev/null &)
cd /home/z/my-project
sleep 4

# Wait up to 15s for API to come up
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -s -o /dev/null --max-time 2 http://localhost:3002/api/health; then
    echo -e "  ${GREEN}✓ API ready after ${i} attempt(s)${NC}"
    break
  fi
  sleep 1
done

# Verify health
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3002/api/health)
if [ "$HEALTH" != "200" ]; then
  echo -e "  ${RED}✗ API health check failed (HTTP $HEALTH)${NC}"
  echo "  See /tmp/api.log for details:"
  tail -20 /tmp/api.log
  exit 1
fi

# Step 4: Optionally clear must_change_password so admin can access all endpoints
if [ "$CLEAR_MUST_CHANGE" = "--no-must-change" ] || [ "$CLEAR_MUST_CHANGE" = "-n" ]; then
  echo -e "${YELLOW}→ Clearing must_change_password flag...${NC}"
  cd "$API_DIR"
  bun -e '
    import { Database } from "bun:sqlite";
    const db = new Database("bankresaneh.sqlite");
    db.prepare("UPDATE users SET must_change_password = 0 WHERE id = 1").run();
    const u = db.prepare("SELECT id, username, must_change_password, is_super_admin FROM users WHERE id = 1").get();
    console.log("  admin:", JSON.stringify(u));
  ' 2>&1
  cd /home/z/my-project
fi

# Step 5: Verify
echo
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ Dev database reset successfully${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo
echo "  Admin login:"
echo "    username: admin"
echo "    password: admin"
echo
echo "  API:  http://localhost:3002/api"
echo "  Next: http://localhost:3000"
echo
echo "  To skip must_change_password (for dev convenience):"
echo "    bash scripts/reset-dev-db.sh --no-must-change"
echo
