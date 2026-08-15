#!/bin/bash
# Repack app/ into OKMD.app and refresh okmd-source.zip.
set -euo pipefail
cd "$(dirname "$0")"

npx --yes @electron/asar pack app OKMD.app/Contents/Resources/app.asar

# Info.plist points at electron.icns, so the app icon goes in under that name.
# Regenerate OKMD.icns from the logo with `python3 make-icon.py`.
[ -f OKMD.icns ] && cp OKMD.icns OKMD.app/Contents/Resources/electron.icns

codesign --force --deep --sign - OKMD.app
touch OKMD.app   # nudge Finder/Dock to pick up a changed icon

rm -f okmd-source.zip
zip -qr okmd-source.zip app -x '*.DS_Store'

echo "Packed app/ -> OKMD.app and okmd-source.zip"
