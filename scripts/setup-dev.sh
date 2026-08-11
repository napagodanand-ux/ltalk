#!/bin/bash
set -euo pipefail

echo "=== Setting up LTalk development environment ==="

# Check Python version
python3 --version

# Create virtual environment
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt
pip install -e ".[dev]"

# Check for system dependencies
echo ""
echo "Checking system dependencies..."

# Qt
if python3 -c "import PySide6" 2>/dev/null; then
    echo "[OK] PySide6"
else
    echo "[MISSING] PySide6 - install via: pip install PySide6"
fi

# qasync
if python3 -c "import qasync" 2>/dev/null; then
    echo "[OK] qasync"
else
    echo "[MISSING] qasync - install via: pip install qasync"
fi

# SQLCipher
if python3 -c "from pysqlcipher3 import dbapi2" 2>/dev/null; then
    echo "[OK] pysqlcipher3"
else
    echo "[MISSING] pysqlcipher3 - install via: pip install pysqlcipher3"
    echo "  May need: sudo apt install libsqlcipher-dev"
fi

# dasbus
if python3 -c "import dasbus" 2>/dev/null; then
    echo "[OK] dasbus"
else
    echo "[MISSING] dasbus - install via: pip install dasbus"
fi

# WebEngine (optional)
if python3 -c "from PySide6 import QtWebEngine" 2>/dev/null; then
    echo "[OK] PySide6-QtWebEngine"
else
    echo "[OPTIONAL] PySide6-QtWebEngine - needed for video calls"
fi

echo ""
echo "Setup complete!"
echo "Run the GUI: python -m ltalk_app.main"
echo "Run the daemon: python -m ltalkd.main"
echo "Run tests: pytest tests/"
