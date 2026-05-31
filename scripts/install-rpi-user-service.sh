#!/usr/bin/env bash
set -euo pipefail

UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
UNIT_PATH="$UNIT_DIR/led-matrix-idotmatrix.service"
COMPOSE_FILE="$HOME/led-matrix/compose.rpi.yml"

mkdir -p "$UNIT_DIR"

cat >"$UNIT_PATH" <<EOF
[Unit]
Description=LED Matrix iDotMatrix stack
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$HOME/led-matrix
ExecStart=/bin/bash -c 'docker compose -f $COMPOSE_FILE up -d'
ExecStop=/bin/bash -c 'docker compose -f $COMPOSE_FILE down'
TimeoutStartSec=0

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable led-matrix-idotmatrix.service

echo "Installed: $UNIT_PATH"
echo "To start: systemctl --user start led-matrix-idotmatrix.service"
echo "To auto-start without login: sudo loginctl enable-linger $USER"
