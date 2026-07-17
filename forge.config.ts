// SPDX-License-Identifier: MPL-2.0

import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerWix } from '@electron-forge/maker-wix';
import { MakerZIP } from '@electron-forge/maker-zip';
import { VitePlugin } from '@electron-forge/plugin-vite';
import path from 'node:path';

// macOS signing/notarization only activates when CI injects credentials
// (see .github/workflows/build.yml); local `npm run make` stays unsigned.
const macosSign = process.env.MACOS_SIGN === '1';
const macosNotarize =
  macosSign &&
  Boolean(process.env.APPLE_API_KEY) &&
  Boolean(process.env.APPLE_API_KEY_ID) &&
  Boolean(process.env.APPLE_API_ISSUER);

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    appBundleId: 'app.codedrobe.desktop',
    appCategoryType: 'public.app-category.developer-tools',
    executableName: 'CodeDrobe',
    icon: 'assets/icon',
    // codedrobe:// deep links (themes/apply + oauth/callback fallback).
    protocols: [
      { name: 'CodeDrobe', schemes: ['codedrobe'] },
    ],
    extraResource: [
      path.resolve('assets', 'runtime'),
      path.resolve('LICENSE'),
      path.resolve('SOURCE_CODE.md'),
      path.resolve('THIRD_PARTY_NOTICES.md'),
      path.resolve('TRADEMARKS.md'),
      path.resolve('ASSETS_LICENSE.md'),
      path.resolve('licenses'),
    ],
    // Default @electron/osx-sign options: hardened runtime plus Electron's
    // baseline entitlements; the Developer ID identity is discovered from the
    // keychain search list.
    osxSign: macosSign ? {} : undefined,
    osxNotarize: macosNotarize
      ? {
          // Path to the App Store Connect API key (.p8) written by CI.
          appleApiKey: process.env.APPLE_API_KEY as string,
          appleApiKeyId: process.env.APPLE_API_KEY_ID as string,
          appleApiIssuer: process.env.APPLE_API_ISSUER as string,
        }
      : undefined,
  },
  rebuildConfig: {},
  makers: [
    new MakerWix({
      manufacturer: 'CodeDrobe',
      language: 1033,
      upgradeCode: '96A2CC81-4728-472B-8B4D-805401D1ECEA',
      appUserModelId: 'app.codedrobe.desktop',
      icon: 'assets/icon.ico',
    }, ['win32']),
    new MakerZIP({}, ['darwin']),
    new MakerDMG({
      format: 'ULFO',
      name: 'CodeDrobe',
      icon: 'assets/icon.icns',
    }, ['darwin']),
  ],
  plugins: [
    new VitePlugin({
      build: [
        { entry: 'src/main.ts', config: 'vite.main.config.ts', target: 'main' },
        { entry: 'src/preload.ts', config: 'vite.preload.config.ts', target: 'preload' },
      ],
      renderer: [
        { name: 'main_window', config: 'vite.renderer.config.ts' },
      ],
    }),
  ],
};

export default config;
