#!/usr/bin/env bash
# =============================================================================
# BankResaneh — Phase 3 audit tests (per user's pre-release checklist)
#   A. scrypt params (N=2^17) + async migration tests
#   B. Login rate-limit: concurrency + restart behavior
#   C. Translate rate-limit: concurrency + Next.js restart + write failure
#   D. Data-dir persistence: simulated reinstall on isolated port 3003
# No UI changes. Restores admin/admin + resets test state at the end.
# =============================================================================
set -u
API_DIR="/home/z/my-project/mini-services/api-service"
ROOT="/home/z/my-project"
API="http://127.0.0.1:3002"
NEXT="http://127.0.0.1:3000"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  [PASS] $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  [FAIL] $1"; }
chk()  { # chk <desc> <actual> <expected>
  if [ "$2" = "$3" ]; then ok "$1 ($2)"; else bad "$1 (got $2, want $3)"; fi
}

# ---------- helpers ----------
wait_up() { # wait_up <url> <tries>
  for _ in $(seq 1 "$2"); do
    curl -sf --max-time 2 "$1" > /dev/null 2>&1 && return 0
    sleep 1
  done
  return 1
}
start_api() { # start_api <logfile> [extra env...]
  local logf="$1"; shift
  ( setsid nohup bun --hot index.js > "$logf" 2>&1 < /dev/null & ) \
    || true
  wait_up "$API/api/health" 20
}
# NOTE: start_api must be called with cwd = $API_DIR

echo "== A. scrypt: OWASP params + async =="
cd "$API_DIR" || exit 1
curl -sf --max-time 2 "$API/api/health" > /dev/null 2>&1 || start_api /tmp/api-cron.log
curl -sf --max-time 3 "$API/api/health" > /dev/null 2>&1 && ok "API service up" || { bad "API service up"; exit 1; }

HASH0=$(bun /tmp/readhash.js 2>/dev/null | sed 's/.*hash: //')
echo "  initial admin hash: ${HASH0:0:40}..."

# A2 login admin/admin (fresh XFF so the limiter budget stays clean)
T0=$(date +%s%3N)
R=$(curl -s -o /tmp/a2.json -w "%{http_code}" -X POST "$API/api/auth/login" \
  -H 'Content-Type: application/json' -H 'X-Forwarded-For: 10.1.1.1' \
  -d '{"username":"admin","password":"admin"}')
T1=$(date +%s%3N)
chk "A2 login admin/admin" "$R" "200"
echo "  login latency (legacy verify): $((T1-T0)) ms"
TOKEN=$(bun -e 'const j=await Bun.file("/tmp/a2.json").json(); console.log(j.token||"")' 2>/dev/null)

# A3 wrong password
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/api/auth/login" \
  -H 'Content-Type: application/json' -H 'X-Forwarded-For: 10.1.1.1' \
  -d '{"username":"admin","password":"WRONG-pw"}')
chk "A3 wrong password -> 401" "$R" "401"

# A4 change password -> hash must become scrypt$131072 (N=2^17)
T0=$(date +%s%3N)
R=$(curl -s -o /tmp/a4.json -w "%{http_code}" -X PUT "$API/api/auth/change-password" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -H 'X-Forwarded-For: 10.1.1.2' \
  -d '{"oldPassword":"admin","newPassword":"AdminTest#2026"}')
T1=$(date +%s%3N)
chk "A4 change-password" "$R" "200"
echo "  change-password latency (legacy verify + N=2^17 hash): $((T1-T0)) ms"
HASH1=$(bun /tmp/readhash.js 2>/dev/null | sed 's/.*hash: //')
echo "  after change: ${HASH1:0:44}..."
case "$HASH1" in
  scrypt\$131072\$8\$1\$*) ok "A4 hash upgraded to N=2^17 (131072)";;
  *) bad "A4 hash upgraded to N=2^17 — got ${HASH1:0:30}";;
esac
NEW_TOKEN=$(bun -e 'const j=await Bun.file("/tmp/a4.json").json(); console.log(j.token||"")' 2>/dev/null)

