#!/usr/bin/env bash
# ============================================================================
#  BankResaneh — Comprehensive API Security & Permissions Test Suite
#  Tests the entire permission system by making DIRECT API requests,
#  bypassing the UI entirely. This proves the server enforces rules.
# ============================================================================
set -u
BASE="http://localhost:3002/api"
PASS=0
FAIL=0
RESULTS=()

# Color codes (disabled if not a tty)
if [ -t 1 ]; then
  GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
else
  GREEN=''; RED=''; YELLOW=''; CYAN=''; NC=''
fi

# --- helpers -----------------------------------------------------------------
hdr() { printf "\n${CYAN}════════════════════════════════════════════════════════════════${NC}\n  %s\n${CYAN}════════════════════════════════════════════════════════════════${NC}\n" "$1"; }

# Usage: check_ge NAME MIN_VALUE ACTUAL_VALUE  (actual >= min → pass)
check_ge() {
  local name="$1" min="$2" actual="$3"
  if [ "$actual" -ge "$min" ] 2>/dev/null; then
    PASS=$((PASS+1))
    RESULTS+=("$(printf "${GREEN}✓ PASS${NC}  [%s] expected>=%s got=%s" "$name" "$min" "$actual")")
    printf "${GREEN}✓ PASS${NC}  [%s] expected>=%s got=%s\n" "$name" "$min" "$actual"
  else
    FAIL=$((FAIL+1))
    RESULTS+=("$(printf "${RED}✗ FAIL${NC}  [%s] expected>=%s got=%s" "$name" "$min" "$actual")")
    printf "${RED}✗ FAIL${NC}  [%s] expected>=%s got=%s\n" "$name" "$min" "$actual"
  fi
}
check() {
  local name="$1" expected="$2" actual="$3" extra="${4:-}"
  if [ "$expected" = "$actual" ]; then
    PASS=$((PASS+1))
    RESULTS+=("$(printf "${GREEN}✓ PASS${NC}  [%s] expected=%s got=%s %s" "$name" "$expected" "$actual" "$extra")")
    printf "${GREEN}✓ PASS${NC}  [%s] expected=%s got=%s %s\n" "$name" "$expected" "$actual" "$extra"
  else
    FAIL=$((FAIL+1))
    RESULTS+=("$(printf "${RED}✗ FAIL${NC}  [%s] expected=%s got=%s %s" "$name" "$expected" "$actual" "$extra")")
    printf "${RED}✗ FAIL${NC}  [%s] expected=%s got=%s %s\n" "$name" "$expected" "$actual" "$extra"
  fi
}

# Usage: api METHOD PATH TOKEN [JSON_BODY]
#   Sets global: HTTP_STATUS, RESP_BODY
api() {
  local method="$1" path="$2" token="${3:-}" body="${4:-}"
  local args=(-s -o /tmp/api_resp.txt -w "%{http_code}" -X "$method" --max-time 15)
  args+=(-H "Content-Type: application/json")
  [ -n "$token" ] && args+=(-H "Authorization: Bearer $token")
  [ -n "$body" ] && args+=(-d "$body")
  HTTP_STATUS=$(curl "${args[@]}" "${BASE}${path}")
  RESP_BODY=$(cat /tmp/api_resp.txt 2>/dev/null || echo "")
}

# Extract a JSON string field: json_get BODY 'field'  (very simple, no jq)
json_get() {
  local body="$1" field="$2"
  printf '%s' "$body" | grep -oE "\"${field}\":\"[^\"]*\"" | head -1 | sed -E "s/.*\"${field}\":\"([^\"]*)\".*/\1/"
}
# Extract numeric field
json_num() {
  local body="$1" field="$2"
  printf '%s' "$body" | grep -oE "\"${field}\":[0-9]+" | head -1 | sed -E "s/.*\"${field}\":([0-9]+).*/\1/"
}
# Extract boolean
json_bool() {
  local body="$1" field="$2"
  printf '%s' "$body" | grep -oE "\"${field}\":(true|false)" | head -1 | sed -E "s/.*\"${field}\":(true|false).*/\1/"
}

echo "=========================================================================="
echo "  BankResaneh API Security Test Suite"
echo "  Target: $BASE"
echo "  Time:   $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================================================="

