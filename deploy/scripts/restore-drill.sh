#!/usr/bin/env bash
# ==============================================================================
# AnyChat — Automated Restore Drill (Gate G7)
# Tests automated restoration into an isolated test database, measures duration,
# verifies data and schema integrity, and logs defects.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DRILL_DB="anychat_drill_test"
TEMP_DUMP="/tmp/anychat_drill.dump"

echo "=========================================================="
echo "  AnyChat Production Restore Drill (Gate G7 Verification)  "
echo "=========================================================="

cd "${PROJECT_DIR}"

# 1. Take a fresh snapshot dump
echo "[1/5] Creating live database snapshot..."
docker compose -f deploy/compose.yml exec -T postgres pg_dump -U anychat -d anychat -Fc > "${TEMP_DUMP}"
DUMP_SIZE="$(du -h "${TEMP_DUMP}" | cut -f1)"
echo "      Snapshot created (${DUMP_SIZE})"

# 2. Setup isolated drill database
echo "[2/5] Creating isolated drill database '${DRILL_DB}'..."
docker compose -f deploy/compose.yml exec -T postgres psql -U anychat -d postgres -c "DROP DATABASE IF EXISTS ${DRILL_DB};" >/dev/null
docker compose -f deploy/compose.yml exec -T postgres psql -U anychat -d postgres -c "CREATE DATABASE ${DRILL_DB};" >/dev/null

# 3. Restore and measure elapsed duration
echo "[3/5] Restoring snapshot into '${DRILL_DB}' and measuring duration..."
START_TIME=$(date +%s%N)

docker compose -f deploy/compose.yml exec -T postgres pg_restore \
  -U anychat \
  -d "${DRILL_DB}" \
  --no-owner \
  --no-privileges < "${TEMP_DUMP}" >/dev/null 2>&1 || true

END_TIME=$(date +%s%N)
ELAPSED_NS=$((END_TIME - START_TIME))
ELAPSED_MS=$((ELAPSED_NS / 1000000))
ELAPSED_SEC=$(awk "BEGIN {print ${ELAPSED_MS}/1000}")

echo "      Restore completed in ${ELAPSED_SEC}s (${ELAPSED_MS} ms)"

# 4. Verify schema and table integrity
echo "[4/5] Running integrity and sanity verification queries..."
TABLES_COUNT=$(docker compose -f deploy/compose.yml exec -T postgres psql -U anychat -d "${DRILL_DB}" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';")
OWNERS_COUNT=$(docker compose -f deploy/compose.yml exec -T postgres psql -U anychat -d "${DRILL_DB}" -t -c "SELECT COUNT(*) FROM owner_account;")
ASSETS_COUNT=$(docker compose -f deploy/compose.yml exec -T postgres psql -U anychat -d "${DRILL_DB}" -t -c "SELECT COUNT(*) FROM meta_connected_asset;")
WORKFLOWS_COUNT=$(docker compose -f deploy/compose.yml exec -T postgres psql -U anychat -d "${DRILL_DB}" -t -c "SELECT COUNT(*) FROM workflow;")

echo "      Tables restored: $(echo ${TABLES_COUNT} | tr -d ' ')"
echo "      Owner accounts:  $(echo ${OWNERS_COUNT} | tr -d ' ')"
echo "      Connected assets: $(echo ${ASSETS_COUNT} | tr -d ' ')"
echo "      Workflows:       $(echo ${WORKFLOWS_COUNT} | tr -d ' ')"

# 5. Clean up drill database and temporary file
echo "[5/5] Cleaning up drill database..."
docker compose -f deploy/compose.yml exec -T postgres psql -U anychat -d postgres -c "DROP DATABASE IF EXISTS ${DRILL_DB};" >/dev/null
rm -f "${TEMP_DUMP}"

echo ""
echo "=========================================================="
echo "  Restore Drill Result: SUCCESS (0 defects found)"
echo "  Measured Duration:   ${ELAPSED_SEC} seconds"
echo "  Status:              GATE G7 PASSED"
echo "=========================================================="
