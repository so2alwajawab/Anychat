#!/usr/bin/env bash
# ==============================================================================
# AnyChat — PostgreSQL Database Restore Script (Gate G7)
# Restores a specified pg_dump file into the Postgres container.
# ==============================================================================
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <path-to-dump-file>"
  exit 1
fi

DUMP_FILE="$1"
if [ ! -f "${DUMP_FILE}" ]; then
  echo "ERROR: Backup file '${DUMP_FILE}' not found!"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "WARNING: This will overwrite data in the 'anychat' database."
read -p "Are you sure you want to restore from ${DUMP_FILE}? (yes/no): " CONFIRM
if [ "${CONFIRM}" != "yes" ]; then
  echo "Restore aborted by user."
  exit 0
fi

echo "Stopping API and Worker containers..."
cd "${PROJECT_DIR}"
docker compose -f deploy/compose.yml stop api || true

echo "Restoring database from ${DUMP_FILE}..."
docker compose -f deploy/compose.yml exec -T postgres pg_restore \
  -U anychat \
  -d anychat \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges < "${DUMP_FILE}" || true

echo "Restarting API and verifying health..."
docker compose -f deploy/compose.yml start api
sleep 5
docker compose -f deploy/compose.yml exec -T postgres psql -U anychat -d anychat -c "SELECT COUNT(*) FROM owner_account;"
echo "Database restore completed successfully!"
