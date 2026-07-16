// SPDX-License-Identifier: MPL-2.0

import type { AppLocale } from '../../shared/i18n';
import type { MarketplaceTheme, ThemeSummary } from '../../shared/types';
import type { UiCopy } from '../ui-types';
import { localized } from '../utils';

export function LocalThemeCard({ theme, selected, active, onSelect, copy }: {
  theme: ThemeSummary; selected: boolean; active: boolean; onSelect: () => void; copy: UiCopy;
}) {
  return <button className={`theme-card ${selected ? 'is-selected' : ''}`} onClick={onSelect} type="button">
    <div className="theme-art" style={{ backgroundColor: theme.surface, backgroundImage: theme.artDataUrl ? `linear-gradient(180deg, transparent 35%, rgba(13,9,14,.88)), url("${theme.artDataUrl}")` : undefined }}>
      <div className="theme-badges"><span>{copy.installed}</span>{active && <span className="active-badge">{copy.active}</span>}</div>
      <div className="theme-card-copy"><strong>{theme.displayName}</strong><small>v{theme.version}</small></div>
    </div>
    <div className="theme-card-footer"><span>{theme.tagline}</span><div className="mini-swatches" aria-hidden="true"><i style={{ background: theme.accent }}/><i style={{ background: theme.ink }}/><i style={{ background: theme.surface }}/></div></div>
  </button>;
}

export function StoreThemeCard({ theme, selected, installedVersion, updateAvailable, active, locale, onSelect, copy }: {
  theme: MarketplaceTheme; selected: boolean; installedVersion: string | null; updateAvailable: boolean; active: boolean; locale: AppLocale; onSelect: () => void; copy: UiCopy;
}) {
  const primary = theme.categories.find((category) => category.primary) ?? theme.categories[0];
  return <button className={`theme-card store-theme-card ${selected ? 'is-selected' : ''}`} onClick={onSelect} type="button">
    <div className="theme-art" style={{ backgroundImage: `linear-gradient(180deg, transparent 34%, rgba(13,9,14,.9)), url("${theme.previewUrl}")` }}>
      <div className="theme-badges"><span>{theme.price.free ? copy.free : copy.paid}</span>{updateAvailable ? <span className="update-badge">{copy.themeUpdate}</span> : installedVersion && <span className={active ? 'active-badge' : 'installed-badge'}>{active ? copy.active : copy.installed}</span>}</div>
      <div className="theme-card-copy"><strong>{localized(theme.name, locale)}</strong><small>{primary ? localized(primary.name, locale) : copy.theme}</small></div>
    </div>
    <div className="theme-card-footer"><span>{localized(theme.description, locale)}</span><small>v{theme.version}</small></div>
  </button>;
}
