// SPDX-License-Identifier: MPL-2.0

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_LOCALE, uiMessages, type AppLocale } from '../shared/i18n';
import type { BootstrapData, SystemStatus, ThemeSummary } from '../shared/types';

type BusyAction = 'launch' | 'restore' | 'import' | 'export' | 'delete' | null;
type UiCopy = (typeof uiMessages)[AppLocale];

const brandSegments = [
  { rotation: 55, color: '#f0b94b' },
  { rotation: 95, color: '#f8f7fc' },
  { rotation: 135, color: '#f8f7fc' },
  { rotation: 180, color: '#f8f7fc' },
  { rotation: 225, color: '#f8f7fc' },
  { rotation: 265, color: '#f8f7fc' },
  { rotation: 305, color: '#8174ff' },
] as const;

function BrandSymbol({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 512 512" aria-hidden="true">
      <g fill="none" strokeWidth="70" strokeLinecap="round">
        {brandSegments.map(({ rotation, color }) => (
          <path
            key={rotation}
            d="M387.68 246.79A132 132 0 0 1 387.68 265.21"
            stroke={color}
            transform={`rotate(${rotation} 256 256)`}
          />
        ))}
      </g>
    </svg>
  );
}

function Icon({ name }: { name: 'wardrobe' | 'import' | 'restore' | 'play' | 'export' | 'delete' | 'spark' | 'monitor' }) {
  const paths: Record<typeof name, ReactNode> = {
    wardrobe: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5V21H4Z"/><path d="M12 3v18M8.5 11.5h.01M15.5 11.5h.01"/></>,
    import: <><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M5 18v3h14v-3"/></>,
    restore: <><path d="M4 8v5h5"/><path d="M5.6 16a8 8 0 1 0 .4-8L4 10"/></>,
    play: <><path d="m9 7 8 5-8 5Z"/><circle cx="12" cy="12" r="10"/></>,
    export: <><path d="M12 15V3m0 0 4 4m-4-4L8 7"/><path d="M5 14v7h14v-7"/></>,
    delete: <><path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6"/></>,
    spark: <><path d="m12 2 1.4 5.1L18 9l-4.6 1.9L12 16l-1.4-5.1L6 9l4.6-1.9Z"/><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7Z"/></>,
    monitor: <><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function cleanError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/^Error invoking remote method '[^']+': Error: /, '');
}

function platformLabel(status: SystemStatus, copy: UiCopy): string {
  if (status.platform === 'darwin') return 'macOS';
  if (status.platform === 'win32') return 'Windows';
  return copy.unsupportedPlatform;
}

function ThemeCard({ theme, selected, active, onSelect, copy }: {
  theme: ThemeSummary;
  selected: boolean;
  active: boolean;
  onSelect: () => void;
  copy: UiCopy;
}) {
  return (
    <button className={`theme-card ${selected ? 'is-selected' : ''}`} onClick={onSelect} type="button">
      <div className="theme-art" style={{
        backgroundColor: theme.surface,
        backgroundImage: theme.artDataUrl ? `linear-gradient(180deg, transparent 35%, rgba(13,9,14,.88)), url("${theme.artDataUrl}")` : undefined,
      }}>
        <div className="theme-badges">
          <span>{copy.imported}</span>
          {active && <span className="active-badge">{copy.active}</span>}
        </div>
        <div className="theme-card-copy">
          <strong>{theme.displayName}</strong>
          <small>v{theme.version}</small>
        </div>
      </div>
      <div className="theme-card-footer">
        <span>{theme.tagline}</span>
        <div className="mini-swatches" aria-hidden="true">
          <i style={{ background: theme.accent }} />
          <i style={{ background: theme.ink }} />
          <i style={{ background: theme.surface }} />
        </div>
      </div>
    </button>
  );
}