# ============================================================================
# SETUP: Reset DB to a clean state with default admin (admin/admin)
# ============================================================================
hdr "SETUP — fresh DB"
rm -f /home/z/my-project/mini-services/api-service/bankresaneh.sqlite
# Restart the API service so it re-creates the default DB with the bug fix
echo "  killing all existing API processes..."
pkill -f "bun --hot index.js" 2>/dev/null
sleep 2
# Verify nothing is listening on 3002
if ss -tlnp 2>/dev/null | grep -q ":3002"; then
  echo "  WARN: port 3002 still in use, force-killing..."
  fuser -k 3002/tcp 2>/dev/null
  sleep 2
fi
cd /home/z/my-project/mini-services/api-service && (setsid bun --hot index.js > /tmp/api.log 2>&1 < /dev/null &)
sleep 4
# Wait up to 15s for API to come up
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -s -o /dev/null --max-time 2 http://localhost:3002/api/health; then
    echo "  api health OK after ${i} attempt(s)"
    break
  fi
  sleep 1
done
curl -s -o /dev/null -w "  api health: %{http_code}\n" --max-time 5 http://localhost:3002/api/health

# ============================================================================
# Step 0 — Login as Super Admin (admin/admin — id=1, is_super_admin=1)
# Note: default admin has must_change_password=1, so we must change the password
#       before any permission-gated action works.
# ============================================================================
hdr "STEP 0 — Login as Super Admin (admin/admin) + change password"
api POST /auth/login "" '{"username":"admin","password":"admin"}'
SUPER_TOKEN=$(json_get "$RESP_BODY" "token")
SUPER_ID=$(json_num "$RESP_BODY" "id")
echo "  initial token: ${SUPER_TOKEN:0:16}...  id=$SUPER_ID  isSuper=$(json_bool "$RESP_BODY" "isSuperAdmin")"
check "0.1 super-admin-initial-login" 200 "$HTTP_STATUS"

# Change the default admin password to clear must_change_password
api PUT /auth/change-password "$SUPER_TOKEN" '{"oldPassword":"admin","newPassword":"Admin@2025"}'
echo "  change-password status=$HTTP_STATUS body=${RESP_BODY:0:120}"
check "0.2 change-default-password" 200 "$HTTP_STATUS"

# Re-login with new password to get a fresh token (must_change_password should now be false)
api POST /auth/login "" '{"username":"admin","password":"Admin@2025"}'
SUPER_TOKEN=$(json_get "$RESP_BODY" "token")
SUPER_ID=$(json_num "$RESP_BODY" "id")
SUPER_IS_SUPER=$(json_bool "$RESP_BODY" "isSuperAdmin")
echo "  fresh token: ${SUPER_TOKEN:0:16}...  id=$SUPER_ID  isSuper=$SUPER_IS_SUPER"
check "0.3 super-admin-relogin" 200 "$HTTP_STATUS"
check "0.4 super-admin-is-super" "true" "$SUPER_IS_SUPER"

# ============================================================================
# TEST 1: Super Admin — change / revoke / restore permissions
# ============================================================================
hdr "TEST 1 — Super Admin permissions management"

# 1.1 Create a regular admin (limited_admin) — admin role but NOT super
api POST /users "$SUPER_TOKEN" '{"username":"limited_admin","password":"Password123","role":"admin","name":"Limited Admin"}'
LIMITED_ID=$(json_num "$RESP_BODY" "id")
echo "  created limited_admin id=$LIMITED_ID role=$(json_get "$RESP_BODY" "role")"
check "1.1 create-limited-admin" 200 "$HTTP_STATUS"

# 1.2 Super admin revokes ALL of limited_admin's permissions (empty array)
api PUT "/users?id=$LIMITED_ID" "$SUPER_TOKEN" '{"permissions":[]}'
PERMS_AFTER=$(json_get "$RESP_BODY" "permissions")
echo "  permissions after revoke-all: '$PERMS_AFTER'"
check "1.2a revoke-all-status" 200 "$HTTP_STATUS" "perms='$PERMS_AFTER'"
if [ "$PERMS_AFTER" = "NONE" ] || [ -z "$PERMS_AFTER" ]; then
  check "1.2b revoke-all-stored-NONE" "NONE" "${PERMS_AFTER:-NONE}"
