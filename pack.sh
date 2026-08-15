#!/bin/bash
# Repack app/ into OKMD.app and refresh okmd-source.zip.
#
#   ./pack.sh                  ad-hoc signature — fast, for local iteration
#   ./pack.sh --release        Developer ID signature + notarization
#   ./pack.sh --publish [tag]  the above, then upload to GitHub Releases
#
# The release path needs a Developer ID Application certificate in the login
# keychain, plus notarization credentials stored under a notarytool profile.
# See "Signing a release" in README.md for the one-time setup.
#
# --publish defaults to the tag "v<version from app/package.json>". If a release
# for that tag already exists the zip replaces its asset; if not, a *draft*
# release is created so nothing goes public before you have read it over.
set -euo pipefail
cd "$(dirname "$0")"

RELEASE=0
PUBLISH=0
TAG=""
case "${1:-}" in
  "")        ;;
  --release) RELEASE=1 ;;
  --publish) RELEASE=1; PUBLISH=1; TAG="${2:-}" ;;
  *)         echo "usage: $0 [--release | --publish [tag]]" >&2; exit 2 ;;
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
  # 1 — find the certificate. Auto-detected so the Team ID is never
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

  # 2 — fail fast on missing notary credentials, before the slow steps.
  # `history` takes no --limit on notarytool 1.x; the exit code is all we want.
  if ! xcrun notarytool history --keychain-profile "$NOTARY_PROFILE" >/dev/null 2>&1; then
    echo "error: no notarization credentials stored under profile '$NOTARY_PROFILE'." >&2
    echo "Store them once, using an app-specific password from appleid.apple.com:" >&2
    echo "  xcrun notarytool store-credentials \"$NOTARY_PROFILE\" \\" >&2
    echo "    --apple-id <apple-id> --team-id <team-id> --password <app-specific-password>" >&2
    exit 1
  fi

  # 3 — fail fast on anything --publish will need, before the slow steps too.
  if [ "$PUBLISH" -eq 1 ]; then
    command -v gh >/dev/null 2>&1 \
      || { echo "error: gh is not installed. brew install gh" >&2; exit 1; }
    gh auth status >/dev/null 2>&1 \
      || { echo "error: gh is not authenticated. Run: gh auth login" >&2; exit 1; }
    VERSION="$(node -p "require('./app/package.json').version")"
    TAG="${TAG:-v$VERSION}"
    if [ -n "$(git status --porcelain)" ]; then
      echo "warning: working tree is dirty, so the published build will not" >&2
      echo "         correspond to any commit. Continuing anyway." >&2
    fi
  fi

  # 4 — sign inner binaries first, with build/entitlements.plist throughout.
  [ -d node_modules/@electron/osx-sign ] || npm install --silent
  OKMD_SIGN_IDENTITY="$SIGN_IDENTITY" node scripts/sign.mjs

  # 5 — verify locally before spending a notarization round trip.
  echo "==> Verifying signature"
  codesign --verify --deep --strict --verbose=2 OKMD.app

  # 6 — notarize. This zip is transport for Apple only; it is not what ships,
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

  # 7 — staple, so first launch works even with no network.
  echo "==> Stapling ticket"
  xcrun stapler staple OKMD.app
  xcrun stapler validate OKMD.app

  # 8 — the assessment a user's Mac makes on first launch. Wanted result is
  # "accepted ... source=Notarized Developer ID".
  echo "==> Gatekeeper assessment"
  spctl --assess --type execute --verbose=4 OKMD.app

  rm -f OKMD-mac-arm64.zip
  ditto -c -k --keepParent OKMD.app OKMD-mac-arm64.zip

  if [ "$PUBLISH" -eq 0 ]; then
    echo "==> OKMD-mac-arm64.zip signed, notarized, stapled — ready to upload"
  else
    # 9 — publish. Replacing the asset on an existing release is the usual
    # path. A tag with no release yet gets a draft instead, so a new version
    # never goes public before you have read the notes.
    if gh release view "$TAG" >/dev/null 2>&1; then
      echo "==> Replacing OKMD-mac-arm64.zip on existing release $TAG"
      gh release upload "$TAG" OKMD-mac-arm64.zip --clobber
    else
      echo "==> No release $TAG yet — creating it as a draft"
      gh release create "$TAG" OKMD-mac-arm64.zip \
        --draft --title "OKMD $VERSION" --notes 'Apple Silicon only.

Unzip and drag `OKMD.app` into `/Applications`.

The app is signed with an Apple Developer ID and notarized by Apple, so it opens on a double-click — no warning dialog and no terminal commands.'
      echo "    Draft created — review it, then publish it from the URL below."
    fi
    gh release view "$TAG" --json url --jq .url
  fi
fi

rm -f okmd-source.zip
zip -qr okmd-source.zip app -x '*.DS_Store'

echo "Packed app/ -> OKMD.app and okmd-source.zip"
