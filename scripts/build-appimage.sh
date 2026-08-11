#!/bin/bash
set -euo pipefail

echo "=== Building LTalk AppImage ==="

# Step 1: Check dependencies
echo "[1/7] Checking dependencies..."
python3 --version
pip3 --version

# Step 2: Install dependencies
echo "[2/7] Installing dependencies..."
pip3 install -r requirements.txt
pip3 install pyinstaller
pip3 install secretstorage  # For keyring integration

# Step 3: Build ltalk-core package
echo "[3/7] Building ltalk_core..."
pip3 install -e ".[gui,sqlcipher]"

# Step 4: Bundle with PyInstaller
echo "[4/7] Bundling with PyInstaller..."
pyinstaller \
    --name=ltalk \
    --windowed \
    --icon=assets/icons/ltalk.png \
    --add-data="ltalk_app/resources:resources" \
    --hidden-import=PySide6.QtQml \
    --hidden-import=PySide6.QtWebEngine \
    --hidden-import=qasync \
    --hidden-import=dasbus \
    --hidden-import=pysqlcipher3 \
    --hidden-import=secretstorage \
    --hidden-import=secretstorage.dbus \
    --collect-all secretstorage \
    ltalk_app/main.py

pyinstaller \
    --name=ltalkd \
    --console \
    --hidden-import=pysqlcipher3 \
    --hidden-import=dasbus \
    --hidden-import=secretstorage \
    --hidden-import=secretstorage.dbus \
    --collect-all secretstorage \
    ltalkd/main.py

# Step 5: Create AppDir structure
echo "[5/7] Creating AppDir..."
mkdir -p AppDir/usr/bin
mkdir -p AppDir/usr/share/icons/hicolor/512x512/apps
mkdir -p AppDir/usr/share/applications
mkdir -p AppDir/usr/share/doc

cp dist/ltalk/* AppDir/usr/bin/
cp dist/ltalkd/ltalkd AppDir/usr/bin/
cp assets/icons/ltalk.png AppDir/usr/share/icons/hicolor/512x512/apps/
cp assets/linux/ltalk.desktop AppDir/usr/share/applications/
if [ -f README.md ]; then
    cp README.md AppDir/usr/share/doc/
fi

# Step 6: Copy libsignal if available
echo "[6/7] Copying libsignal..."
if [ -f /usr/lib/libsignal_ffi.so ]; then
    cp /usr/lib/libsignal_ffi.so AppDir/usr/lib/
elif [ -f /usr/local/lib/libsignal_ffi.so ]; then
    cp /usr/local/lib/libsignal_ffi.so AppDir/usr/lib/
else
    echo "WARNING: libsignal_ffi.so not found. E2EE will use fallback."
fi

# Step 7: Create AppImage with linuxdeploy
echo "[7/7] Creating AppImage..."
if command -v linuxdeploy &> /dev/null; then
    linuxdeploy \
        --appdir AppDir \
        --executable AppDir/usr/bin/ltalk \
        --desktop-file AppDir/usr/share/applications/ltalk.desktop \
        --icon-file AppDir/usr/share/icons/hicolor/512x512/apps/ltalk.png \
        --output appimage
    echo "AppImage created: $(ls LTalk-*.AppImage)"
else
    echo "linuxdeploy not found. Install it from https://github.com/linuxdeploy/linuxdeploy"
    echo "AppDir created at: AppDir/"
fi

echo ""
echo "On first run, LTalk will install the systemd daemon service."
echo "Manual install: ./scripts/install-daemon.sh"