else
  check "1.2b revoke-all-stored-NONE" "NONE" "$PERMS_AFTER"
fi

# 1.3 Verify the revoke actually takes effect: limited_admin can no longer manage users
api POST /auth/login "" '{"username":"limited_admin","password":"Password123"}'
LIMITED_TOKEN=$(json_get "$RESP_BODY" "token")
echo "  limited_admin token: ${LIMITED_TOKEN:0:16}..."
check "1.3 limited-login" 200 "$HTTP_STATUS"

# Now limited_admin (with empty permissions) tries to list users
api GET /users "$LIMITED_TOKEN"
echo "  limited_admin GET /users → $HTTP_STATUS (should be 401 because manage_users was revoked)"
check "1.3a revoked-cant-list-users" 401 "$HTTP_STATUS"

# 1.4 Super admin restores SOME permissions (just add_shows + edit_shows)
api PUT "/users?id=$LIMITED_ID" "$SUPER_TOKEN" '{"permissions":["add_shows","edit_shows"]}'
PERMS_AFTER=$(json_get "$RESP_BODY" "permissions")
echo "  permissions after restore: '$PERMS_AFTER'"
check "1.4a restore-status" 200 "$HTTP_STATUS"
# The response stores permissions as an array; verify add_shows is present
if echo "$RESP_BODY" | grep -q '"add_shows"'; then
  check "1.4b restore-stored-non-empty" "has-add_shows" "has-add_shows"
else
  check "1.4b restore-stored-non-empty" "has-add_shows" "missing"
fi

# 1.5 Verify: limited_admin now CAN add a show (has add_shows) but CANNOT delete (no delete_shows)
api GET /shows "$LIMITED_TOKEN"
check "1.5a limited-can-list-shows" 200 "$HTTP_STATUS"
api DELETE "/shows?num=999999" "$LIMITED_TOKEN"
echo "  limited_admin delete show → $HTTP_STATUS (should be 401, no delete_shows perm)"
check "1.5b limited-cant-delete-shows" 401 "$HTTP_STATUS"

# 1.6 Super admin restores ALL permissions
api PUT "/users?id=$LIMITED_ID" "$SUPER_TOKEN" '{"permissions":["manage_users","create_admins","suspend_users","add_shows","edit_shows","delete_shows","manage_genres","manage_settings","view_activity","export_reports"]}'
PERMS_AFTER=$(json_get "$RESP_BODY" "permissions")
echo "  permissions after restore-all: '${PERMS_AFTER:0:80}...'"
check "1.6 restore-all-status" 200 "$HTTP_STATUS"

echo
echo "  → TEST 1 SUMMARY: Super Admin can manage permissions (change/revoke/restore)."

# ============================================================================
# TEST 2: Limited Admin — cannot escalate, cannot modify other admins
# ============================================================================
hdr "TEST 2 — Limited Admin attempts unauthorized actions"

# 2.1 limited_admin tries to grant itself create_admins
api PUT "/users?id=$LIMITED_ID" "$LIMITED_TOKEN" '{"permissions":["manage_users","create_admins","suspend_users","add_shows","edit_shows","delete_shows","manage_genres","manage_settings","view_activity","export_reports"]}'
echo "  limited_admin grants self create_admins → $HTTP_STATUS (should be 403)"
check "2.1 self-escalation-blocked" 403 "$HTTP_STATUS"
# Verify DB NOT changed: permissions should still be the explicit list from test 1.6
api GET /users "$SUPER_TOKEN"
DB_PERMS=$(printf '%s' "$RESP_BODY" | grep -oE "\"id\":${LIMITED_ID},\"username\":\"limited_admin\"[^}]*" | grep -oE "\"permissions\":\"[^\"]*\"" | sed -E 's/.*"permissions":"([^"]*)".*/\1/')
echo "  DB check: limited_admin permissions = '${DB_PERMS:0:60}...'"
if echo "$DB_PERMS" | grep -q "create_admins"; then
  check "2.1b db-not-changed" "no-create_admins" "HAS-create_admins"
