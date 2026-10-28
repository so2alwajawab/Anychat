#!/usr/bin/env bash
# ==============================================================================
# AnyChat — Health Monitoring & Outage Alerting Daemon (Gate G7)
# Probes /healthz, /readyz, and web /login every 30 seconds.
# Dispatches alerts on transition to down/unhealthy and transition to recovered.
# ==============================================================================
set -euo pipefail

API_URL="${API_URL:-http://127.0.0.1:4001}"
WEB_URL="${WEB_URL:-http://127.0.0.1:3001}"
LOG_FILE="/tmp/anychat_monitor.log"
ALERT_WEBHOOK="${ALERT_WEBHOOK:-}" # Optional Telegram / Discord webhook URL

PREV_STATE="UP"

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOG_FILE}"
}

send_alert() {
  local STATUS="$1"
  local DETAILS="$2"
  log "ALERT [${STATUS}]: ${DETAILS}"

  if [ -n "${ALERT_WEBHOOK}" ]; then
    curl -s -X POST -H "Content-Type: application/json" \
      -d "{\"text\":\"🚨 [AnyChat Monitor] Status: ${STATUS}\n${DETAILS}\"}" \
      "${ALERT_WEBHOOK}" >/dev/null || true
  fi
}

check_health() {
  local API_HEALTH=0
  local API_READY=0
  local WEB_HEALTH=0

  # Check API /healthz
  if curl -sf --max-time 5 "${API_URL}/healthz" >/dev/null 2>&1; then
    API_HEALTH=1
  fi

  # Check API /readyz
  if curl -sf --max-time 5 "${API_URL}/readyz" >/dev/null 2>&1; then
    API_READY=1
  fi

  # Check Web /login
  if curl -sf --max-time 5 "${WEB_URL}/login" >/dev/null 2>&1; then
    WEB_HEALTH=1
  fi

  if [ "${API_HEALTH}" -eq 1 ] && [ "${API_READY}" -eq 1 ] && [ "${WEB_HEALTH}" -eq 1 ]; then
    echo "UP"
  else
    echo "DOWN (API_HEALTH=${API_HEALTH}, API_READY=${API_READY}, WEB_HEALTH=${WEB_HEALTH})"
  fi
}

log "Starting AnyChat Health Monitor daemon..."
log "Probing API: ${API_URL}, Web: ${WEB_URL}"

# If running as one-shot check (e.g. for drills):
if [ "${1:-}" = "--once" ]; then
  CURRENT_STATE="$(check_health)"
  log "Health Status: ${CURRENT_STATE}"
  if [[ "${CURRENT_STATE}" == *"DOWN"* ]]; then
    send_alert "OUTAGE DETECTED" "${CURRENT_STATE}"
    exit 1
  fi
  exit 0
fi

# Continuous loop
while true; do
  CURRENT_STATE="$(check_health)"

  if [[ "${CURRENT_STATE}" == *"DOWN"* ]]; then
    if [ "${PREV_STATE}" = "UP" ]; then
      send_alert "OUTAGE DETECTED" "Services became unreachable: ${CURRENT_STATE}"
      PREV_STATE="DOWN"
    fi
  else
    if [ "${PREV_STATE}" = "DOWN" ]; then
      send_alert "RECOVERED" "All services are back UP and healthy!"
      PREV_STATE="UP"
    fi
  fi

  sleep 30
done
