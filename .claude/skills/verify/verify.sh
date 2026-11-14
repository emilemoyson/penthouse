#!/usr/bin/env bash
# Full check for the penthouse repo: tsc, build, MCP tests, then a live smoke test on a throwaway hub_test copy.
# Usage: .claude/skills/verify/verify.sh [--quick]   (--quick skips the build and the HTTP smoke test)
# Never prints secrets. Never touches the real hub database except as the template for the copy.
set -uo pipefail
cd "$(dirname "$0")/../../.."

QUICK=0; [[ "${1:-}" == "--quick" ]] && QUICK=1
PORT=3001
TEST_URL="postgres://localhost:5433/hub_test"
FAIL=0
step() { printf '\n== %s\n' "$1"; }
ok()   { printf 'PASS  %s\n' "$1"; }
bad()  { printf 'FAIL  %s\n' "$1"; FAIL=1; }

step "1/4 TypeScript"
if npx tsc --noEmit >/tmp/verify-tsc.log 2>&1; then ok "tsc"; else bad "tsc (see below)"; tail -30 /tmp/verify-tsc.log; fi

if [[ $QUICK -eq 0 ]]; then
  step "2/4 Build"
  if npm run build >/tmp/verify-build.log 2>&1; then ok "next build"; else bad "next build (see below)"; tail -40 /tmp/verify-build.log; fi
else
  step "2/4 Build (skipped, --quick)"
fi

# hub_test is shared by the MCP tests and the smoke test: create a fresh copy, clean up on exit.
# If a hub_test existed before (mcp/.env may point at it), leave a fresh copy behind instead of none.
HAD_TEST=0
psql -p 5433 -lqt 2>/dev/null | cut -d'|' -f1 | grep -qw hub_test && HAD_TEST=1
DEV_PID=""
cleanup() {
  [[ -n "$DEV_PID" ]] && kill "$DEV_PID" 2>/dev/null && wait "$DEV_PID" 2>/dev/null
  dropdb -p 5433 --if-exists hub_test 2>/dev/null
  if [[ $HAD_TEST -eq 1 ]]; then
    createdb -p 5433 -T hub hub_test 2>/dev/null && psql "$TEST_URL" -q -f mcp/sql/readonly_role.sql >/dev/null 2>&1 \
      && echo "(hub_test existed before, so a fresh copy was left in place)"
  fi
}
trap cleanup EXIT
dropdb -p 5433 --if-exists hub_test 2>/dev/null
DB_OK=1
if ! createdb -p 5433 -T hub hub_test 2>/tmp/verify-db.log; then
  DB_OK=0; bad "createdb hub_test (another connection to hub open? e.g. the dev server)"; cat /tmp/verify-db.log
elif ! psql "$TEST_URL" -q -f mcp/sql/readonly_role.sql >/tmp/verify-role.log 2>&1; then
  bad "read-only role on hub_test"; tail -5 /tmp/verify-role.log
fi

step "3/4 MCP tests"
if [[ $DB_OK -eq 0 ]]; then
  bad "pytest mcp skipped, no hub_test"
elif [[ ! -x mcp/.venv/bin/pytest ]]; then
  bad "mcp/.venv/bin/pytest missing (see mcp/README.md)"
elif mcp/.venv/bin/pytest mcp -q >/tmp/verify-pytest.log 2>&1; then
  ok "pytest mcp ($(tail -1 /tmp/verify-pytest.log))"
else
  bad "pytest mcp (see below)"; grep -E "^(FAILED|ERROR)" /tmp/verify-pytest.log | head -10; tail -1 /tmp/verify-pytest.log
fi

if [[ $QUICK -eq 1 ]]; then
  step "4/4 hub_test smoke (skipped, --quick)"
elif [[ $DB_OK -eq 1 ]]; then
  step "4/4 Smoke test on hub_test"
  DATABASE_URL="$TEST_URL" npx next dev -p $PORT >/tmp/verify-dev.log 2>&1 &
  DEV_PID=$!
  for _ in $(seq 1 60); do curl -s -o /dev/null "http://localhost:$PORT/login" && break; sleep 1; done
  # Read the token into a variable without ever printing it.
  TOKEN="$(grep -m1 '^INGEST_TOKEN=' .env.local 2>/dev/null | cut -d= -f2- | tr -d "\"'")"
  URL="http://localhost:$PORT/api/ingest/sleep"
  BODY='{"date":"1999-01-01","totalMin":420,"source":"verify"}'

  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$URL" -H 'Content-Type: application/json' -d "$BODY")
  [[ "$code" == "401" ]] && ok "ingest without token is refused (401)" || bad "ingest without token returned $code, expected 401"

  if [[ -z "$TOKEN" ]]; then
    bad "INGEST_TOKEN not found in .env.local, skipped the authorised checks"
  else
    code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$URL" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"date":"nope"}')
    [[ "$code" == "422" ]] && ok "invalid body is rejected (422)" || bad "invalid body returned $code, expected 422"
    for i in 1 2; do
      code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$URL" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "$BODY")
      [[ "$code" == "200" ]] || bad "valid ingest #$i returned $code, expected 200"
    done
    n=$(psql "$TEST_URL" -tAc "select count(*) from sleep_logs where date='1999-01-01' and source='verify'")
    [[ "$n" == "1" ]] && ok "valid ingest lands in hub_test, re-send is idempotent" || bad "expected 1 row in hub_test, found '$n'"
  fi
  real=$(psql postgres://localhost:5433/hub -tAc "select count(*) from sleep_logs where source='verify'")
  [[ "$real" == "0" ]] && ok "real hub database untouched" || bad "found $real verify rows in the REAL hub database"
fi

printf '\n'
if [[ $FAIL -eq 0 ]]; then echo "VERIFY: ALL PASS"; else echo "VERIFY: FAILED"; fi
exit $FAIL