# A5 login verifies against the N=2^17 hash
T0=$(date +%s%3N)
R=$(curl -s -o /tmp/a5.json -w "%{http_code}" -X POST "$API/api/auth/login" \
  -H 'Content-Type: application/json' -H 'X-Forwarded-For: 10.1.1.3' \
  -d '{"username":"admin","password":"AdminTest#2026"}')
T1=$(date +%s%3N)
chk "A5 login with N=2^17 hash" "$R" "200"
echo "  N=2^17 verify latency: $((T1-T0)) ms"

# A6 session revocation on password change (old token must be dead)
R=$(curl -s -o /dev/null -w "%{http_code}" "$API/api/auth/me" \
  -H "Authorization: Bearer $TOKEN")
chk "A6 old token revoked after change-password" "$R" "401"

# A7 event-loop responsiveness under concurrent scrypt verifications:
# 4 concurrent bad-password logins (each ~250ms scrypt) while polling /api/health.
MAXLAT=0
for _ in 1 2 3 4; do
  curl -s -o /dev/null -X POST "$API/api/auth/login" \
    -H 'Content-Type: application/json' -H 'X-Forwarded-For: 10.1.1.7' \
    -d '{"username":"admin","password":"WRONG-pw"}' &
done
for _ in $(seq 1 25); do
  L=$(curl -s -o /dev/null -w "%{time_total}" --max-time 2 "$API/api/health" 2>/dev/null)
  L=${L:-9}
  awk -v a="$L" -v b="$MAXLAT" 'BEGIN{exit (a>b)?0:1}' && MAXLAT=$L
  sleep 0.03
done
wait
echo "  max /api/health latency during 4 concurrent scrypt verifications: ${MAXLAT}s"
awk -v m="$MAXLAT" 'BEGIN{exit (m<0.15)?0:1}' \
  && ok "A7 event loop stays responsive (<150ms)" \
  || bad "A7 event loop blocked (${MAXLAT}s) — async fix ineffective"

# A8 restore admin/admin and revalidate the legacy->scrypt upgrade path
bun -e '
const { Database } = require("bun:sqlite");
const { createHash } = require("node:crypto");
const db = new Database("/home/z/my-project/mini-services/api-service/bankresaneh.sqlite");
db.prepare("UPDATE users SET password_hash=?, must_change_password=0 WHERE username=?")
  .run(createHash("sha256").update("admin").digest("hex"), "admin");
console.log("admin hash restored to legacy sha256");'
R=$(curl -s -o /tmp/a8.json -w "%{http_code}" -X POST "$API/api/auth/login" \
  -H 'Content-Type: application/json' -H 'X-Forwarded-For: 10.1.1.9' \
  -d '{"username":"admin","password":"admin"}')
chk "A8 login admin/admin after restore" "$R" "200"
HASH2=$(bun /tmp/readhash.js 2>/dev/null | sed 's/.*hash: //')
case "$HASH2" in
  scrypt\$131072\$8\$1\$*) ok "A8 transparent upgrade legacy -> N=2^17";;
  *) bad "A8 transparent upgrade — got ${HASH2:0:30}";;
esac
TOKEN=$(bun -e 'const j=await Bun.file("/tmp/a8.json").json(); console.log(j.token||"")' 2>/dev/null)
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/api/auth/login" \
  -H 'Content-Type: application/json' -H 'X-Forwarded-For: 10.1.1.10' \
  -d '{"username":"admin","password":"admin"}')
chk "A8 second login admin/admin" "$R" "200"

echo "== B. login rate limit: concurrency + restart =="
# 5 bad attempts from a fresh IP -> block; 6th -> 429
CODES=""
for _ in 1 2 3 4 5 6; do
  C=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/api/auth/login" \
    -H 'Content-Type: application/json' -H 'X-Forwarded-For: 20.1.1.1' \
    -d '{"username":"admin","password":"WRONG-pw"}')
  CODES="$CODES $C"
