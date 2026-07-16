// SPDX-License-Identifier: MPL-2.0

import { describe, expect, it } from 'vitest';
import { UpdateService, compareVersions, normalizeVersion, selectReleaseAsset } from './update-service';

const assets = [
  { name: 'CodeDrobe-1.1.0-full.nupkg', size: 120, browser_download_url: 'https://github.com/anhao/codedrobe-desktop/releases/download/v1.1.0/CodeDrobe-1.1.0-full.nupkg' },
  { name: 'CodeDrobe-Setup.exe', size: 130, digest: `sha256:${'a'.repeat(64)}`, browser_download_url: 'https://github.com/anhao/codedrobe-desktop/releases/download/v1.1.0/CodeDrobe-Setup.exe' },
  { name: 'CodeDrobe.dmg', size: 110, browser_download_url: 'https://github.com/anhao/codedrobe-desktop/releases/download/v1.1.0/CodeDrobe.dmg' },
  { name: 'CodeDrobe-darwin-arm64-1.1.0.zip', size: 108, browser_download_url: 'https://github.com/anhao/codedrobe-desktop/releases/download/v1.1.0/CodeDrobe-darwin-arm64-1.1.0.zip' },
];

describe('update version utilities', () => {
  it('规范化并比较语义版本', () => {
    expect(normalizeVersion('v1.2.3+build.5')).toBe('1.2.3');
    expect(compareVersions('1.1.0', '1.0.9')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.0.0-beta.1', '1.0.0')).toBeLessThan(0);
  });

  it('为 Windows 选择 Setup EXE', () => {
    expect(selectReleaseAsset(assets, 'win32', 'x64')).toMatchObject({ name: 'CodeDrobe-Setup.exe', sha256: 'a'.repeat(64) });
  });

  it('为 macOS 选择 DMG 并拒绝第三方下载链接', () => {
    expect(selectReleaseAsset(assets, 'darwin', 'arm64')).toMatchObject({ name: 'CodeDrobe.dmg' });
    expect(selectReleaseAsset([{ name: 'CodeDrobe.dmg', size: 10, browser_download_url: 'https://example.com/CodeDrobe.dmg' }], 'darwin', 'arm64')).toBeNull();
  });

  it('从 GitHub Release 检测匹配当前平台的新版本', async () => {
    const releaseFetcher = (async () => Response.json({
      tag_name: 'v1.1.0',
      html_url: 'https://github.com/anhao/codedrobe-desktop/releases/tag/v1.1.0',
      assets,
    })) as typeof fetch;
    const service = new UpdateService('1.0.0', '/tmp/codedrobe-update-test', releaseFetcher, 'darwin', 'arm64');

    await expect(service.check()).resolves.toMatchObject({
      status: 'available',
      currentVersion: '1.0.0',
      latestVersion: '1.1.0',
      asset: { name: 'CodeDrobe.dmg' },
    });
  });
});