export function App() {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [locale, setLocale] = useState<AppLocale | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [restartThemeId, setRestartThemeId] = useState<string | null>(null);
  const [deleteThemeId, setDeleteThemeId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const copy = uiMessages[locale ?? DEFAULT_LOCALE];

  const load = async () => {
    const next = await window.codeDrobe.getBootstrap();
    setData(next);
    setLocale(next.locale);
    setSelectedId((current) => {
      if (current && next.themes.some((theme) => theme.id === current)) return current;
      if (next.status.activeThemeId && next.themes.some((theme) => theme.id === next.status.activeThemeId)) {
        return next.status.activeThemeId;
      }
      return next.themes[0]?.id ?? null;
    });
  };

  useEffect(() => {
    void load().catch((error) => setNotice({ tone: 'error', text: cleanError(error) }));
    const removeListener = window.codeDrobe.onRuntimeLog((line) => setLogs((current) => [...current.slice(-59), line]));
    const timer = window.setInterval(() => {
      void window.codeDrobe.refreshStatus().then((status) => setData((current) => current ? { ...current, status } : current));
    }, 5000);
    return () => { removeListener(); window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!locale) return;
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const selected = useMemo(
    () => data?.themes.find((theme) => theme.id === selectedId) ?? null,
    [data, selectedId],
  );

  const updateStatus = (status: SystemStatus) => setData((current) => current ? { ...current, status } : current);

  const changeLocale = async (nextLocale: AppLocale) => {
    if (!locale || locale === nextLocale) return;
    const previousLocale = locale;
    setLocale(nextLocale);
    setData((current) => current ? { ...current, locale: nextLocale } : current);
    try {
      await window.codeDrobe.setLocale(nextLocale);
    } catch (error) {
      setLocale(previousLocale);
      setData((current) => current ? { ...current, locale: previousLocale } : current);
      setNotice({ tone: 'error', text: `${uiMessages[previousLocale].languageSaveFailed}: ${cleanError(error)}` });
      return;
    }
    void load().catch((error) => setNotice({ tone: 'error', text: cleanError(error) }));
  };

  const launch = async (themeId: string, restartExisting = false) => {
    if (restartExisting) setRestartThemeId(null);
    setBusy('launch');
    try {
      const result = await window.codeDrobe.launchTheme({ themeId, restartExisting });
      updateStatus(result.system);
      if (result.status === 'requires-restart') setRestartThemeId(themeId);
      else {
        setRestartThemeId(null);
        setNotice({ tone: 'success', text: result.message });
      }
    } catch (error) {
      setNotice({ tone: 'error', text: cleanError(error) });
    } finally {
      setBusy(null);
    }
  };

  const restartAndApply = () => {
    if (!restartThemeId) return;
    const themeId = restartThemeId;
    setRestartThemeId(null);
    void launch(themeId, true);
  };

  const importTheme = async () => {
    setBusy('import');
    try {
      const result = await window.codeDrobe.importTheme();
      if (!result.canceled && result.theme) {
        await load();
        setSelectedId(result.theme.id);
        setNotice({ tone: 'success', text: copy.importedTheme(result.theme.displayName) });
      }
    } catch (error) { setNotice({ tone: 'error', text: cleanError(error) }); }
    finally { setBusy(null); }
  };

  const exportTheme = async () => {
    if (!selected) return;
    setBusy('export');
    try {
      const result = await window.codeDrobe.exportTheme(selected.id);
      if (!result.canceled && result.path) {
        setNotice({ tone: 'success', text: copy.packageExported });
        await window.codeDrobe.showInFolder(result.path);
      }
    } catch (error) { setNotice({ tone: 'error', text: cleanError(error) }); }
    finally { setBusy(null); }
  };

  const deleteTheme = async () => {
    if (!deleteThemeId) return;
    const themeId = deleteThemeId;
    const themeName = data?.themes.find((theme) => theme.id === themeId)?.displayName ?? themeId;
    setDeleteThemeId(null);
    setBusy('delete');
    try {
      const result = await window.codeDrobe.deleteTheme(themeId);
      setData((current) => current ? { ...current, themes: result.themes, status: result.status } : current);
      setSelectedId((current) => {
        if (current !== themeId && result.themes.some((theme) => theme.id === current)) return current;
        return result.status.activeThemeId ?? result.themes[0]?.id ?? null;
      });
      setNotice({ tone: 'success', text: copy.themeDeleted(themeName) });
    } catch (error) {
      setNotice({ tone: 'error', text: cleanError(error) });
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    setBusy('restore');
    try {
      updateStatus(await window.codeDrobe.restore({ restoreBaseTheme: true }));
      setNotice({ tone: 'success', text: copy.nativeRestored });
    } catch (error) { setNotice({ tone: 'error', text: cleanError(error) }); }
    finally { setBusy(null); }
  };

  if (!data || !locale) {
    return <div className="loading-screen"><span className="loading-mark"><BrandSymbol /></span><p>CodeDrobe</p></div>;
  }

  const { status } = data;
  const statusText = !status.codexInstalled ? copy.notDetected : status.injectorRunning ? copy.skinRunning : status.codexRunning ? copy.codexOpen : copy.ready;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="drag-strip" />
        <div className="brand">
          <div className="brand-mark"><BrandSymbol className="brand-mark-symbol" /></div>
          <div><strong>CodeDrobe</strong><small>THEME ATELIER</small></div>
        </div>

        <div className="language-switch" role="group" aria-label={copy.languageLabel}>
          <button className={locale === 'zh-CN' ? 'is-active' : ''} type="button" aria-pressed={locale === 'zh-CN'} onClick={() => void changeLocale('zh-CN')}>{copy.chinese}</button>
          <button className={locale === 'en' ? 'is-active' : ''} type="button" aria-pressed={locale === 'en'} onClick={() => void changeLocale('en')}>{copy.english}</button>
        </div>

        <nav>
          <button className="nav-item is-active" type="button"><Icon name="wardrobe"/><span>{copy.wardrobe}</span><b>{data.themes.length}</b></button>
          <button className="nav-item" type="button" onClick={() => void importTheme()} disabled={busy !== null}><Icon name="import"/><span>{copy.importTheme}</span></button>
          <button className="nav-item" type="button" onClick={() => void restore()} disabled={busy !== null || !status.activeThemeId}><Icon name="restore"/><span>{copy.restoreNative}</span></button>
        </nav>

        <div className="sidebar-note">
          <span className="stitch-line" />
          <p>{copy.privacyNote}</p>
        </div>

        <button className="system-card" type="button" onClick={() => setShowLogs((value) => !value)}>
          <span className={`status-orb ${status.injectorRunning ? 'is-live' : ''}`}><i /></span>
          <span><strong>{statusText}</strong><small>{copy.platformPort(platformLabel(status, copy), status.port)}</small></span>
          <Icon name="monitor" />
        </button>
      </aside>

      <main className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow"><Icon name="spark"/> {copy.eyebrow}</p>
            <h1>{copy.heroTitle}</h1>
            <p className="subtitle">{copy.heroSubtitle}</p>
          </div>
          <button className="import-button" type="button" onClick={() => void importTheme()} disabled={busy !== null}>
            <Icon name="import"/>{busy === 'import' ? copy.importing : copy.importPackage}
          </button>
        </header>

        <section className="content-grid">
          <div className="wardrobe">
            <div className="section-heading"><div><span>01</span><h2>{copy.themeSeries}</h2></div><small>{copy.availableThemes(data.themes.length)}</small></div>
            <div className="theme-grid">
              {data.themes.length === 0 && <div className="empty-wardrobe">
                <Icon name="import"/>
                <strong>{copy.emptyWardrobeTitle}</strong>
                <p>{copy.emptyWardrobeDescription}</p>
                <button type="button" onClick={() => void importTheme()} disabled={busy !== null}>{copy.importPackage}</button>
              </div>}
              {data.themes.map((theme, index) => (
                <div className="reveal" style={{ animationDelay: `${index * 80}ms` }} key={theme.id}>
                  <ThemeCard theme={theme} selected={theme.id === selectedId} active={theme.id === status.activeThemeId} onSelect={() => setSelectedId(theme.id)} copy={copy} />
                </div>
              ))}
            </div>
          </div>

          <aside className="fitting-room">
            {selected ? <>
              <div className="fitting-label"><span>{copy.fittingRoom}</span><small>{copy.selectedTheme}</small></div>
              <div className="large-preview" style={{
                backgroundColor: selected.surface,
                backgroundImage: selected.artDataUrl ? `linear-gradient(180deg, transparent 25%, rgba(15,10,14,.86)), url("${selected.artDataUrl}")` : undefined,
              }}>
                <div className="preview-window-dots"><i/><i/><i/></div>
                <div><small>{copy.importedEdition}</small><strong>{selected.displayName}</strong><p>{selected.tagline}</p></div>
              </div>
              <div className="palette-row">
                <span>{copy.themeColors}</span>
                <div><i style={{ background: selected.accent }}/><i style={{ background: selected.ink }}/><i style={{ background: selected.surface }}/></div>
                <small>v{selected.version}</small>
              </div>
              <div className="fitting-actions">
                <button className="launch-button" type="button" onClick={() => void launch(selected.id)} disabled={busy !== null || !status.codexInstalled}>
                  <Icon name="play"/>
                  <span><strong>{busy === 'launch' ? copy.applying : copy.applyAndLaunch}</strong><small>{status.codexRunning ? copy.restartIfNeeded : copy.openCodex}</small></span>
                </button>
                <button className="export-button" type="button" onClick={() => void exportTheme()} disabled={busy !== null}><Icon name="export"/>{copy.exportTheme}</button>
                {selected.source === 'imported' && <button className="delete-button" type="button" onClick={() => setDeleteThemeId(selected.id)} disabled={busy !== null}><Icon name="delete"/>{copy.deleteTheme}</button>}
              </div>
            </> : <div className="empty-fitting">{copy.chooseTheme}</div>}
          </aside>
        </section>

        {showLogs && <section className="log-drawer">
          <header><span>{copy.runtimeLog}</span><button type="button" onClick={() => setShowLogs(false)}>{copy.close}</button></header>
          <pre>{logs.length ? logs.join('\n') : copy.noLogs}</pre>
        </section>}
      </main>

      {restartThemeId && <div className="modal-backdrop">
        <div className="confirm-modal">
          <span className="modal-icon"><Icon name="restore"/></span>
          <p className="eyebrow">{copy.restartEyebrow}</p>
          <h2>{copy.restartTitle}</h2>
          <p>{copy.restartDescription}</p>
          <div><button type="button" onClick={() => setRestartThemeId(null)}>{copy.restartLater}</button><button className="confirm" type="button" onClick={restartAndApply}>{copy.restartAndApply}</button></div>
        </div>
      </div>}

      {deleteThemeId && <div className="modal-backdrop">
        <div className="confirm-modal delete-modal">
          <span className="modal-icon"><Icon name="delete"/></span>
          <p className="eyebrow">{copy.deleteEyebrow}</p>
          <h2>{copy.deleteTitle}</h2>
          <p>{copy.deleteDescription(data.themes.find((theme) => theme.id === deleteThemeId)?.displayName ?? deleteThemeId)}</p>
          <div><button type="button" onClick={() => setDeleteThemeId(null)}>{copy.cancel}</button><button className="confirm danger" type="button" onClick={() => void deleteTheme()}>{copy.confirmDelete}</button></div>
        </div>
      </div>}

      {notice && <div className={`toast ${notice.tone}`}><i />{notice.text}</div>}
    </div>
  );
}
