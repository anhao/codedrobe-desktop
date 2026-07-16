// SPDX-License-Identifier: MPL-2.0

import type { MarketplaceTheme, ThemeSummary } from '../shared/types';

function normalizedTokens(query: string): string[] {
  return query.normalize('NFKC').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
}

function includesAllTokens(query: string, fields: Array<string | undefined>): boolean {
  const tokens = normalizedTokens(query);
  if (!tokens.length) return true;
  const haystack = fields.filter(Boolean).join(' ').normalize('NFKC').toLocaleLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

export function filterMarketplaceThemes(themes: MarketplaceTheme[], category: string, query: string): MarketplaceTheme[] {
  return themes.filter((theme) => {
    if (category !== 'all' && !theme.categories.some((item) => item.slug === category)) return false;
    return includesAllTokens(query, [
      theme.id,
      theme.slug,
      theme.version,
      theme.name.en,
      theme.name.zh,
      theme.description.en,
      theme.description.zh,
      ...theme.categories.flatMap((item) => [item.slug, item.name.en, item.name.zh]),
    ]);
  });
}

export function filterLocalThemes(themes: ThemeSummary[], query: string): ThemeSummary[] {
  return themes.filter((theme) => includesAllTokens(query, [
    theme.id,
    theme.displayName,
    theme.version,
    theme.tagline,
    theme.source,
  ]));
}