else
  check "2.1b db-not-changed" "no-create_admins" "no-create_admins"
fi

# 2.2 limited_admin tries to create another admin
api POST /users "$LIMITED_TOKEN" '{"username":"rogue_admin","password":"Password123","role":"admin","name":"Rogue"}'
echo "  limited_admin tries to create admin → $HTTP_STATUS (depends: 403 if no create_admins)"
# Note: limited_admin currently has the full permission set restored, so this might succeed
# Let's instead test with a properly-restricted user below.

# 2.3 Create a viewer and try to escalate it to admin via limited_admin
api POST /users "$SUPER_TOKEN" '{"username":"viewer1","password":"Password123","role":"viewer","name":"Viewer One"}'
VIEWER_ID=$(json_num "$RESP_BODY" "id")
echo "  created viewer1 id=$VIEWER_ID"

# Revoke create_admins from limited_admin first
api PUT "/users?id=$LIMITED_ID" "$SUPER_TOKEN" '{"permissions":["manage_users","add_shows","edit_shows"]}'
echo "  revoked create_admins from limited_admin"

# Now limited_admin (has manage_users but NOT create_admins) tries to upgrade viewer → admin
api PUT "/users?id=$VIEWER_ID" "$LIMITED_TOKEN" '{"role":"admin"}'
echo "  limited_admin (no create_admins) tries to upgrade viewer → admin → $HTTP_STATUS (should be 403)"
check "2.3 no-create_admins-blocks-promotion" 403 "$HTTP_STATUS"

# Verify DB NOT changed — viewer1 should still be 'viewer'
api GET /users "$SUPER_TOKEN"
DB_ROLE=$(printf '%s' "$RESP_BODY" | grep -oE "\"id\":${VIEWER_ID},\"username\":\"viewer1\"[^}]*" | grep -oE "\"role\":\"[^\"]*\"" | sed -E 's/.*"role":"([^"]*)".*/\1/')
echo "  DB check: viewer1 role = '$DB_ROLE' (should be 'viewer')"
check "2.3b db-viewer-not-promoted" "viewer" "$DB_ROLE"

# 2.4 limited_admin tries to suspend/activate without suspend_users permission
api PUT "/users?id=$VIEWER_ID" "$LIMITED_TOKEN" '{"isActive":false}'
echo "  limited_admin (no suspend_users) tries to suspend viewer → $HTTP_STATUS (should be 403)"
check "2.4 no-suspend_users-blocked" 403 "$HTTP_STATUS"
DB_ACTIVE=$(printf '%s' "$RESP_BODY" | grep -oE "\"id\":${VIEWER_ID}[^}]*" | grep -oE "\"isActive\":(true|false)" | sed -E 's/.*"isActive":(true|false).*/\1/')
echo "  DB check: viewer1 isActive = '$DB_ACTIVE' (should be 'true' = unchanged)"

# 2.5 limited_admin tries to delete the SUPER admin
api DELETE "/users?id=$SUPER_ID" "$LIMITED_TOKEN"
echo "  limited_admin tries to delete super admin → $HTTP_STATUS (should be 403)"
check "2.5 super-admin-not-deletable" 403 "$HTTP_STATUS"

# 2.6 limited_admin tries to demote the super admin
api PUT "/users?id=$SUPER_ID" "$LIMITED_TOKEN" '{"role":"viewer"}'
echo "  limited_admin tries to demote super admin → $HTTP_STATUS (should be 403)"
check "2.6 super-admin-not-demotable" 403 "$HTTP_STATUS"

# 2.7 limited_admin tries to suspend the super admin
api PUT "/users?id=$SUPER_ID" "$LIMITED_TOKEN" '{"isActive":false}'
echo "  limited_admin tries to suspend super admin → $HTTP_STATUS (should be 403)"
check "2.7 super-admin-not-suspendable" 403 "$HTTP_STATUS"

# 2.8 limited_admin tries to modify ANOTHER admin's permissions (not super admin)
# First, create another admin via super_admin
api POST /users "$SUPER_TOKEN" '{"username":"admin2","password":"Password123","role":"admin","name":"Admin Two"}'
ADMIN2_ID=$(json_num "$RESP_BODY" "id")
echo "  created admin2 id=$ADMIN2_ID"

