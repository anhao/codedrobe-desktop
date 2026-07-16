// SPDX-License-Identifier: MPL-2.0

import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_LOCALE, uiMessages, type AppLocale } from '../../shared/i18n';
import type { BootstrapData, MarketplaceData, MarketplaceTheme, SystemStatus, UpdateInfo } from '../../shared/types';
import { compareVersions } from '../../shared/version';
import { filterLocalThemes, filterMarketplaceThemes } from '../theme-search';
import type { BusyAction, View } from '../ui-types';
import { cleanError, localized } from '../utils';

export function useAppController() {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [marketplace, setMarketplace] = useState<MarketplaceData | null>(null);
  const [marketplaceError, setMarketplaceError] = useState<string | null>(null);
  const [marketplaceLoading, setMarketplaceLoading] = useState(true);
  const [marketplaceCheckedAt, setMarketplaceCheckedAt] = useState<string | null>(null);
  const [locale, setLocale] = useState<AppLocale | null>(null);
  const [view, setView] = useState<View>('store');
  const [category, setCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [restartThemeId, setRestartThemeId] = useState<string | null>(null);
  const [deleteThemeId, setDeleteThemeId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [updateChecking, setUpdateChecking] = useState(true);
  const [updateProgress, setUpdateProgress] = useState(0);
  const copy = uiMessages[locale ?? DEFAULT_LOCALE];

  const load = async () => {
    const next = await window.codeDrobe.getBootstrap();
    setData(next); setLocale(next.locale);
    setSelectedId((current) => current && next.themes.some((theme) => theme.id === current) ? current : next.status.activeThemeId ?? next.themes[0]?.id ?? null);
  };

  const loadMarketplace = async (announce = false) => {
    setMarketplaceLoading(true); setMarketplaceError(null);
    try {
      const next = await window.codeDrobe.getMarketplace();
      setMarketplace(next);
      setMarketplaceCheckedAt(new Date().toISOString());
      setSelectedSlug((current) => current && next.themes.some((theme) => theme.slug === current) ? current : next.themes[0]?.slug ?? null);
      if (announce) {
        const updateCount = next.themes.filter((theme) => {
          const installed = data?.themes.find((item) => item.id === theme.slug);
          return installed && compareVersions(theme.version, installed.version) > 0;
        }).length;
        setNotice({ tone: 'success', text: updateCount ? copy.storeRefreshedWithUpdates(updateCount) : copy.storeRefreshed });
      }
    } catch (error) {
      const message = cleanError(error);
      setMarketplaceError(message);
      if (announce) setNotice({ tone: 'error', text: `${copy.storeUnavailable}: ${message}` });
    }
    finally { setMarketplaceLoading(false); }
  };

  const checkForAppUpdates = async (announce = false) => {
    setUpdateChecking(true);
    try {
      const next = await window.codeDrobe.checkForUpdates();
      setUpdate(next);
      if (announce) {
        if (next.status === 'available') setNotice({ tone: 'success', text: copy.updateAvailable(next.latestVersion ?? '') });
        else if (next.status === 'up-to-date') setNotice({ tone: 'success', text: copy.appAlreadyCurrent(next.currentVersion) });
        else setNotice({ tone: 'error', text: `${copy.updateCheckFailed}${next.message ? `: ${next.message}` : ''}` });
      }
      return next;
    } catch (error) {
      setNotice({ tone: 'error', text: cleanError(error) });
      return null;
    } finally { setUpdateChecking(false); }
  };

  useEffect(() => {
    void load().catch((error) => setNotice({ tone: 'error', text: cleanError(error) }));
    void loadMarketplace();
    void checkForAppUpdates();
    const removeLog = window.codeDrobe.onRuntimeLog((line) => setLogs((current) => [...current.slice(-59), line]));
    const removeProgress = window.codeDrobe.onUpdateDownloadProgress(setUpdateProgress);
    const timer = window.setInterval(() => void window.codeDrobe.refreshStatus().then((status) => setData((current) => current ? { ...current, status } : current)), 5000);
    return () => { removeLog(); removeProgress(); window.clearInterval(timer); };
  }, []);

  useEffect(() => { if (locale) document.documentElement.lang = locale; }, [locale]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(null), 4200); return () => window.clearTimeout(timer); }, [notice]);

  const selected = useMemo(() => data?.themes.find((theme) => theme.id === selectedId) ?? null, [data, selectedId]);
  const selectedStore = useMemo(() => marketplace?.themes.find((theme) => theme.slug === selectedSlug) ?? null, [marketplace, selectedSlug]);
  const visibleStoreThemes = useMemo(() => filterMarketplaceThemes(marketplace?.themes ?? [], category, searchQuery), [marketplace, category, searchQuery]);
  const visibleLocalThemes = useMemo(() => filterLocalThemes(data?.themes ?? [], searchQuery), [data, searchQuery]);
  const installedVersions = useMemo(() => new Map(data?.themes.map((theme) => [theme.id, theme.version]) ?? []), [data]);
  const updateThemeIds = useMemo(() => new Set(marketplace?.themes
    .filter((theme) => {
      const installedVersion = installedVersions.get(theme.slug);
      return installedVersion && compareVersions(theme.version, installedVersion) > 0;
    })
    .map((theme) => theme.slug) ?? []), [installedVersions, marketplace]);
  const updateStatus = (status: SystemStatus) => setData((current) => current ? { ...current, status } : current);

  const changeLocale = async (nextLocale: AppLocale) => {
    if (!locale || locale === nextLocale) return;
    const previous = locale; setLocale(nextLocale); setData((current) => current ? { ...current, locale: nextLocale } : current);
    try { await window.codeDrobe.setLocale(nextLocale); }
    catch (error) { setLocale(previous); setNotice({ tone: 'error', text: `${uiMessages[previous].languageSaveFailed}: ${cleanError(error)}` }); return; }
    void load();
  };

  const launch = async (themeId: string, restartExisting = false) => {
    if (restartExisting) setRestartThemeId(null);
    setBusy('launch');
    try {
      const result = await window.codeDrobe.launchTheme({ themeId, restartExisting }); updateStatus(result.system);
      if (result.status === 'requires-restart') setRestartThemeId(themeId);
      else { setRestartThemeId(null); setNotice({ tone: 'success', text: result.message }); }
    } catch (error) { setNotice({ tone: 'error', text: cleanError(error) }); }
    finally { setBusy(null); }
  };

  const installAndApply = async (theme: MarketplaceTheme) => {
    const existing = data?.themes.find((item) => item.id === theme.slug);
    if (existing && compareVersions(theme.version, existing.version) <= 0) { setSelectedId(existing.id); await launch(existing.id); return; }
    setBusy('install');
    try {
      const result = await window.codeDrobe.installMarketplaceTheme(theme.slug);
      setData((current) => current ? { ...current, themes: result.themes } : current); setSelectedId(result.theme.id);
      setNotice({ tone: 'success', text: existing ? copy.updatedTheme(localized(theme.name, locale ?? DEFAULT_LOCALE), theme.version) : copy.downloadedTheme(localized(theme.name, locale ?? DEFAULT_LOCALE)) }); setBusy(null);
      await launch(result.theme.id);
    } catch (error) { setNotice({ tone: 'error', text: cleanError(error) }); setBusy(null); }
  };

  const importTheme = async () => {
    setBusy('import');
    try { const result = await window.codeDrobe.importTheme(); if (!result.canceled && result.theme) { await load(); setSelectedId(result.theme.id); setView('installed'); setNotice({ tone: 'success', text: copy.importedTheme(result.theme.displayName) }); } }
    catch (error) { setNotice({ tone: 'error', text: cleanError(error) }); } finally { setBusy(null); }
  };

  const exportTheme = async () => {
    if (!selected) return; setBusy('export');
    try { const result = await window.codeDrobe.exportTheme(selected.id); if (!result.canceled && result.path) { setNotice({ tone: 'success', text: copy.packageExported }); await window.codeDrobe.showInFolder(result.path); } }
    catch (error) { setNotice({ tone: 'error', text: cleanError(error) }); } finally { setBusy(null); }
  };

  const deleteTheme = async () => {
    if (!deleteThemeId) return;
    const themeId = deleteThemeId; const themeName = data?.themes.find((theme) => theme.id === themeId)?.displayName ?? themeId;
    setDeleteThemeId(null); setBusy('delete');
    try { const result = await window.codeDrobe.deleteTheme(themeId); setData((current) => current ? { ...current, themes: result.themes, status: result.status } : current); setSelectedId(result.status.activeThemeId ?? result.themes[0]?.id ?? null); setNotice({ tone: 'success', text: copy.themeDeleted(themeName) }); }
    catch (error) { setNotice({ tone: 'error', text: cleanError(error) }); } finally { setBusy(null); }
  };

  const restore = async () => { setBusy('restore'); try { updateStatus(await window.codeDrobe.restore({ restoreBaseTheme: true })); setNotice({ tone: 'success', text: copy.nativeRestored }); } catch (error) { setNotice({ tone: 'error', text: cleanError(error) }); } finally { setBusy(null); } };
  const handleUpdate = async () => {
    if (update?.status !== 'available') { await checkForAppUpdates(true); return; }
    if (!update.asset && update.releaseUrl) {
      try { await window.codeDrobe.openUpdateRelease(update.releaseUrl); }
      catch (error) { setNotice({ tone: 'error', text: cleanError(error) }); }
      return;
    }
    setBusy('update'); setUpdateProgress(0);
    try { await window.codeDrobe.downloadUpdate(); setNotice({ tone: 'success', text: copy.updateReady }); }
    catch (error) { setNotice({ tone: 'error', text: cleanError(error) }); } finally { setBusy(null); }
  };

  return {
    data, marketplace, marketplaceError, marketplaceLoading, marketplaceCheckedAt, locale, view, category, searchQuery, selectedId, selectedSlug,
    selected, selectedStore, visibleStoreThemes, visibleLocalThemes, installedVersions, updateThemeIds, busy, restartThemeId, deleteThemeId, notice,
    logs, showLogs, update, updateChecking, updateProgress, copy,
    actions: {
      setView, setCategory, setSearchQuery, setSelectedId, setSelectedSlug, setRestartThemeId, setDeleteThemeId, setShowLogs,
      changeLocale, loadMarketplace, launch, installAndApply, importTheme, exportTheme, deleteTheme, restore, handleUpdate,
    },
  };
}
