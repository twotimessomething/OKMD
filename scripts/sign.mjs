#!/usr/bin/env node
//
// Signs OKMD.app with a Developer ID certificate, for distribution outside the
// App Store. Called by `./pack.sh --release`; not meant to be run on its own.
//
// Two reasons this is a script rather than a codesign call in pack.sh:
//
//   1. Order matters. An Electron bundle holds four helper apps, four
//      frameworks, four dylibs, chrome_crashpad_handler and ShipIt, and each
//      has to be signed before the bundle that contains it. `codesign --deep`
//      does not reliably get this right and Apple discourages it.
//
//   2. Least privilege. The electron-osx-sign CLI has no --entitlements flag,
//      so it falls back to the entitlements bundled with the package — which
//      request camera, microphone, Bluetooth, USB, location and photo-library
//      access. OKMD needs none of those. Going through the Node API lets us
//      pass build/entitlements.plist for every binary instead.
//
// The signing key itself is never touched here. It stays in the login keychain;
// macOS uses it and hands back a signature.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sign } from '@electron/osx-sign';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const identity = process.env.OKMD_SIGN_IDENTITY;

if (!identity) {
  console.error('sign.mjs: OKMD_SIGN_IDENTITY is not set. Run ./pack.sh --release instead.');
  process.exit(1);
}

await sign({
  app: path.join(root, 'OKMD.app'),
  identity,
  platform: 'darwin',
  // Applied to the outer bundle and to every binary inside it. hardenedRuntime
  // is required for notarization. A secure timestamp is added by default, and
  // is what keeps already-signed builds valid after the certificate expires.
  optionsForFile: () => ({
    entitlements: path.join(root, 'build', 'entitlements.plist'),
    hardenedRuntime: true,
  }),
});

console.log(`Signed OKMD.app as ${identity}`);