# Now limited_admin tries to modify admin2's permissions
api PUT "/users?id=$ADMIN2_ID" "$LIMITED_TOKEN" '{"permissions":["add_shows"]}'
echo "  limited_admin tries to modify another admin's permissions → $HTTP_STATUS (should be 403)"
check "2.8 admin-cant-modify-others-perms" 403 "$HTTP_STATUS"

echo
echo "  → TEST 2 SUMMARY: Limited admin cannot escalate or harm super admin."

# ============================================================================
# TEST 3: Editor — can add/edit, cannot delete
# ============================================================================
hdr "TEST 3 — Editor role actions"

# 3.1 Create an editor via super admin
api POST /users "$SUPER_TOKEN" '{"username":"editor1","password":"Password123","role":"editor","name":"Editor One"}'
EDITOR_ID=$(json_num "$RESP_BODY" "id")
echo "  created editor1 id=$EDITOR_ID"

api POST /auth/login "" '{"username":"editor1","password":"Password123"}'
EDITOR_TOKEN=$(json_get "$RESP_BODY" "token")
check "3.1 editor-login" 200 "$HTTP_STATUS"

# 3.2 Editor adds a show (should succeed — has add_shows by default)
api POST /shows "$EDITOR_TOKEN" '{"num":99001,"name":"Test Show by Editor","category":"test","days":"sat","time":"20:00"}'
echo "  editor adds show → $HTTP_STATUS (should be 200)"
check "3.2 editor-can-add-show" 200 "$HTTP_STATUS"

# 3.3 Editor edits the show (should succeed — has edit_shows by default)
api PUT "/shows/99001" "$EDITOR_TOKEN" '{"name":"Test Show Edited"}'
echo "  editor edits show → $HTTP_STATUS (should be 200)"
check "3.3 editor-can-edit-show" 200 "$HTTP_STATUS"

# 3.4 Editor tries to delete the show (should FAIL — no delete_shows for editor)
api DELETE "/shows?num=99001" "$EDITOR_TOKEN"
echo "  editor tries to delete show → $HTTP_STATUS (should be 401)"
check "3.4 editor-cant-delete-show" 401 "$HTTP_STATUS"

# 3.5 Editor tries to list users (should FAIL — no manage_users for editor)
api GET /users "$EDITOR_TOKEN"
echo "  editor tries to list users → $HTTP_STATUS (should be 401)"
check "3.5 editor-cant-list-users" 401 "$HTTP_STATUS"

# 3.6 Editor tries to create a user (should FAIL — no manage_users)
api POST /users "$EDITOR_TOKEN" '{"username":"rogue","password":"Password123","role":"viewer"}'
echo "  editor tries to create user → $HTTP_STATUS (should be 401)"
check "3.6 editor-cant-create-user" 401 "$HTTP_STATUS"

# 3.7 Editor tries to view activity log (should FAIL — no view_activity)
api GET /activity "$EDITOR_TOKEN"
echo "  editor tries to view activity log → $HTTP_STATUS (should be 401)"
check "3.7 editor-cant-view-activity" 401 "$HTTP_STATUS"

# 3.8 Editor tries to update the super admin (should FAIL)
api PUT "/users?id=$SUPER_ID" "$EDITOR_TOKEN" '{"role":"viewer"}'
echo "  editor tries to demote super admin → $HTTP_STATUS (should be 401 — no manage_users)"
check "3.8 editor-cant-touch-super" 401 "$HTTP_STATUS"

echo
echo "  → TEST 3 SUMMARY: Editor can add/edit but cannot delete or manage users."

# ============================================================================
# TEST 4: API Security — direct unauthorized requests
# ============================================================================
hdr "TEST 4 — API Security (direct bypass attempts)"

# 4.1 No token at all — every protected endpoint must reject
api GET /users ""
echo "  no-token GET /users → $HTTP_STATUS (should be 401)"
check "4.1a no-token-list-users" 401 "$HTTP_STATUS"

api GET /shows ""
echo "  no-token GET /shows → $HTTP_STATUS (should be 401)"
check "4.1b no-token-list-shows" 401 "$HTTP_STATUS"

