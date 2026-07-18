// SPDX-License-Identifier: MPL-2.0

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_LOCALE, uiMessages, type AppLocale, type UiMessages } from '@shared/i18n';
import type {
  AppId,
  AppStatus,
  AuthState,
  DeepLinkApplyRequest,
  DesktopSettings,
  InstalledTheme,
  MarketplaceCategory,
  MarketplaceQuery,
  MarketplaceSort,
  MarketplaceTheme,
  SystemStatus,
  UpdateInfo,
} from '@shared/types';

export type View = 'store' | 'likes' | 'installed';

export type SettingsSection = 'general' | 'apps' | 'updates';

export type Selection =
  | { kind: 'store'; theme: MarketplaceTheme }
  | { kind: 'installed'; theme: InstalledTheme }
  | null;

export interface RestartPrompt {
  themeId: string;
  themeName: string;
  appId: AppId;
}

export interface DeepLinkPrompt {
  request: DeepLinkApplyRequest;
  theme: MarketplaceTheme | null;
}

export interface Toast {
  id: number;
  message: string;
  tone: 'default' | 'destructive';
}

const STORE_PAGE_SIZE = 24;

export function useAppController() {
  const [locale, setLocaleState] = useState<AppLocale>(DEFAULT_LOCALE);
  const [appVersion, setAppVersion] = useState('');
  const [webBaseUrl, setWebBaseUrl] = useState('https://codedrobe.app');
  const [view, setViewState] = useState<View>('store');
  const [storeAppFilter, setStoreAppFilter] = useState<AppId | null>(null);
  const [likedOnly, setLikedOnly] = useState(false);
  const [installed, setInstalled] = useState<InstalledTheme[]>([]);
  const [installedQuery, setInstalledQuery] = useState('');
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [auth, setAuth] = useState<AuthState>({ loggedIn: false });
  const [booting, setBooting] = useState(true);

  const [storeThemes, setStoreThemes] = useState<MarketplaceTheme[]>([]);
  const [storeCursor, setStoreCursor] = useState<string | null>(null);
  const [storeTotal, setStoreTotal] = useState(0);
  const [storeLoading, setStoreLoading] = useState(false);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [categories, setCategories] = useState<MarketplaceCategory[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<MarketplaceSort>('newest');

  const [selection, setSelection] = useState<Selection>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [restartPrompt, setRestartPrompt] = useState<RestartPrompt | null>(null);
  const [deletePrompt, setDeletePrompt] = useState<InstalledTheme | null>(null);
  const [deepLinkPrompt, setDeepLinkPrompt] = useState<DeepLinkPrompt | null>(null);
  const [loginUrl, setLoginUrl] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('general');
  const [settings, setSettings] = useState<DesktopSettings | null>(null);
  const [updateChecking, setUpdateChecking] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [logsOpen, setLogsOpen] = useState(false);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [updateProgress, setUpdateProgress] = useState<number | null>(null);
  const [updateReady, setUpdateReady] = useState(false);

  const t: UiMessages = uiMessages[locale];
  const toastTimer = useRef<number | null>(null);
  const searchTimer = useRef<number | null>(null);
  const loginRestartRequested = useRef(false);

  const showToast = useCallback((message: string, tone: Toast['tone'] = 'default') => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    const id = Date.now();
    setToast({ id, message, tone });
    toastTimer.current = window.setTimeout(() => setToast(null), 3600);
  }, []);

  const fail = useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    showToast(message || t.actionFailed, 'destructive');
  }, [showToast, t.actionFailed]);

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await window.codeDrobe.refreshStatus());
    } catch {
      // Transient status failures are ignored; the next poll retries.
    }
  }, []);

  const loadStore = useCallback(async (options: {
    reset: boolean;
    category?: string | null;
    q?: string;
    sort?: MarketplaceSort;
    cursor?: string | null;
    app?: AppId | null;
    liked?: boolean;
  }) => {
    setStoreLoading(true);
    setStoreError(null);
    try {
      const appFilter = options.app === undefined ? storeAppFilter : options.app;
      const request: MarketplaceQuery = {
        app: appFilter ?? undefined,
        category: (options.category === undefined ? category : options.category) ?? undefined,
        q: (options.q ?? query) || undefined,
        sort: options.sort ?? sort,
        cursor: options.reset ? undefined : options.cursor ?? storeCursor ?? undefined,
        liked: (options.liked ?? likedOnly) || undefined,
        limit: STORE_PAGE_SIZE,
      };
      const page = await window.codeDrobe.listMarketplace(request);
      setStoreThemes((current) => options.reset ? page.themes : [...current, ...page.themes]);
      setStoreCursor(page.nextCursor);
      setStoreTotal(page.total);
    } catch (error) {
      setStoreError(error instanceof Error ? error.message : String(error));
      if (options.reset) setStoreThemes([]);
    } finally {
      setStoreLoading(false);
    }
  }, [category, query, sort, storeCursor, storeAppFilter, likedOnly]);

  // Boot: bootstrap + categories + first store page + event subscriptions.
  useEffect(() => {
    let disposed = false;
    void (async () => {
      try {
        const boot = await window.codeDrobe.getBootstrap();
        if (disposed) return;
        setLocaleState(boot.locale);
        setAppVersion(boot.appVersion);
        setWebBaseUrl(boot.webBaseUrl);
        setInstalled(boot.themes);
        setStatus(boot.status);
        setAuth(boot.auth);
      } finally {
        if (!disposed) setBooting(false);
      }
      void window.codeDrobe.listMarketplaceCategories()
        .then((result) => { if (!disposed) setCategories(result); })
        .catch(() => undefined);
      void loadStore({ reset: true });
      void window.codeDrobe.checkForUpdates()
        .then((info) => { if (!disposed) setUpdate(info); })
        .catch(() => undefined);
    })();
    const offLog = window.codeDrobe.onRuntimeLog((line) => {
      setLogs((current) => [...current.slice(-399), line]);
    });
    const offProgress = window.codeDrobe.onUpdateDownloadProgress(setUpdateProgress);
    const offLoginUrl = window.codeDrobe.onAuthLoginUrl(setLoginUrl);
    const offDeepLink = window.codeDrobe.onDeepLinkApply((request) => {
      setDeepLinkPrompt({ request, theme: null });
      void window.codeDrobe.getMarketplaceTheme(request.slug)
        .then((theme) => setDeepLinkPrompt((current) =>
          current?.request === request ? { request, theme } : current))
        .catch(() => undefined);
    });
    const poll = window.setInterval(() => void refreshStatus(), 5000);
    return () => {
      disposed = true;
      offLog();
      offProgress();
      offLoginUrl();
      offDeepLink();
      window.clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = useCallback(async (next: AppLocale) => {
    setLocaleState(next);
    try {
      await window.codeDrobe.setLocale(next);
    } catch {
      showToast(uiMessages[next].languageSaveFailed, 'destructive');
    }
  }, [showToast]);

  const setView = useCallback((next: View) => {
    setViewState(next);
    const nextLiked = next === 'likes';
    if (next !== 'installed' && nextLiked !== likedOnly) {
      setLikedOnly(nextLiked);
      void loadStore({ reset: true, liked: nextLiked });
    }
  }, [likedOnly, loadStore]);

  const changeStoreAppFilter = useCallback((appId: AppId | null) => {
    setStoreAppFilter(appId);
    void loadStore({ reset: true, app: appId });
  }, [loadStore]);

  const changeCategory = useCallback((next: string | null) => {
    setCategory(next);
    void loadStore({ reset: true, category: next });
  }, [loadStore]);

  const changeSort = useCallback((next: MarketplaceSort) => {
    setSort(next);
    void loadStore({ reset: true, sort: next });
  }, [loadStore]);

  const changeQuery = useCallback((next: string) => {
    setQuery(next);
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => {
      void loadStore({ reset: true, q: next });
    }, 300);
  }, [loadStore]);

  const installedById = useMemo(
    () => new Map(installed.map((theme) => [theme.id, theme])),
    [installed],
  );

  const appStatusFor = useCallback((appId: AppId): AppStatus | null =>
    status?.apps.find((app) => app.appId === appId) ?? null, [status]);

  /** Install (when needed) then apply; handles the requires-restart handshake. */
  const applyToApp = useCallback(async (
    themeId: string,
    themeName: string,
    appId: AppId,
    options: { restartExisting?: boolean } = {},
  ) => {
    setBusy(`apply:${themeId}`);
    try {
      const result = await window.codeDrobe.applyTheme({
        themeId,
        appId,
        restartExisting: options.restartExisting,
      });
      setStatus(result.system);
      if (result.status === 'requires-restart') {
        setRestartPrompt({ themeId, themeName, appId });
        return false;
      }
      if (result.status === 'port-occupied') {
        showToast(result.message, 'destructive');
        return false;
      }
      showToast(t.themeApplied(themeName));
      return true;
    } catch (error) {
      fail(error);
      return false;
    } finally {
      setBusy(null);
    }
  }, [fail, showToast, t]);

  const installFromStore = useCallback(async (theme: MarketplaceTheme, applyTo: AppId | null = null) => {
    setBusy(`install:${theme.slug}`);
    try {
      const result = await window.codeDrobe.installMarketplaceTheme(theme.slug);
      setInstalled(result.themes);
      showToast(t.installSucceeded(result.theme.displayName));
      if (applyTo) {
        setBusy(null);
        await applyToApp(result.theme.id, result.theme.displayName, applyTo);
      }
      return result.theme;
    } catch (error) {
      fail(error);
      return null;
    } finally {
      setBusy((current) => (current === `install:${theme.slug}` ? null : current));
    }
  }, [applyToApp, fail, showToast, t]);

  const restoreApp = useCallback(async (appId: AppId) => {
    setBusy(`restore:${appId}`);
    try {
      setStatus(await window.codeDrobe.restoreApp(appId));
      const appName = appStatusFor(appId)?.displayName ?? appId;
      showToast(t.nativeRestored(appName));
    } catch (error) {
      fail(error);
    } finally {
      setBusy(null);
    }
  }, [appStatusFor, fail, showToast, t]);

  const importTheme = useCallback(async () => {
    setBusy('import');
    try {
      const result = await window.codeDrobe.importTheme();
      if (!result.canceled && result.theme) {
        const imported = result.theme;
        setInstalled((current) => {
          const others = current.filter((item) => item.id !== imported.id);
          return [...others, imported].sort((a, b) => a.displayName.localeCompare(b.displayName));
        });
        showToast(t.importedTheme(imported.displayName));
      }
    } catch (error) {
      fail(error);
    } finally {
      setBusy(null);
    }
  }, [fail, showToast, t]);

  const exportTheme = useCallback(async (themeId: string) => {
    try {
      const result = await window.codeDrobe.exportTheme(themeId);
      if (!result.canceled) showToast(t.packageExported);
    } catch (error) {
      fail(error);
    }
  }, [fail, showToast, t]);

  const confirmDelete = useCallback(async () => {
    if (!deletePrompt) return;
    setBusy(`delete:${deletePrompt.id}`);
    try {
      const result = await window.codeDrobe.deleteTheme(deletePrompt.id);
      setInstalled(result.themes);
      setStatus(result.status);
      setSelection((current) =>
        current?.kind === 'installed' && current.theme.id === deletePrompt.id ? null : current);
      showToast(t.themeDeleted(deletePrompt.displayName));
    } catch (error) {
      fail(error);
    } finally {
      setBusy(null);
      setDeletePrompt(null);
    }
  }, [deletePrompt, fail, showToast, t]);

  const login = useCallback(async () => {
    setBusy('login');
    try {
      setAuth(await window.codeDrobe.authLogin());
      void loadStore({ reset: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('LOGIN_DENIED')) showToast(t.loginDenied, 'destructive');
      else if (message.includes('LOGIN_TIMEOUT')) showToast(t.loginTimeout, 'destructive');
      else if (message.includes('LOGIN_CANCELLED') || message.includes('LOGIN_IN_PROGRESS')) {
        // User-initiated cancel or duplicate click: no toast.
      } else showToast(t.loginFailed, 'destructive');
    } finally {
      setBusy(null);
      setLoginUrl(null);
      if (loginRestartRequested.current) {
        // Restart only after this attempt fully unwinds (main clears its
        // in-flight guard before the cancel rejection reaches us).
        loginRestartRequested.current = false;
        window.setTimeout(() => { void login(); }, 0);
      }
    }
  }, [loadStore, showToast, t]);

  const copyLoginUrl = useCallback(async () => {
    if (!loginUrl) return;
    try {
      await navigator.clipboard.writeText(loginUrl);
      showToast(t.linkCopied);
    } catch {
      showToast(t.shareCopyFailed, 'destructive');
    }
  }, [loginUrl, showToast, t]);

  const reopenLoginBrowser = useCallback(() => {
    void window.codeDrobe.authLoginOpenBrowser().catch(() => undefined);
  }, []);

  const cancelLogin = useCallback(() => {
    loginRestartRequested.current = false;
    void window.codeDrobe.authLoginCancel().catch(() => undefined);
  }, []);

  /** Cancels the in-flight attempt, then starts a fresh one (new state + port). */
  const restartLogin = useCallback(() => {
    loginRestartRequested.current = true;
    void window.codeDrobe.authLoginCancel().catch(() => undefined);
  }, []);

  const logout = useCallback(async () => {
    setBusy('logout');
    try {
      setAuth(await window.codeDrobe.authLogout());
      void loadStore({ reset: true });
    } catch (error) {
      fail(error);
    } finally {
      setBusy(null);
    }
  }, [fail, loadStore]);

  const themeShareUrl = useCallback((slug: string) =>
    `${webBaseUrl.replace(/\/+$/, '')}/themes/${encodeURIComponent(slug)}`, [webBaseUrl]);

  const copyShareText = useCallback(async (theme: MarketplaceTheme) => {
    const name = locale === 'zh-CN' ? theme.name.zh || theme.name.en : theme.name.en || theme.name.zh;
    const description = (locale === 'zh-CN'
      ? theme.description.zh || theme.description.en
      : theme.description.en || theme.description.zh) ?? '';
    try {
      await navigator.clipboard.writeText(t.shareCopyText(name, description, themeShareUrl(theme.slug)));
      showToast(t.shareCopied);
    } catch {
      showToast(t.shareCopyFailed, 'destructive');
    }
  }, [locale, showToast, t, themeShareUrl]);

  const shareToX = useCallback((theme: MarketplaceTheme) => {
    const name = locale === 'zh-CN' ? theme.name.zh || theme.name.en : theme.name.en || theme.name.zh;
    void window.codeDrobe.openXShare(t.shareXText(name, themeShareUrl(theme.slug))).catch(() => undefined);
  }, [locale, t, themeShareUrl]);

  const toggleLike = useCallback(async (theme: MarketplaceTheme) => {
    if (!auth.loggedIn) {
      showToast(t.likeRequiresLogin);
      return;
    }
    const nextLiked = !theme.likedByMe;
    try {
      const result = await window.codeDrobe.setThemeLike(theme.slug, nextLiked);
      const patch = (item: MarketplaceTheme): MarketplaceTheme =>
        item.slug === theme.slug
          ? { ...item, likedByMe: result.likedByMe, likeCount: result.likeCount }
          : item;
      setStoreThemes((current) => current.map(patch));
      setSelection((current) =>
        current?.kind === 'store' && current.theme.slug === theme.slug
          ? { kind: 'store', theme: patch(current.theme) }
          : current);
      // The likes view lists only liked themes, so membership changed.
      if (likedOnly) void loadStore({ reset: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('LIKE_REQUIRES_LOGIN')) showToast(t.likeRequiresLogin);
      else fail(error);
    }
  }, [auth.loggedIn, fail, likedOnly, loadStore, showToast, t]);

  const confirmDeepLink = useCallback(async () => {
    const prompt = deepLinkPrompt;
    if (!prompt) return;
    setDeepLinkPrompt(null);
    const { request, theme } = prompt;
    const existing = installedById.get(request.slug)
      ?? installed.find((item) => item.id === request.slug)
      ?? null;
    const sameVersion = existing && (!request.version || existing.version === request.version);
    if (existing && sameVersion) {
      await applyToApp(existing.id, existing.displayName, request.appId);
      return;
    }
    const marketTheme = theme ?? await window.codeDrobe.getMarketplaceTheme(request.slug).catch(() => null);
    if (!marketTheme) {
      showToast(t.deepLinkThemeUnknown, 'destructive');
      return;
    }
    const installedTheme = await installFromStore(marketTheme, null);
    if (installedTheme) {
      await applyToApp(installedTheme.id, installedTheme.displayName, request.appId);
    }
  }, [applyToApp, deepLinkPrompt, installFromStore, installed, installedById, showToast, t]);

  const openSettings = useCallback((section: SettingsSection = 'general') => {
    setSettingsSection(section);
    setSettingsOpen(true);
    void window.codeDrobe.getSettings().then(setSettings).catch(() => undefined);
  }, []);

  const chooseAppPath = useCallback(async (appId: AppId) => {
    try {
      const result = await window.codeDrobe.pickAppPath(appId);
      setSettings(result.settings);
      setStatus(result.status);
      if (!result.canceled) showToast(t.settingsSaved);
    } catch (error) {
      fail(error);
    }
  }, [fail, showToast, t]);

  const clearAppPath = useCallback(async (appId: AppId) => {
    try {
      const result = await window.codeDrobe.clearAppPath(appId);
      setSettings(result.settings);
      setStatus(result.status);
      showToast(t.settingsSaved);
    } catch (error) {
      fail(error);
    }
  }, [fail, showToast, t]);

  const saveAppPort = useCallback(async (appId: AppId, port: number | null) => {
    try {
      const result = await window.codeDrobe.setAppPort(appId, port);
      setSettings(result.settings);
      setStatus(result.status);
      showToast(t.settingsSaved);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('INVALID_PORT')) showToast(t.settingsPortInvalid, 'destructive');
      else fail(error);
      return false;
    }
  }, [fail, showToast, t]);

  const downloadUpdate = useCallback(async () => {
    setBusy('update');
    setUpdateReady(false);
    try {
      const outcome = await window.codeDrobe.downloadUpdate();
      if (outcome.ready) setUpdateReady(true);
      else showToast(t.updateReady);
    } catch (error) {
      fail(error);
    } finally {
      setBusy(null);
      setUpdateProgress(null);
    }
  }, [fail, showToast, t]);

  const installUpdate = useCallback(() => {
    // The app quits into the installer; errors only occur when nothing is staged.
    void window.codeDrobe.installUpdate().catch((error) => fail(error));
  }, [fail]);

  const checkUpdates = useCallback(async () => {
    setUpdateChecking(true);
    setUpdateReady(false);
    try {
      setUpdate(await window.codeDrobe.checkForUpdates());
    } catch {
      // Failed checks are reported inline (settings dialog), never as a toast.
      setUpdate(null);
    } finally {
      setUpdateChecking(false);
    }
  }, []);

  return {
    t,
    locale,
    setLocale,
    appVersion,
    booting,
    view,
    setView,
    likedOnly,
    storeAppFilter,
    changeStoreAppFilter,
    installed,
    installedQuery,
    setInstalledQuery,
    installedById,
    status,
    appStatusFor,
    auth,
    store: {
      themes: storeThemes,
      total: storeTotal,
      cursor: storeCursor,
      loading: storeLoading,
      error: storeError,
      categories,
      category,
      query,
      sort,
    },
    changeCategory,
    changeQuery,
    changeSort,
    reloadStore: () => void loadStore({ reset: true }),
    loadMoreStore: () => void loadStore({ reset: false }),
    selection,
    setSelection,
    busy,
    toast,
    restartPrompt,
    setRestartPrompt,
    deletePrompt,
    setDeletePrompt,
    deepLinkPrompt,
    setDeepLinkPrompt,
    confirmDeepLink,
    logs,
    logsOpen,
    setLogsOpen,
    update,
    updateProgress,
    updateChecking,
    updateReady,
    checkUpdates,
    downloadUpdate,
    installUpdate,
    loginUrl,
    copyLoginUrl,
    reopenLoginBrowser,
    cancelLogin,
    restartLogin,
    settingsOpen,
    setSettingsOpen,
    settingsSection,
    setSettingsSection,
    settings,
    openSettings,
    chooseAppPath,
    clearAppPath,
    saveAppPort,
    applyToApp,
    installFromStore,
    restoreApp,
    importTheme,
    exportTheme,
    confirmDelete,
    login,
    logout,
    toggleLike,
    copyShareText,
    shareToX,
  };
}

export type AppController = ReturnType<typeof useAppController>;
