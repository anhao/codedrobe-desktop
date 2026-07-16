// SPDX-License-Identifier: MPL-2.0

import type { AppLocale } from '../../shared/i18n';
import type { MarketplaceTheme, SystemStatus, ThemeSummary } from '../../shared/types';
import type { BusyAction, UiCopy, View } from '../ui-types';
import { localized } from '../utils';
import { Icon } from './Icon';

export function FittingRoom({ view, locale, copy, storeTheme, localTheme, installedVersion, updateAvailable, status, busy, onInstall, onLaunch, onExport, onDelete }: {
  view: View; locale: AppLocale; copy: UiCopy; storeTheme: MarketplaceTheme | null; localTheme: ThemeSummary | null; installedVersion: string | null; updateAvailable: boolean; status: SystemStatus; busy: BusyAction;
  onInstall: (theme: MarketplaceTheme) => void; onLaunch: (id: string) => void; onExport: () => void; onDelete: (id: string) => void;
}) {
  if (view === 'store' && storeTheme) return <aside className="fitting-room">
    <div className="fitting-label"><span>{copy.storePreview}</span><small>{storeTheme.price.free ? copy.freeTheme : copy.paidTheme}</small></div>
    <div className="large-preview" style={{ backgroundImage: `linear-gradient(180deg, transparent 24%, rgba(15,10,14,.88)), url("${storeTheme.previewUrl}")` }}><div className="preview-window-dots"><i/><i/><i/></div><div><small>{storeTheme.categories.map((item) => localized(item.name, locale)).join(' · ')}</small><strong>{localized(storeTheme.name, locale)}</strong><p>{localized(storeTheme.description, locale)}</p></div></div>
    <div className="market-meta"><span>{copy.integrityVerified}</span><small>SHA-256 · {(storeTheme.package.sizeBytes / 1024).toFixed(1)} KB</small></div>
    <div className="fitting-actions store-actions"><button className="launch-button" type="button" onClick={() => onInstall(storeTheme)} disabled={busy !== null || !status.codexInstalled}><Icon name={installedVersion && !updateAvailable ? 'play' : 'download'}/><span><strong>{busy === 'install' ? copy.downloadingTheme : updateAvailable ? copy.updateAndApply : installedVersion ? copy.applyAndLaunch : copy.downloadAndApply}</strong><small>{updateAvailable && installedVersion ? copy.themeVersionUpgrade(installedVersion, storeTheme.version) : storeTheme.price.free ? copy.freeDirectInstall : copy.purchaseRequired}</small></span></button></div>
  </aside>;

  if (view === 'installed' && localTheme) return <aside className="fitting-room">
    <div className="fitting-label"><span>{copy.fittingRoom}</span><small>{copy.selectedTheme}</small></div>
    <div className="large-preview" style={{ backgroundColor: localTheme.surface, backgroundImage: localTheme.artDataUrl ? `linear-gradient(180deg, transparent 25%, rgba(15,10,14,.86)), url("${localTheme.artDataUrl}")` : undefined }}><div className="preview-window-dots"><i/><i/><i/></div><div><small>{copy.installedEdition}</small><strong>{localTheme.displayName}</strong><p>{localTheme.tagline}</p></div></div>
    <div className="palette-row"><span>{copy.themeColors}</span><div><i style={{ background: localTheme.accent }}/><i style={{ background: localTheme.ink }}/><i style={{ background: localTheme.surface }}/></div><small>v{localTheme.version}</small></div>
    <div className="fitting-actions"><button className="launch-button" type="button" onClick={() => onLaunch(localTheme.id)} disabled={busy !== null || !status.codexInstalled}><Icon name="play"/><span><strong>{busy === 'launch' ? copy.applying : copy.applyAndLaunch}</strong><small>{status.codexRunning ? copy.restartIfNeeded : copy.openCodex}</small></span></button><button className="export-button" onClick={onExport} disabled={busy !== null}><Icon name="export"/>{copy.exportTheme}</button>{localTheme.source === 'imported' && <button className="delete-button" onClick={() => onDelete(localTheme.id)} disabled={busy !== null}><Icon name="delete"/>{copy.deleteTheme}</button>}</div>
  </aside>;

  return <aside className="fitting-room"><div className="empty-fitting">{view === 'store' ? copy.chooseStoreTheme : copy.chooseTheme}</div></aside>;
}