done
echo "  sequence for 6 bad attempts from one IP:$CODES"
LAST=$(echo "$CODES" | awk '{print $NF}')
chk "B 6th attempt rate-limited (429)" "$LAST" "429"
# verify the retryAfter payload is present too
B429=$(curl -s -X POST "$API/api/auth/login" \
  -H 'Content-Type: application/json' -H 'X-Forwarded-For: 20.1.1.1' \
  -d '{"username":"admin","password":"WRONG-pw"}')
echo "$B429" | grep -q 'ثانیه صبر کنید' && ok "B 429 carries Persian retry message" || bad "B 429 message missing"

# restart clears the limiter (documented finding — expected DOWN/ALIVE only)
pkill -f "bun --hot index.js" 2>/dev/null; sleep 2
start_api /tmp/api-cron.log || true
curl -sf --max-time 3 "$API/api/health" > /dev/null 2>&1 && ok "API restarted" || bad "API restarted"
C=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/api/auth/login" \
  -H 'Content-Type: application/json' -H 'X-Forwarded-For: 20.1.1.1' \
  -d '{"username":"admin","password":"WRONG-pw"}')
if [ "$C" = "401" ]; then
  ok "B restart clears limiter -> FINDING: login limiter is in-memory only (401 after restart = fresh budget)"
else
  bad "B restart behavior unexpected ($C)"
fi

echo "== C. translate rate limit (Next.js, persistent) =="
curl -sf --max-time 3 "$NEXT" > /dev/null 2>&1 && ok "Next.js up" || bad "Next.js up"
# C1: 12 oversized-but-valid-JSON requests (413 AFTER the limiter gate, no LLM cost)
BIG=$(python3 -c "print('{\"fields\": {\"summary\": \"' + 'x'*102400 + '\"}}')")
C1_CODES=""
for _ in $(seq 1 12); do
  C=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$NEXT/api/translate" \
    -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
    -d "$BIG")
  C1_CODES="$C1_CODES $C"
done
echo "  12 sequential oversized requests:$C1_CODES"
N413=$(echo "$C1_CODES" | tr ' ' '\n' | grep -c 413 || true)
N429=$(echo "$C1_CODES" | tr ' ' '\n' | grep -c 429 || true)
if [ "$N413" -ge 9 ] && [ "$N429" -ge 1 ]; then
  ok "C1 limiter allowed first burst (413 x$N413) then 429 x$N429"
else
  bad "C1 unexpected distribution (413 x$N413, 429 x$N429)"
fi
RL_FILE="$ROOT/data/translate-rate-limit.json"
if [ -f "$RL_FILE" ]; then ok "C1 rate-limit file persisted at data/translate-rate-limit.json"; else bad "C1 rate-limit file missing"; fi

# C2: restart Next.js — the counter must survive
pkill -f "next-server" 2>/dev/null; pkill -f "bun run start" 2>/dev/null; sleep 2
cd "$ROOT" || exit 1
( setsid nohup bun run start > /tmp/next-cron.log 2>&1 < /dev/null & )
wait_up "$NEXT" 30 && ok "C2 Next.js restarted" || bad "C2 Next.js restarted"
C=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$NEXT/api/translate" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" -d "$BIG")
if [ "$C" = "429" ]; then
  ok "C2 counter SURVIVED Next.js restart (429 persists)"
elif [ "$C" = "413" ]; then
  bad "C2 counter lost on restart (413 = fresh budget)"
else
  bad "C2 unexpected code $C"
fi
rm -f "$RL_FILE"; echo "  rate-limit file reset for future use"

# C3: write failure — make the file a DIRECTORY (read+write both fail) -> graceful
mkdir -p "$RL_FILE"
C=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$NEXT/api/translate" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" -d "$BIG")
if [ "$C" = "413" ]; then
  ok "C3 write failure degrades gracefully (fail-open, no 500)"
else
  bad "C3 write failure handling unexpected ($C)"
fi
rmdir "$RL_FILE" 2>/dev/null

# C4: byte-based cap (Persian 2-byte chars): 60KB of Persian chars = 120KB bytes
BIGFA=$(python3 -c "print('{\"fields\": {\"summary\": \"' + 'ت'*60000 + '\"}}')")
C=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$NEXT/api/translate" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" -d "$BIGFA")
chk "C4 120KB Persian payload rejected (413, byte-accurate)" "$C" "413"

