// SPDX-License-Identifier: MPL-2.0

import { AppDialogs } from './components/AppDialogs';
import { BrandSymbol } from './components/BrandSymbol';
import { FittingRoom } from './components/FittingRoom';
import { Icon } from './components/Icon';
import { Sidebar } from './components/Sidebar';
import { ThemeCollection } from './components/ThemeCollection';
import { useAppController } from './hooks/useAppController';

export function App() {
  const state = useAppController();
  const { data, marketplace, marketplaceError, marketplaceLoading, marketplaceCheckedAt, locale, view, category, searchQuery, selectedId, selectedSlug, selected, selectedStore, visibleStoreThemes, visibleLocalThemes, installedVersions, updateThemeIds, busy, restartThemeId, deleteThemeId, notice, logs, showLogs, update, updateChecking, updateProgress, copy, actions } = state;

  if (!data || !locale) return <div className="loading-screen"><span className="loading-mark"><BrandSymbol/></span><p>CodeDrobe</p></div>;

  return <div className="app-shell">
    <Sidebar
      locale={locale} view={view} copy={copy} status={data.status} themeCount={data.themes.length}
      storeCount={marketplace?.themes.length ?? null} appVersion={data.appVersion} update={update} updateChecking={updateChecking}
      updateProgress={updateProgress} busy={busy} onLocale={(next) => void actions.changeLocale(next)}
      onView={actions.setView} onImport={() => void actions.importTheme()} onRestore={() => void actions.restore()}
      onUpdate={() => void actions.handleUpdate()} onToggleLogs={() => actions.setShowLogs(!showLogs)}
    />

    <main className="workspace">
      <header className="workspace-header">
        <div><p className="eyebrow"><Icon name="spark"/> {view === 'store' ? copy.storeEyebrow : copy.eyebrow}</p><h1>{view === 'store' ? copy.storeTitle : copy.heroTitle}</h1><p className="subtitle">{view === 'store' ? copy.storeSubtitle : copy.heroSubtitle}</p></div>
        <button className="import-button" type="button" onClick={() => void actions.importTheme()} disabled={busy !== null}><Icon name="import"/>{busy === 'import' ? copy.importing : copy.importPackage}</button>
      </header>

      <section className="content-grid">
        <ThemeCollection
          view={view} locale={locale} copy={copy} marketplace={marketplace} marketplaceLoading={marketplaceLoading}
          marketplaceError={marketplaceError} marketplaceCheckedAt={marketplaceCheckedAt} category={category} searchQuery={searchQuery} visibleStoreThemes={visibleStoreThemes}
          localThemes={data.themes} visibleLocalThemes={visibleLocalThemes} selectedSlug={selectedSlug} selectedId={selectedId} installedVersions={installedVersions} updateThemeIds={updateThemeIds}
          status={data.status} onCategory={actions.setCategory} onSelectStore={actions.setSelectedSlug}
          onSearch={actions.setSearchQuery} onSelectLocal={actions.setSelectedId} onRefresh={() => void actions.loadMarketplace(true)} onBrowseStore={() => actions.setView('store')}
        />
        <FittingRoom
          view={view} locale={locale} copy={copy} storeTheme={selectedStore} localTheme={selected}
          installedVersion={selectedStore ? installedVersions.get(selectedStore.slug) ?? null : null} updateAvailable={Boolean(selectedStore && updateThemeIds.has(selectedStore.slug))} status={data.status} busy={busy}
          onInstall={(theme) => void actions.installAndApply(theme)} onLaunch={(id) => void actions.launch(id)}
          onExport={() => void actions.exportTheme()} onDelete={actions.setDeleteThemeId}
        />
      </section>

      {showLogs && <section className="log-drawer"><header><span>{copy.runtimeLog}</span><button onClick={() => actions.setShowLogs(false)}>{copy.close}</button></header><pre>{logs.length ? logs.join('\n') : copy.noLogs}</pre></section>}
    </main>

    <AppDialogs
      restartThemeId={restartThemeId} deleteThemeId={deleteThemeId} themes={data.themes} copy={copy}
      onCancelRestart={() => actions.setRestartThemeId(null)} onRestart={(id) => { actions.setRestartThemeId(null); void actions.launch(id, true); }}
      onCancelDelete={() => actions.setDeleteThemeId(null)} onDelete={() => void actions.deleteTheme()}
    />
    {notice && <div className={`toast ${notice.tone}`}><i/>{notice.text}</div>}
  </div>;
}
