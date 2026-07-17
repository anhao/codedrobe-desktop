// SPDX-License-Identifier: MPL-2.0

import { describe, expect, it } from 'vitest';
import { MarketplaceService } from './marketplace-service';
import type { ThemeLibrary } from './theme-library';

const BASE = 'https://codedrobe.test';

function theme(overrides: Record<string, unknown> = {}) {
  return {
    id: 'theme_1',
    slug: 'dream',
    name: { en: 'Dream', zh: '梦境' },
    description: { en: null, zh: null },
    version: '1.0.0',
    categories: [{ slug: 'minimal', name: { en: 'Minimal', zh: '极简' }, primary: true }],
    previewUrl: null,
    coverUrl: '/api/v1/themes/dream/cover',
    downloadUrl: '/api/v1/themes/dream/download',
    price: { currency: 'usd', unitAmount: 0, free: true },
    package: { sizeBytes: 1024, sha256: 'a'.repeat(64) },
    publishedAt: '2026-07-17T00:00:00Z',
    supportedApps: ['codex'],
    author: {
      handle: 'anhao',
      displayName: 'AnHao',
      // External https avatars (GitHub) must pass through, not fail the listing.
      avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
    },
    likeCount: 3,
    downloadCount: 9,
    ...overrides,
  };
}

function service(themes: unknown[]) {
  const fetcher = (async (input: URL | RequestInfo) => {
    const url = String(input);
    if (url.includes('/api/v1/themes')) {
      return Response.json({ data: themes, meta: { total: themes.length, nextCursor: null } });
    }
    return Response.json({ data: [] });
  }) as typeof fetch;
  return new MarketplaceService(null as unknown as ThemeLibrary, BASE, fetcher);
}

describe('marketplace URL policy', () => {
  it('resolves same-origin display URLs and passes external https avatars through', async () => {
    const page = await service([theme()]).list();
    expect(page.themes).toHaveLength(1);
    const item = page.themes[0];
    expect(item.coverUrl).toBe(`${BASE}/api/v1/themes/dream/cover`);
    expect(item.downloadUrl).toBe(`${BASE}/api/v1/themes/dream/download`);
    expect(item.author?.avatarUrl).toBe('https://avatars.githubusercontent.com/u/1?v=4');
  });

  it('drops non-https external display URLs instead of failing', async () => {
    const page = await service([
      theme({ author: { handle: 'x', displayName: 'X', avatarUrl: 'http://evil.example/a.png' } }),
    ]).list();
    expect(page.themes[0].author?.avatarUrl).toBeNull();
  });

  it('still rejects cross-origin download URLs', async () => {
    await expect(
      service([theme({ downloadUrl: 'https://evil.example/steal.codedrobe-theme' })]).list(),
    ).rejects.toThrow(/untrusted/i);
  });
});
