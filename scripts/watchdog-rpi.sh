#!/usr/bin/env bash
# BLE watchdog — runs every 5 minutes via cron.
# Reboots the Pi when the sidecar reports connected:false for MAX_FAILURES
# consecutive checks, which indicates the BLE chip has hung (not a transient gap).
#
# Installed by deploy.sh:
#   cron:    */5 * * * * /home/<user>/led-matrix/watchdog-rpi.sh
#   sudoers: <user> ALL=(ALL) NOPASSWD: /sbin/reboot
set -euo pipefail

STATE=/var/tmp/ble-watchdog-failures
MAX_FAILURES=${BLE_WATCHDOG_MAX_FAILURES:-3}   # 3 × 5 min = 15 min

log() { logger -t ble-watchdog "$*"; }

# Query sidecar health. If it's unreachable the containers are still starting —
# reset the counter and exit cleanly.
HEALTH=$(curl -sf --max-time 5 http://127.0.0.1:8765/health 2>/dev/null || true)
if [[ -z "$HEALTH" ]]; then
  rm -f "$STATE"
  exit 0
fi

CONNECTED=$(python3 -c "import sys,json; print(json.load(sys.stdin).get('connected'))" <<<"$HEALTH" 2>/dev/null || echo "False")

if [[ "$CONNECTED" == "True" ]]; then
  rm -f "$STATE"
  exit 0
fi

# connected: false — increment failure counter
FAILURES=$(cat "$STATE" 2>/dev/null || echo 0)
FAILURES=$(( FAILURES + 1 ))
echo "$FAILURES" >"$STATE"
log "BLE disconnected ($FAILURES/$MAX_FAILURES consecutive checks)"

if (( FAILURES >= MAX_FAILURES )); then
  log "Threshold reached — rebooting to recover BLE stack"
  rm -f "$STATE"
  sudo /sbin/reboot
fi
