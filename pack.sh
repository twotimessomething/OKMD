#!/bin/bash
# Repack app/ into OKMD.app and refresh okmd-source.zip.
#
#   ./pack.sh            ad-hoc signature — fast, for local iteration
#   ./pack.sh --release  Developer ID signature + notarization, for a Release
#
# The release path needs a Developer ID Application certificate in the login
# keychain, plus notarization credentials stored under a notarytool profile.
# See "Signing a release" in README.md for the one-time setup.
set -euo pipefail
cd "$(dirname "$0")"

RELEASE=0
case "${1:-}" in
  "")        ;;
  --release) RELEASE=1 ;;
  *)         echo "usage: $0 [--release]" >&2; exit 2 ;;
esac

NOTARY_PROFILE="${OKMD_NOTARY_PROFILE:-okmd-notary}"

npx --yes @electron/asar pack app OKMD.app/Contents/Resources/app.asar

# Info.plist points at electron.icns, so the app icon goes in under that name.
# Regenerate OKMD.icns from the logo with `python3 make-icon.py`.
[ -f OKMD.icns ] && cp OKMD.icns OKMD.app/Contents/Resources/electron.icns

if [ "$RELEASE" -eq 0 ]; then
  codesign --force --deep --sign - OKMD.app
  touch OKMD.app   # nudge Finder/Dock to pick up a changed icon
else
  # 1/7 — find the certificate. Auto-detected so the Team ID is never
  # hardcoded; override with OKMD_SIGN_IDENTITY if you hold more than one.
  SIGN_IDENTITY="${OKMD_SIGN_IDENTITY:-$(security find-identity -v -p codesigning \
    | grep -o 'Developer ID Application: [^"]*' | head -1 || true)}"

  if [ -z "$SIGN_IDENTITY" ]; then
    echo "error: no Developer ID Application certificate in the login keychain." >&2
    echo >&2
    echo "That is the certificate for distributing outside the App Store. It needs" >&2
    echo "a paid Apple Developer Program membership, and is created with:" >&2
    echo "  Xcode > Settings > Accounts > Manage Certificates > + > Developer ID Application" >&2
    echo >&2
    echo "Identities currently available:" >&2
    security find-identity -v -p codesigning >&2
    exit 1
  fi
  echo "==> Signing as: $SIGN_IDENTITY"

  # 2/7 — fail fast on missing notary credentials, before the slow steps.
  # `history` takes no --limit on notarytool 1.x; the exit code is all we want.
  if ! xcrun notarytool history --keychain-profile "$NOTARY_PROFILE" >/dev/null 2>&1; then
    echo "error: no notarization credentials stored under profile '$NOTARY_PROFILE'." >&2
    echo "Store them once, using an app-specific password from appleid.apple.com:" >&2
    echo "  xcrun notarytool store-credentials \"$NOTARY_PROFILE\" \\" >&2
    echo "    --apple-id <apple-id> --team-id <team-id> --password <app-specific-password>" >&2
    exit 1
  fi

  # 3/7 — sign inner binaries first, with build/entitlements.plist throughout.
  [ -d node_modules/@electron/osx-sign ] || npm install --silent
  OKMD_SIGN_IDENTITY="$SIGN_IDENTITY" node scripts/sign.mjs

  # 4/7 — verify locally before spending a notarization round trip.
  echo "==> Verifying signature"
  codesign --verify --deep --strict --verbose=2 OKMD.app

  # 5/7 — notarize. This zip is transport for Apple only; it is not what ships,
  # because the ticket still has to be stapled onto the .app afterwards.
  echo "==> Notarizing (usually a couple of minutes)"
  NOTARIZE_DIR="$(mktemp -d)"
  trap 'rm -rf "$NOTARIZE_DIR"' EXIT
  ditto -c -k --keepParent OKMD.app "$NOTARIZE_DIR/OKMD.zip"
  if ! xcrun notarytool submit "$NOTARIZE_DIR/OKMD.zip" \
       --keychain-profile "$NOTARY_PROFILE" --wait; then
    echo >&2
    echo "Notarization failed. Take the submission id printed above and run:" >&2
    echo "  xcrun notarytool log <id> --keychain-profile \"$NOTARY_PROFILE\"" >&2
    exit 1
  fi

  # 6/7 — staple, so first launch works even with no network.
  echo "==> Stapling ticket"
  xcrun stapler staple OKMD.app
  xcrun stapler validate OKMD.app

  # 7/7 — the assessment a user's Mac makes on first launch. Wanted result is
  # "accepted ... source=Notarized Developer ID".
  echo "==> Gatekeeper assessment"
  spctl --assess --type execute --verbose=4 OKMD.app

  rm -f OKMD-mac-arm64.zip
  ditto -c -k --keepParent OKMD.app OKMD-mac-arm64.zip
  echo "==> OKMD-mac-arm64.zip signed, notarized, stapled — ready to upload"
fi

rm -f okmd-source.zip
zip -qr okmd-source.zip app -x '*.DS_Store'

echo "Packed app/ -> OKMD.app and okmd-source.zip"