echo "== D. data-dir persistence (simulated reinstall, isolated port 3003) =="
TD="/tmp/br-reinstall-test"; rm -rf "$TD"; mkdir -p "$TD/db" "$TD/data"
API3="http://127.0.0.1:3003"
cd "$API_DIR" || exit 1
( setsid nohup env PORT=3003 BANKRESANEH_HOST=127.0.0.1 \
    DB_PATH="$TD/db/bankresaneh.sqlite" \
    BANKRESANEH_DATA_DIR="$TD/data" \
    bun --hot index.js > /tmp/api-3003.log 2>&1 < /dev/null & )
wait_up "$API3/api/health" 20 && ok "D1 fresh install instance up (3003)" || { bad "D1 fresh instance"; exit 1; }
R=$(curl -s -o /tmp/d1.json -w "%{http_code}" -X POST "$API3/api/auth/login" \
  -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin"}')
chk "D2 default admin login on fresh DB" "$R" "200"
DT=$(bun -e 'const j=await Bun.file("/tmp/d1.json").json(); console.log(j.token||"")' 2>/dev/null)
R=$(curl -s -o /tmp/d2.json -w "%{http_code}" -X PUT "$API3/api/auth/change-password" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $DT" \
  -d '{"oldPassword":"admin","newPassword":"Reinstall#2026"}')
chk "D3 change password (persists to userData DB)" "$R" "200"
# change-password revokes ALL sessions and issues a NEW token — use it
DT=$(bun -e 'const j=await Bun.file("/tmp/d2.json").json(); console.log(j.token||"")' 2>/dev/null)
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API3/api/users" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $DT" \
  -d '{"username":"editor1","password":"Editor#2026","role":"editor","name":"تست"}')
chk "D3 create user editor1" "$R" "200"
# write a settings file the way Next.js getDataFile would
printf '{"theme":"x"}' > "$TD/data/report-settings.json"
# ---- reinstall: kill, wipe NOTHING, restart with same data dir ----
pkill -f "PORT=3003" 2>/dev/null
P=$(pgrep -f "bun --hot index.js" | while read pid; do tr '\0' '\n' < /proc/$pid/environ 2>/dev/null | grep -q "PORT=3003" && echo "$pid"; done)
[ -n "$P" ] && kill $P
sleep 2
( setsid nohup env PORT=3003 BANKRESANEH_HOST=127.0.0.1 \
    DB_PATH="$TD/db/bankresaneh.sqlite" \
    BANKRESANEH_DATA_DIR="$TD/data" \
    bun --hot index.js > /tmp/api-3003b.log 2>&1 < /dev/null & )
wait_up "$API3/api/health" 20 && ok "D4 simulated reinstall: instance restarted" || bad "D4 restart"
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API3/api/auth/login" \
  -H 'Content-Type: application/json' -d '{"username":"editor1","password":"Editor#2026"}')
chk "D5 user editor1 survived reinstall" "$R" "200"
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API3/api/auth/login" \
  -H 'Content-Type: application/json' -d '{"username":"admin","password":"Reinstall#2026"}')
chk "D5 changed admin password survived reinstall" "$R" "200"
SC=$(curl -s "$API3/api/health" | python3 -c "import sys,json;print(json.load(sys.stdin).get('showsCount',0))" 2>/dev/null)
if [ "${SC:-0}" -gt 0 ]; then ok "D5 shows data survived reinstall ($SC shows)"; else bad "D5 shows data missing"; fi
[ -f "$TD/data/report-settings.json" ] && ok "D5 settings file survived reinstall" || bad "D5 settings file lost"
# cleanup
P=$(pgrep -f "bun --hot index.js" | while read pid; do tr '\0' '\n' < /proc/$pid/environ 2>/dev/null | grep -q "PORT=3003" && echo "$pid"; done)
[ -n "$P" ] && kill $P
rm -rf "$TD"

echo "==============================="
echo "RESULT: PASS=$PASS FAIL=$FAIL"
