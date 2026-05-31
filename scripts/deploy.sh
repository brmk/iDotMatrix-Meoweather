#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

[[ -f .env ]] && set -a && source .env && set +a

RPI="${RPI_HOST:-pi@raspberrypi.local}"
DIR="${RPI_DIR:-\$HOME/led-matrix}"

ssh "$RPI" "mkdir -p $DIR"
rsync -az compose.rpi.yml "$RPI:$DIR/compose.rpi.yml"
rsync -az --ignore-existing .env.example "$RPI:$DIR/.env"
ssh "$RPI" "touch $DIR/runtime.json"
ssh "$RPI" "cd $DIR && docker compose -f compose.rpi.yml pull && docker compose -f compose.rpi.yml up -d --remove-orphans && docker image prune -f"
