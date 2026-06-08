#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

[[ -f .env ]] && set -a && source .env && set +a

RPI="${RPI_HOST:-pi@raspberrypi.local}"
DIR="${RPI_DIR:-\$HOME/led-matrix}"

ssh "$RPI" "mkdir -p $DIR"
rsync -az compose.rpi.yml "$RPI:$DIR/compose.rpi.yml"
rsync -az --ignore-existing .env.example "$RPI:$DIR/.env"
rsync -az scripts/watchdog-rpi.sh "$RPI:$DIR/watchdog-rpi.sh"
ssh "$RPI" "chmod +x $DIR/watchdog-rpi.sh"
ssh "$RPI" "touch $DIR/runtime.json"
ssh "$RPI" "cd $DIR && docker-compose -f compose.rpi.yml pull && docker-compose -f compose.rpi.yml up -d --remove-orphans && docker image prune -f"

# Install BLE watchdog cron job (idempotent)
CRON_LINE="*/5 * * * * $DIR/watchdog-rpi.sh"
ssh "$RPI" "( crontab -l 2>/dev/null | grep -v watchdog-rpi; echo '$CRON_LINE' ) | crontab -"

# Grant passwordless reboot for the watchdog (idempotent)
SUDOERS_LINE="\$(whoami) ALL=(ALL) NOPASSWD: /sbin/reboot"
ssh "$RPI" "echo \"\$SUDOERS_LINE\" | sudo tee /etc/sudoers.d/ble-watchdog-reboot > /dev/null && sudo chmod 440 /etc/sudoers.d/ble-watchdog-reboot"

echo "Watchdog installed — checks every 5 min, reboots after 15 min of BLE disconnect"
