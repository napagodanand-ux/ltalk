#!/bin/bash
set -euo pipefail

echo "=== Installing LTalk daemon service ==="

SERVICE_DIR="$HOME/.config/systemd/user"
SERVICE_FILE="$SERVICE_DIR/ltalkd.service"

mkdir -p "$SERVICE_DIR"

# Find ltalkd binary
if [ -f "./dist/ltalkd/ltalkd" ]; then
    LTALKD_PATH="$(pwd)/dist/ltalkd/ltalkd"
elif command -v ltalkd &> /dev/null; then
    LTALKD_PATH="$(which ltalkd)"
else
    echo "Error: ltalkd binary not found"
    exit 1
fi

# Create service file
cat > "$SERVICE_FILE" << EOF
[Unit]
Description=LTalk Background Daemon
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=$LTALKD_PATH
Restart=always
RestartSec=5
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=default.target
EOF

# Enable and start
systemctl --user daemon-reload
systemctl --user enable ltalkd.service
systemctl --user start ltalkd.service

echo "LTalk daemon installed and started."
echo "Check status: systemctl --user status ltalkd"
echo "View logs: journalctl --user -u ltalkd"
