#!/usr/bin/env bash
# ==============================================================================
# AnyChat — Automated PostgreSQL Backup Script (Gate G7)
# Runs pg_dump -Fc inside docker compose, creates timestamped backups,
# keeps rolling 30 daily copies, and prepares for off-site sync.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
BACKUP_DIR="${PROJECT_DIR}/backups"
TIMESTAMP="$(date +'%Y%m%d_%H%M%S')"
BACKUP_FILE="${BACKUP_DIR}/anychat_${TIMESTAMP}.dump"
LOG_FILE="${BACKUP_DIR}/backup.log"

mkdir -p "${BACKUP_DIR}"

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOG_FILE}"
}

log "Starting AnyChat automated database backup..."

# 1. Run pg_dump via docker compose
cd "${PROJECT_DIR}"
if docker compose -f deploy/compose.yml exec -T postgres pg_dump -U anychat -d anychat -Fc > "${BACKUP_FILE}"; then
  FILE_SIZE="$(du -h "${BACKUP_FILE}" | cut -f1)"
  log "Backup successful: ${BACKUP_FILE} (Size: ${FILE_SIZE})"
else
  log "ERROR: pg_dump failed!"
  exit 1
fi

# 2. Enforce rolling 30-day retention
log "Applying 30-day retention policy..."
find "${BACKUP_DIR}" -name "anychat_*.dump" -type f -mtime +30 -exec rm -f {} \;
log "Retention policy applied. Current backups count: $(find "${BACKUP_DIR}" -name "anychat_*.dump" | wc -l)"

# 3. Optional off-site sync via rclone (Google Drive per Phase 0 §11.3)
if command -v rclone >/dev/null 2>&1 && rclone listremotes | grep -q "^gdrive:"; then
  log "Syncing backup to off-site Google Drive repository via rclone..."
  rclone copy "${BACKUP_FILE}" gdrive:anychat-backups/daily/ --retries 3 || log "WARN: rclone sync failed"
  log "Off-site sync complete."
fi

log "Backup completed successfully."
