# OKMD

A small, standalone markdown reader and editor for macOS, built to make reading
markdown look good by default.

There are two interactions: the **Preview / Raw** toggle at the top, or ⌘E,
and the outline of the document's headings on the left, or ⌥⌘S.

## Install

Download `OKMD-mac-arm64.zip` from [Releases][releases], unzip it, and drag
`OKMD.app` into `/Applications`.

The app is signed with an Apple Developer ID and notarized by Apple, so it
opens on a double-click — no warning dialog and no terminal commands. Apple
Silicon only.

[releases]: ../../releases

## Use

| Shortcut | |
| --- | --- |
| ⌘N | New file |
| ⌘⇧N | New window |
| ⌘O | Open |
| ⌘S | Save |
| ⌘⇧S | Save as |
| ⌘E | Toggle Preview / Raw |
| ⌥⌘S | Show / hide the outline |

- The outline lists the document's headings. Click one to jump to that
  section; it keeps up with you as you scroll, and works in both views.
- The preview is editable. Type into it directly and the changes sync back to
  the markdown; task-list checkboxes are clickable and update the source.
- Every document gets its own window. macOS native tabs work — Window ▸ Merge
  All Windows, or the `+` in the tab bar.
- A window with no document shows the start screen: recent files first, then New
  and Open. Opening from there reuses the window. Opening from a window that
  already holds a document opens a new one.
- Drop a `.md` file on the window to open it.
- Light and dark mode follow the system.

Recent files are kept in `recents.json` under the app's user-data folder
(`~/Library/Application Support/OKMD`). Nothing else is stored, and the app
makes no network requests.

## The logo

`OKMD_logo.svg` is the source of truth for both places the mark appears:

- **App icon** — `python3 make-icon.py` renders it onto the macOS icon grid
  (824×824 squircle centred on 1024, soft shadow) and writes `OKMD.icns`.
  Re-run it whenever the logo changes, then `./pack.sh`.
- **Start screen** — the wordmark is inlined into `index.html` as SVG so it can
  follow the theme. "OK" uses `--text-heading`, "MD" keeps the brand orange
  (`--logo-md`). If the logo art changes, re-inline the paths.

## Build

`./pack.sh` repacks `app/` into `OKMD.app`, applies `OKMD.icns`, re-signs
ad-hoc, and refreshes `okmd-source.zip`. That is the loop for local iteration.

`./pack.sh --release` does the same, then signs with the Developer ID
certificate, notarizes with Apple, staples the ticket, and writes the
`OKMD-mac-arm64.zip` that gets uploaded to Releases. It verifies at each step
and stops on the first failure.

`./pack.sh --publish` goes one further and uploads that zip with `gh`. The tag
defaults to `v` plus the version in `app/package.json`; pass one explicitly as
`./pack.sh --publish v1.1.0`. If a release for the tag already exists its asset
is replaced, and if not a **draft** is created — so a new version never goes
public before you have read the notes over.

### Signing a release

One-time setup, needing a paid Apple Developer Program membership:

1. Create the certificate: Xcode ▸ Settings ▸ Accounts ▸ your Apple ID ▸
   Manage Certificates ▸ **+** ▸ **Developer ID Application**. The private key
   is generated straight into the login keychain and should stay there —
   `pack.sh` never reads or copies it, it asks macOS to sign on its behalf.
2. Generate an app-specific password at [appleid.apple.com][asp] ▸ Sign-In and
   Security ▸ App-Specific Passwords. This is *not* your Apple ID password, and
   it can only submit apps for notarization — it cannot sign anything.
3. Store it in the keychain so it never lives in a script or a shell history:

   ```bash
   xcrun notarytool store-credentials "okmd-notary" \
     --apple-id "<your-apple-id>" --team-id "LPJ28CF2F5" --password "<app-specific-password>"
   ```

Then `./pack.sh --publish` for every release. Roughly three minutes, most of it
waiting on Apple. Two conveniences worth setting up once: authenticate `gh auth
login` so the upload step works, and add `/usr/bin/codesign` to the signing
key's access list in Keychain Access (Get Info ▸ Access Control) so macOS stops
asking for your password once per binary.

Two things worth knowing. Signatures carry a secure timestamp, so builds stay
valid after the certificate expires — letting the membership lapse does not
break anything already shipped. And if a `.p12` export of the key ever leaks,
revoke the certificate at [developer.apple.com][certs] and re-sign; `.gitignore`
covers the certificate extensions so one cannot be committed by accident.

`build/entitlements.plist` grants exactly one entitlement, `allow-jit`, which
V8 needs under the hardened runtime. `scripts/sign.mjs` explains why it does not
use the `electron-osx-sign` CLI.

[asp]: https://appleid.apple.com
[certs]: https://developer.apple.com/account/resources/certificates

To build the bundle from scratch:

```bash
npm install @electron/packager
npx electron-packager app OKMD \
  --platform=darwin --arch=arm64 --electron-version=43.2.0 \
  --app-bundle-id=com.scottyshu.okmd --icon=../OKMD.icns \
  --app-copyright="Copyright © 2026 Scott Shumaker" \
  --out=dist --overwrite
codesign --force --deep --sign - dist/OKMD-darwin-arm64/OKMD.app
```

## Layout

| | |
| --- | --- |
| `app/main.js` | Electron main process — windows, menu, recent files, open and save |
| `app/preload.js` | Bridge between main and renderer |
| `app/index.html` | Markup and all styling |
| `app/renderer.js` | Start screen, view toggle, markdown rendering, drag and drop |
| `app/vendor/` | Bundled marked, highlight.js, and turndown, so nothing is fetched at runtime |

## License

MIT — see [LICENSE](LICENSE). Bundled libraries and their notices are listed in
[THIRD-PARTY-LICENSES.md](THIRD-PARTY-LICENSES.md).
