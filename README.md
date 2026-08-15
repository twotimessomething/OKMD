# OKMD

A small, standalone markdown reader and editor for macOS, built to make reading
markdown look good by default.

There is one interaction: the **Preview / Raw** toggle at the top, or ⌘E.

## Install

Download `OKMD-mac-arm64.zip` from [Releases][releases], unzip it, and drag
`OKMD.app` into `/Applications`.

The app is signed ad-hoc rather than with an Apple Developer certificate, so
macOS quarantines it on first launch and refuses to open it. To clear that:

```bash
xattr -dr com.apple.quarantine /Applications/OKMD.app
```

It opens normally afterwards. Apple Silicon only.

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

`./pack.sh` repacks `app/` into `OKMD.app`, applies `OKMD.icns`, re-signs, and
refreshes `okmd-source.zip`.

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