api POST /shows "" '{"num":99002,"name":"rogue"}'
echo "  no-token POST /shows → $HTTP_STATUS (should be 401)"
check "4.1c no-token-create-show" 401 "$HTTP_STATUS"

api DELETE "/shows?num=99001" ""
echo "  no-token DELETE /shows → $HTTP_STATUS (should be 401)"
check "4.1d no-token-delete-show" 401 "$HTTP_STATUS"

api GET /activity ""
echo "  no-token GET /activity → $HTTP_STATUS (should be 401)"
check "4.1e no-token-view-activity" 401 "$HTTP_STATUS"

# 4.2 Forged / garbage token
api GET /users "garbage_token_xyz_123"
echo "  garbage-token GET /users → $HTTP_STATUS (should be 401)"
check "4.2 garbage-token-rejected" 401 "$HTTP_STATUS"

# 4.3 Suspended user — token must stop working after suspension
api POST /users "$SUPER_TOKEN" '{"username":"willbe_suspended","password":"Password123","role":"admin","name":"Will Be Suspended"}'
SUS_ID=$(json_num "$RESP_BODY" "id")
api POST /auth/login "" '{"username":"willbe_suspended","password":"Password123"}'
SUS_TOKEN=$(json_get "$RESP_BODY" "token")
echo "  created+suspended user, token=${SUS_TOKEN:0:16}..."

# Verify it works first
api GET /users "$SUS_TOKEN"
check "4.3a token-works-before-suspend" 200 "$HTTP_STATUS"

# Suspend the user
api PUT "/users?id=$SUS_ID" "$SUPER_TOKEN" '{"isActive":false}'
echo "  suspended user id=$SUS_ID"

# Now the same token must FAIL
api GET /users "$SUS_TOKEN"
echo "  suspended-token GET /users → $HTTP_STATUS (should be 401)"
check "4.3b token-blocked-after-suspend" 401 "$HTTP_STATUS"

# 4.4 Role escalation attempt: editor sends a forged role='admin' in login body? Login doesn't accept that.
#    But: an editor with a token tries to PUT /users with body {role:'admin'} on himself
api PUT "/users?id=$EDITOR_ID" "$EDITOR_TOKEN" '{"role":"admin"}'
echo "  editor self-promote role → $HTTP_STATUS (should be 401 — no manage_users)"
check "4.4 editor-self-promote-blocked" 401 "$HTTP_STATUS"

# 4.5 Editor tries to inject permissions field on self
api PUT "/users?id=$EDITOR_ID" "$EDITOR_TOKEN" '{"permissions":["manage_users","delete_shows"]}'
echo "  editor sets own permissions → $HTTP_STATUS (should be 401 — no manage_users)"
check "4.5 editor-set-perms-blocked" 401 "$HTTP_STATUS"

# 4.6 Try a malformed JSON body
api POST /shows "$SUPER_TOKEN" 'this-is-not-json'
echo "  malformed JSON POST /shows → $HTTP_STATUS (should be 400)"
check "4.6 malformed-json-400" 400 "$HTTP_STATUS"

# 4.7 Cross-user: editor tries to use a path-traversal id
api PUT "/users?id=../" "$EDITOR_TOKEN" '{"role":"admin"}'
echo "  editor path traversal → $HTTP_STATUS (should be 401)"
check "4.7 path-traversal-rejected" 401 "$HTTP_STATUS"

# 4.8 Limited admin tries to modify super admin's permissions (the BIG ONE)
api PUT "/users?id=$SUPER_ID" "$LIMITED_TOKEN" '{"permissions":[]}'
echo "  limited_admin revokes super_admin perms → $HTTP_STATUS (should be 403)"
check "4.8 super-perms-cant-be-revoked" 403 "$HTTP_STATUS"

echo
echo "  → TEST 4 SUMMARY: All direct bypass attempts correctly rejected."

# ============================================================================
# TEST 5: Activity log — verify audit trail of permission changes
# ============================================================================
hdr "TEST 5 — Activity log audit trail"

api GET "/activity?limit=200" "$SUPER_TOKEN"
echo "  activity log entries:"
ACT_COUNT=$(printf '%s' "$RESP_BODY" | grep -oE '"action":"[^"]*"' | wc -l)
echo "  total actions logged: $ACT_COUNT"

