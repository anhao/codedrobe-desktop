// SPDX-License-Identifier: MPL-2.0

import type { AppLocale } from '../../shared/i18n';
import type { MarketplaceData, MarketplaceTheme, SystemStatus, ThemeSummary } from '../../shared/types';
import type { UiCopy, View } from '../ui-types';
import { localized } from '../utils';
import { Icon } from './Icon';
import { LocalThemeCard, StoreThemeCard } from './ThemeCards';
import { ThemeSearch } from './ThemeSearch';

export function ThemeCollection({ view, locale, copy, marketplace, marketplaceLoading, marketplaceError, marketplaceCheckedAt, category, searchQuery, visibleStoreThemes, localThemes, visibleLocalThemes, selectedSlug, selectedId, installedVersions, updateThemeIds, status, onCategory, onSearch, onSelectStore, onSelectLocal, onRefresh, onBrowseStore }: {
  view: View; locale: AppLocale; copy: UiCopy; marketplace: MarketplaceData | null; marketplaceLoading: boolean; marketplaceError: string | null;
  marketplaceCheckedAt: string | null; category: string; searchQuery: string; visibleStoreThemes: MarketplaceTheme[]; localThemes: ThemeSummary[]; visibleLocalThemes: ThemeSummary[]; selectedSlug: string | null; selectedId: string | null;
  installedVersions: Map<string, string>; updateThemeIds: Set<string>; status: SystemStatus;
  onCategory: (category: string) => void; onSearch: (query: string) => void; onSelectStore: (slug: string) => void; onSelectLocal: (id: string) => void; onRefresh: () => void; onBrowseStore: () => void;
}) {
  const showStore = view === 'store';
  const resetFilters = () => { onSearch(''); onCategory('all'); };
  return <div className="wardrobe">
    <div className="collection-toolbar">
      {showStore && <div className="category-row"><button className={category === 'all' ? 'is-active' : ''} onClick={() => onCategory('all')}>{copy.allThemes}</button>{marketplace?.categories.filter((item) => item.themeCount > 0).map((item) => <button key={item.slug} className={category === item.slug ? 'is-active' : ''} onClick={() => onCategory(item.slug)}>{localized(item.name, locale)}</button>)}</div>}
      <ThemeSearch value={searchQuery} copy={copy} onChange={onSearch}/>
    </div>
    <div className="section-heading">
      <div><span>01</span><h2>{showStore ? copy.onlineCollection : copy.installedCollection}</h2></div>
      <div className="collection-status">
        {showStore && updateThemeIds.size > 0 && <b>{copy.themeUpdatesAvailable(updateThemeIds.size)}</b>}
        <small>{showStore ? marketplaceCheckedAt ? copy.storeRefreshedAt(marketplaceCheckedAt) : copy.onlineThemes(visibleStoreThemes.length) : copy.availableThemes(visibleLocalThemes.length)}</small>
        {showStore && <button className="store-refresh" type="button" onClick={onRefresh} disabled={marketplaceLoading} aria-label={copy.refreshStore} title={copy.refreshStore}><Icon name="refresh"/></button>}
      </div>
    </div>
    <div className="theme-grid">
      {showStore && marketplaceLoading && <div className="market-state"><span className="spinner"/><strong>{copy.loadingStore}</strong><p>{copy.loadingStoreDescription}</p></div>}
      {showStore && marketplaceError && <div className="market-state error-state"><Icon name="refresh"/><strong>{copy.storeUnavailable}</strong><p>{marketplaceError}</p><button onClick={onRefresh}>{copy.retry}</button></div>}
      {showStore && !marketplaceLoading && !marketplaceError && visibleStoreThemes.map((theme, index) => <div className="reveal" style={{ animationDelay: `${index * 70}ms` }} key={theme.slug}><StoreThemeCard theme={theme} selected={theme.slug === selectedSlug} installedVersion={installedVersions.get(theme.slug) ?? null} updateAvailable={updateThemeIds.has(theme.slug)} active={theme.slug === status.activeThemeId} locale={locale} onSelect={() => onSelectStore(theme.slug)} copy={copy}/></div>)}
      {showStore && !marketplaceLoading && !marketplaceError && visibleStoreThemes.length === 0 && <div className="market-state search-empty"><Icon name="search"/><strong>{copy.noSearchResults}</strong><p>{copy.noSearchResultsDescription(searchQuery)}</p><button onClick={resetFilters}>{copy.clearFilters}</button></div>}
      {!showStore && localThemes.length === 0 && <div className="market-state"><Icon name="wardrobe"/><strong>{copy.emptyWardrobeTitle}</strong><p>{copy.emptyWardrobeDescription}</p><button onClick={onBrowseStore}>{copy.browseStore}</button></div>}
      {!showStore && localThemes.length > 0 && visibleLocalThemes.length === 0 && <div className="market-state search-empty"><Icon name="search"/><strong>{copy.noSearchResults}</strong><p>{copy.noSearchResultsDescription(searchQuery)}</p><button onClick={() => onSearch('')}>{copy.clearSearch}</button></div>}
      {!showStore && visibleLocalThemes.map((theme, index) => <div className="reveal" style={{ animationDelay: `${index * 70}ms` }} key={theme.id}><LocalThemeCard theme={theme} selected={theme.id === selectedId} active={theme.id === status.activeThemeId} onSelect={() => onSelectLocal(theme.id)} copy={copy}/></div>)}
    </div>
  </div>;
}
