#!/bin/bash
set -euo pipefail

echo "=== Starting LTalk daemon manually ==="

# Check if daemon is already running
if pgrep -f "ltalkd" > /dev/null; then
    echo "Daemon is already running. Stop it first or use restart."
    exit 1
fi

# Find ltalkd binary
if [ -f "./dist/ltalkd/ltalkd" ]; then
    exec ./dist/ltalkd/ltalkd
elif command -v ltalkd &> /dev/null; then
    exec ltalkd
elif [ -f "./ltalkd/main.py" ]; then
    exec python3 -m ltalkd.main
else
    echo "Error: ltalkd not found"
    exit 1
fi
