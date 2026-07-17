// SPDX-License-Identifier: MPL-2.0

import { describe, expect, it } from 'vitest';
import { UpdateService, compareVersions, normalizeVersion, selectReleaseAsset } from './update-service';

const download = (name: string) =>
  `https://github.com/CodeDrobe/desktop/releases/download/v1.1.0/${name}`;

const assets = [
  { kind: 'windows-portable', name: 'CodeDrobe-1.1.0-x64-Portable.exe', url: download('CodeDrobe-1.1.0-x64-Portable.exe'), sizeBytes: 120, sha256: null },
  { kind: 'windows-setup', name: 'CodeDrobe-1.1.0-x64-Setup.exe', url: download('CodeDrobe-1.1.0-x64-Setup.exe'), sizeBytes: 130, sha256: 'a'.repeat(64) },
  { kind: 'mac-dmg', name: 'CodeDrobe.dmg', url: download('CodeDrobe.dmg'), sizeBytes: 110, sha256: null },
  { kind: 'mac-zip', name: 'CodeDrobe-darwin-arm64-1.1.0.zip', url: download('CodeDrobe-darwin-arm64-1.1.0.zip'), sizeBytes: 108, sha256: null },
];

describe('update version utilities', () => {
  it('规范化并比较语义版本', () => {
    expect(normalizeVersion('v1.2.3+build.5')).toBe('1.2.3');
    expect(compareVersions('1.1.0', '1.0.9')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.0.0-beta.1', '1.0.0')).toBeLessThan(0);
  });

  it('为 Windows 优先选择 NSIS Setup EXE', () => {
    expect(selectReleaseAsset(assets, 'win32', 'x64')).toMatchObject({
      name: 'CodeDrobe-1.1.0-x64-Setup.exe',
      sha256: 'a'.repeat(64),
    });
  });

  it('为 macOS 选择 DMG 并拒绝第三方下载链接', () => {
    expect(selectReleaseAsset(assets, 'darwin', 'arm64')).toMatchObject({ name: 'CodeDrobe.dmg' });
    expect(selectReleaseAsset(
      [{ kind: 'mac-dmg', name: 'CodeDrobe.dmg', url: 'https://example.com/CodeDrobe.dmg', sizeBytes: 10, sha256: null }],
      'darwin',
      'arm64',
    )).toBeNull();
  });

  it('从发布服务检测匹配当前平台的新版本', async () => {
    const releaseFetcher = (async () => Response.json({
      data: {
        version: '1.1.0',
        tag: 'v1.1.0',
        releaseUrl: 'https://github.com/CodeDrobe/desktop/releases/tag/v1.1.0',
        publishedAt: '2026-07-17T00:00:00Z',
        assets,
      },
    })) as typeof fetch;
    const service = new UpdateService('1.0.0', '/tmp/codedrobe-update-test', 'https://codedrobe.app', releaseFetcher, 'darwin', 'arm64');

    await expect(service.check()).resolves.toMatchObject({
      status: 'available',
      currentVersion: '1.0.0',
      latestVersion: '1.1.0',
      asset: { name: 'CodeDrobe.dmg' },
    });
  });
});
