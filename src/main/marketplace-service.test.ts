// SPDX-License-Identifier: MPL-2.0

import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MarketplaceTheme, ThemePackage } from '../shared/types';
import { MarketplaceService, normalizeMarketplaceUrl } from './marketplace-service';
import { ThemeRepository } from './theme-repository';

let root = '';

beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'codedrobe-market-')); });
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });

function fixture() {
  const bundle: ThemePackage = {
    format: 'codex-theme', schemaVersion: 1, exportedAt: new Date().toISOString(),
    manifest: { schemaVersion: 1, id: 'graphite-pro', displayName: 'Graphite Pro', version: '1.0.0', css: 'theme.css', art: null },
    css: ':root { --accent: #d4a85f; }',
  };
  const bytes = Buffer.from(JSON.stringify(bundle));
  const theme: MarketplaceTheme = {
    id: 'theme_graphite_pro', slug: 'graphite-pro', name: { en: 'Graphite Pro', zh: '石墨专业版' },
    description: { en: 'Focused.', zh: '专注。' }, version: '1.0.0', categories: [],
    previewUrl: '/api/v1/themes/graphite-pro/preview', downloadUrl: '/api/v1/themes/graphite-pro/download',
    price: { currency: 'usd', unitAmount: 0, free: true },
    package: { sizeBytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') },
    publishedAt: new Date().toISOString(),
  };
  return { bytes, theme };
}

function fetcher(theme: MarketplaceTheme, bytes: Buffer): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.pathname === '/api/v1/themes/graphite-pro') return Response.json({ data: theme });
    if (url.pathname === '/api/v1/themes/graphite-pro/download') return new Response(new Uint8Array(bytes), { headers: { 'content-length': String(bytes.length) } });
    throw new Error(`Unexpected URL: ${url.toString()}`);
  }) as typeof fetch;
}

describe('MarketplaceService', () => {
  it('只接受主题商店同源链接', () => {
    expect(normalizeMarketplaceUrl('/api/v1/themes')).toBe('https://codedrobe.app/api/v1/themes');
    expect(() => normalizeMarketplaceUrl('https://tracker.example/theme')).toThrow('untrusted');
  });

  it('下载、校验并导入免费主题', async () => {
    const { bytes, theme } = fixture();
    const repository = new ThemeRepository(path.join(root, 'themes'));
    await repository.initialize();
    const service = new MarketplaceService(repository, 'https://codedrobe.app', fetcher(theme, bytes));

    const result = await service.install('graphite-pro');

    expect(result.theme).toMatchObject({ id: 'graphite-pro', source: 'imported' });
    expect(result.themes).toHaveLength(1);
  });

  it('SHA-256 不匹配时拒绝导入', async () => {
    const { bytes, theme } = fixture();
    theme.package.sha256 = '0'.repeat(64);
    const repository = new ThemeRepository(path.join(root, 'themes'));
    await repository.initialize();
    const service = new MarketplaceService(repository, 'https://codedrobe.app', fetcher(theme, bytes));

    await expect(service.install('graphite-pro')).rejects.toThrow('SHA-256');
    await expect(repository.summaries()).resolves.toEqual([]);
  });

  it('刷新商店时绕过缓存并返回最新目录', async () => {
    const { bytes, theme } = fixture();
    const repository = new ThemeRepository(path.join(root, 'themes'));
    await repository.initialize();
    const requests: Array<{ url: URL; headers: Headers }> = [];
    const catalogFetcher = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      requests.push({ url, headers: new Headers(init?.headers) });
      if (url.pathname === '/api/v1/categories') return Response.json({ data: [] });
      if (url.pathname === '/api/v1/themes') return Response.json({ data: [theme] });
      throw new Error(`Unexpected URL: ${url.toString()}`);
    }) as typeof fetch;
    const service = new MarketplaceService(repository, 'https://codedrobe.app', catalogFetcher);

    await expect(service.list()).resolves.toMatchObject({ themes: [{ slug: 'graphite-pro' }] });
    expect(requests).toHaveLength(2);
    for (const request of requests) {
      expect(request.url.searchParams.get('_refresh')).toMatch(/^\d+$/);
      expect(request.headers.get('cache-control')).toBe('no-cache');
    }
  });
});
