// SPDX-License-Identifier: MPL-2.0

import { describe, expect, it } from 'vitest';
import type { MarketplaceTheme, ThemeSummary } from '../shared/types';
import { filterLocalThemes, filterMarketplaceThemes } from './theme-search';

const storeThemes = [
  {
    id: 'theme_matcha', slug: 'matcha-paper', version: '1.1.0',
    name: { en: 'Matcha Paper', zh: '抹茶纸页' },
    description: { en: 'A calm handmade paper workspace.', zh: '安静的日式手工纸工作台。' },
    categories: [{ slug: 'light', name: { en: 'Light', zh: '浅色' }, primary: true }],
  },
  {
    id: 'theme_ocean', slug: 'deep-ocean', version: '1.0.0',
    name: { en: 'Deep Ocean', zh: '深海' },
    description: { en: 'A focused blue workspace.', zh: '专注的蓝色工作台。' },
    categories: [{ slug: 'dark', name: { en: 'Dark', zh: '深色' }, primary: true }],
  },
] as MarketplaceTheme[];

const localThemes = [
  { id: 'matcha-paper', displayName: '抹茶纸页', version: '1.1.0', tagline: 'Tea-room calm', source: 'imported' },
  { id: 'deep-ocean', displayName: 'Deep Ocean', version: '1.0.0', tagline: 'Focus below the surface', source: 'builtin' },
] as ThemeSummary[];

describe('theme search', () => {
  it('同时匹配在线主题的中英文名称、描述和分类', () => {
    expect(filterMarketplaceThemes(storeThemes, 'all', '抹茶')).toHaveLength(1);
    expect(filterMarketplaceThemes(storeThemes, 'all', 'handmade paper')[0]?.slug).toBe('matcha-paper');
    expect(filterMarketplaceThemes(storeThemes, 'dark', 'blue')[0]?.slug).toBe('deep-ocean');
    expect(filterMarketplaceThemes(storeThemes, 'light', 'ocean')).toEqual([]);
  });

  it('搜索本地主题名称、标语、ID 和版本', () => {
    expect(filterLocalThemes(localThemes, 'tea calm')[0]?.id).toBe('matcha-paper');
    expect(filterLocalThemes(localThemes, 'deep-ocean 1.0.0')[0]?.id).toBe('deep-ocean');
    expect(filterLocalThemes(localThemes, '不存在')).toEqual([]);
  });
});