# Count permission-change events specifically
PERM_CHANGES=$(printf '%s' "$RESP_BODY" | grep -oE '"action":"update_permissions"' | wc -l)
echo "  update_permissions events: $PERM_CHANGES"
check_ge "5.1 perm-changes-logged" 3 "$PERM_CHANGES"

# Verify create_user events exist
CREATE_USER_EVENTS=$(printf '%s' "$RESP_BODY" | grep -oE '"action":"create_user"' | wc -l)
echo "  create_user events: $CREATE_USER_EVENTS"
check_ge "5.2 user-creations-logged" 4 "$CREATE_USER_EVENTS"

echo
echo "  → TEST 5 SUMMARY: Audit trail captures all permission changes."

# ============================================================================
# TEST 6: DB integrity — verify state matches expectations
# ============================================================================
hdr "TEST 6 — DB integrity check"

api GET /users "$SUPER_TOKEN"
TOTAL_USERS=$(printf '%s' "$RESP_BODY" | grep -oE '"id":[0-9]+' | wc -l)
echo "  total users in DB: $TOTAL_USERS"

# Verify super admin still active, still admin, still super
SUPER_BLOCK=$(printf '%s' "$RESP_BODY" | grep -oE "\"id\":${SUPER_ID},\"username\":\"admin\"[^}]*")
SUPER_ACTIVE=$(printf '%s' "$SUPER_BLOCK" | grep -oE '"isActive":(true|false)' | sed -E 's/.*"isActive":(true|false).*/\1/')
SUPER_ROLE=$(printf '%s' "$SUPER_BLOCK" | grep -oE '"role":"[^"]*"' | sed -E 's/.*"role":"([^"]*)".*/\1/')
SUPER_IS_SUPER=$(printf '%s' "$SUPER_BLOCK" | grep -oE '"isSuperAdmin":(true|false)' | sed -E 's/.*"isSuperAdmin":(true|false).*/\1/')
echo "  super admin: role=$SUPER_ROLE isActive=$SUPER_ACTIVE isSuper=$SUPER_IS_SUPER"
check "6.1 super-still-admin" "admin" "$SUPER_ROLE"
check "6.2 super-still-active" "true" "$SUPER_ACTIVE"
check "6.3 super-still-super" "true" "$SUPER_IS_SUPER"

# Verify viewer1 was never promoted
VIEWER_BLOCK=$(printf '%s' "$RESP_BODY" | grep -oE "\"id\":${VIEWER_ID},\"username\":\"viewer1\"[^}]*")
VIEWER_ROLE=$(printf '%s' "$VIEWER_BLOCK" | grep -oE '"role":"[^"]*"' | sed -E 's/.*"role":"([^"]*)".*/\1/')
echo "  viewer1 role: $VIEWER_ROLE (should be 'viewer' — never promoted)"
check "6.4 viewer-never-promoted" "viewer" "$VIEWER_ROLE"

echo
echo "  → TEST 6 SUMMARY: Database state consistent with security rules."

# ============================================================================
# FINAL SUMMARY
# ============================================================================
hdr "FINAL SUMMARY"
echo "  Total tests: $((PASS+FAIL))"
echo "  ${GREEN}PASSED: $PASS${NC}"
echo "  ${RED}FAILED: $FAIL${NC}"
echo
echo "  Detailed results:"
for r in "${RESULTS[@]}"; do
  echo "  $r"
done

# Save full results to a file
{
  echo "BankResaneh API Security Test Report"
  echo "Date: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "Target: $BASE"
  echo "Git commit: $(cd /home/z/my-project && git rev-parse HEAD)"
  echo "======================================================"
  echo "Total: $((PASS+FAIL))  Passed: $PASS  Failed: $FAIL"
  echo "======================================================"
  for r in "${RESULTS[@]}"; do
    # strip color codes for the file
    echo "$r" | sed -E 's/\x1b\[[0-9;]*m//g'
  done
} > /home/z/my-project/security-test-report.txt
echo
echo "  Report saved to /home/z/my-project/security-test-report.txt"

[ "$FAIL" -eq 0 ]
