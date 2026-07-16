// SPDX-License-Identifier: MPL-2.0

import type { AppLocale } from '../../shared/i18n';
import type { SystemStatus, UpdateInfo } from '../../shared/types';
import type { BusyAction, UiCopy, View } from '../ui-types';
import { platformLabel } from '../utils';
import { BrandSymbol } from './BrandSymbol';
import { Icon } from './Icon';
import { UpdateCard } from './UpdateCard';

export function Sidebar({ locale, view, copy, status, themeCount, storeCount, appVersion, update, updateChecking, updateProgress, busy, onLocale, onView, onImport, onRestore, onUpdate, onToggleLogs }: {
  locale: AppLocale; view: View; copy: UiCopy; status: SystemStatus; themeCount: number; storeCount: number | null; appVersion: string;
  update: UpdateInfo | null; updateChecking: boolean; updateProgress: number; busy: BusyAction;
  onLocale: (locale: AppLocale) => void; onView: (view: View) => void; onImport: () => void; onRestore: () => void; onUpdate: () => void; onToggleLogs: () => void;
}) {
  const statusText = !status.codexInstalled ? copy.notDetected : status.injectorRunning ? copy.skinRunning : status.codexRunning ? copy.codexOpen : copy.ready;
  return <aside className="sidebar">
    <div className="drag-strip"/>
    <div className="brand"><div className="brand-mark"><BrandSymbol className="brand-mark-symbol"/></div><div><strong>CodeDrobe</strong><small>THEME ATELIER</small></div></div>
    <div className="language-switch" role="group" aria-label={copy.languageLabel}><button className={locale === 'zh-CN' ? 'is-active' : ''} onClick={() => onLocale('zh-CN')}>中文</button><button className={locale === 'en' ? 'is-active' : ''} onClick={() => onLocale('en')}>EN</button></div>
    <nav>
      <button className={`nav-item ${view === 'store' ? 'is-active' : ''}`} type="button" onClick={() => onView('store')}><Icon name="store"/><span>{copy.onlineStore}</span><b>{storeCount ?? '—'}</b></button>
      <button className={`nav-item ${view === 'installed' ? 'is-active' : ''}`} type="button" onClick={() => onView('installed')}><Icon name="wardrobe"/><span>{copy.installedThemes}</span><b>{themeCount}</b></button>
      <button className="nav-item" type="button" onClick={onImport} disabled={busy !== null}><Icon name="import"/><span>{copy.importTheme}</span></button>
      <button className="nav-item" type="button" onClick={onRestore} disabled={busy !== null || !status.activeThemeId}><Icon name="restore"/><span>{copy.restoreNative}</span></button>
    </nav>
    <div className="sidebar-note"><span className="stitch-line"/><p>{copy.privacyNote}</p></div>
    <UpdateCard appVersion={appVersion} update={update} checking={updateChecking} downloading={busy === 'update'} progress={updateProgress} copy={copy} onAction={onUpdate}/>
    <button className="system-card" type="button" onClick={onToggleLogs}><span className={`status-orb ${status.injectorRunning ? 'is-live' : ''}`}><i/></span><span><strong>{statusText}</strong><small>{copy.platformPort(platformLabel(status, copy), status.port)}</small></span><Icon name="monitor"/></button>
  </aside>;
}
