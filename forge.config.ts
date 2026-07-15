// SPDX-License-Identifier: MPL-2.0

import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { VitePlugin } from '@electron-forge/plugin-vite';
import path from 'node:path';

const coreRoot = path.resolve('node_modules', '@codedrobe', 'codex-core');

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    appBundleId: 'app.codedrobe.desktop',
    appCategoryType: 'public.app-category.developer-tools',
    executableName: 'CodeDrobe',
    icon: 'assets/icon',
    extraResource: [
      path.join(coreRoot, 'scripts'),
      path.join(coreRoot, 'assets'),
      path.join(coreRoot, 'themes'),
      path.resolve('assets', 'runtime'),
      path.resolve('LICENSE'),
      path.resolve('SOURCE_CODE.md'),
      path.resolve('THIRD_PARTY_NOTICES.md'),
      path.resolve('TRADEMARKS.md'),
      path.resolve('ASSETS_LICENSE.md'),
      path.resolve('licenses'),
    ],
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      name: 'CodeDrobe',
      setupExe: 'CodeDrobe-Setup.exe',
      setupIcon: 'assets/icon.ico',
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
