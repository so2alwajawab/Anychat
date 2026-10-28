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
RESTORE_LOG="${TEMP_DUMP}.log"

# pg_restore must be able to fail the drill: `|| true` would print SUCCESS unconditionally.
set +e
docker compose -f deploy/compose.yml exec -T postgres pg_restore \
  -U anychat \
  -d "${DRILL_DB}" \
  --no-owner \
  --no-privileges < "${TEMP_DUMP}" > "${RESTORE_LOG}" 2>&1
RESTORE_EXIT=$?
set -e

END_TIME=$(date +%s%N)
ELAPSED_NS=$((END_TIME - START_TIME))
ELAPSED_MS=$((ELAPSED_NS / 1000000))
ELAPSED_SEC=$(awk "BEGIN {print ${ELAPSED_MS}/1000}")

DEFECTS=0
if [ "${RESTORE_EXIT}" -ne 0 ]; then
  echo "      DEFECT: pg_restore exited with code ${RESTORE_EXIT}"
  sed 's/^/        /' "${RESTORE_LOG}" | tail -n 20
  DEFECTS=$((DEFECTS + 1))
fi
echo "      Restore completed in ${ELAPSED_SEC}s (${ELAPSED_MS} ms)"

# 4. Verify integrity: row counts in the drill database must match the source.
# Note: counts are read live after the dump, so a concurrent write could show up
# as a mismatch — a false defect is preferable to a false SUCCESS.
echo "[4/5] Running integrity and sanity verification queries..."
count_rows() {
  docker compose -f deploy/compose.yml exec -T postgres psql -U anychat -d "$1" -t -A \
    -c "SELECT COUNT(*) FROM $2;" | tr -d '[:space:]'
}

expect_equal() {
  if [ "$2" != "$3" ]; then
    echo "      DEFECT: $1 mismatch — source=$2 drill=$3"
    DEFECTS=$((DEFECTS + 1))
  fi
}

TABLES_SRC=$(docker compose -f deploy/compose.yml exec -T postgres psql -U anychat -d anychat -t -A -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" | tr -d '[:space:]')
TABLES_DRILL=$(docker compose -f deploy/compose.yml exec -T postgres psql -U anychat -d "${DRILL_DB}" -t -A -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" | tr -d '[:space:]')
OWNERS_SRC=$(count_rows anychat owner_account)
OWNERS_DRILL=$(count_rows "${DRILL_DB}" owner_account)
ASSETS_SRC=$(count_rows anychat meta_connected_asset)
ASSETS_DRILL=$(count_rows "${DRILL_DB}" meta_connected_asset)
WORKFLOWS_SRC=$(count_rows anychat workflow)
WORKFLOWS_DRILL=$(count_rows "${DRILL_DB}" workflow)

if [ "${TABLES_DRILL}" -lt 1 ] || [ "${TABLES_DRILL}" != "${TABLES_SRC}" ]; then
  echo "      DEFECT: table count mismatch — source=${TABLES_SRC} drill=${TABLES_DRILL}"
  DEFECTS=$((DEFECTS + 1))
fi
expect_equal "owner_account rows" "${OWNERS_SRC}" "${OWNERS_DRILL}"
expect_equal "meta_connected_asset rows" "${ASSETS_SRC}" "${ASSETS_DRILL}"
expect_equal "workflow rows" "${WORKFLOWS_SRC}" "${WORKFLOWS_DRILL}"

echo "      Tables restored:  ${TABLES_DRILL} (source: ${TABLES_SRC})"
echo "      Owner accounts:   ${OWNERS_DRILL} (source: ${OWNERS_SRC})"
echo "      Connected assets: ${ASSETS_DRILL} (source: ${ASSETS_SRC})"
echo "      Workflows:        ${WORKFLOWS_DRILL} (source: ${WORKFLOWS_SRC})"

# 5. Clean up drill database and temporary files (always, even on failure)
echo "[5/5] Cleaning up drill database..."
docker compose -f deploy/compose.yml exec -T postgres psql -U anychat -d postgres -c "DROP DATABASE IF EXISTS ${DRILL_DB};" >/dev/null
rm -f "${TEMP_DUMP}" "${RESTORE_LOG}"

echo ""
echo "=========================================================="
if [ "${DEFECTS}" -eq 0 ]; then
  echo "  Restore Drill Result: SUCCESS (0 defects found)"
  echo "  Status:              GATE G7 PASSED"
else
  echo "  Restore Drill Result: FAILURE (${DEFECTS} defect(s) found)"
  echo "  Status:              GATE G7 FAILED"
fi
echo "  Measured Duration:   ${ELAPSED_SEC} seconds"
echo "=========================================================="

if [ "${DEFECTS}" -ne 0 ]; then
  exit 1
fi
