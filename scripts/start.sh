#!/usr/bin/env bash
# Starts both the Python sidecar and the TypeScript scheduler.
# Used by the launchd agent (com.idotmatrix.weather.plist) and can be run
# directly for a production-style launch without hot-reload.
#
# The script traps EXIT so both child processes are stopped when the script
# terminates (e.g. launchctl stop, Ctrl-C, or one process dying).

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Load nvm so 'node' / 'npx' are on PATH when run as a launchd agent
# (launchd does not inherit the interactive shell's PATH).
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # shellcheck source=/dev/null
  source "$NVM_DIR/nvm.sh" --no-use
  nvm use default --silent 2>/dev/null || true
fi

cleanup() {
  kill "$SIDECAR_PID" "$TS_PID" 2>/dev/null || true
  wait "$SIDECAR_PID" "$TS_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "[start] launching sidecar..."
"$REPO/sidecar/.venv/bin/uvicorn" main:app \
  --app-dir "$REPO/sidecar" \
  --host 127.0.0.1 \
  --port 8765 &
SIDECAR_PID=$!

echo "[start] launching TypeScript scheduler..."
cd "$REPO"
npx tsx src/main.ts &
TS_PID=$!

echo "[start] both processes running (sidecar=$SIDECAR_PID ts=$TS_PID)"

# Block until either child exits, then the trap fires.
wait -n 2>/dev/null || wait
