// SPDX-License-Identifier: MPL-2.0

import { app, autoUpdater, BrowserWindow, dialog, ipcMain, Menu, nativeImage, shell, Tray } from 'electron';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { THEME_EXTENSION } from '@codedrobe/core';
import { AuthService } from './main/auth-service';
import { CoreService } from './main/core-service';
import { DeepLinkManager, extractDeepLinkFromArgv } from './main/deep-link';
import { extractThemeFilesFromArgv, FileOpenQueue, isThemePackagePath } from './main/file-open';
import { loadLocalePreference, saveLocalePreference } from './main/locale-preferences';
import { MarketplaceService } from './main/marketplace-service';
import { SettingsService } from './main/settings-service';
import { ThemeLibrary } from './main/theme-library';
import { UpdateService } from './main/update-service';
import { DEFAULT_LOCALE, getMainMessages, isAppLocale, setMainLocale, type AppLocale } from './shared/i18n';
import { APP_IDS, isAppId, type AppId, type ApplyRequest, type MarketplaceQuery, type SettingsUpdateResult, type UpdateDownloadOutcome } from './shared/types';

const API_BASE = (process.env.CODEDROBE_API_BASE ?? 'https://codedrobe.app').replace(/\/+$/, '');

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let library: ThemeLibrary;
let core: CoreService;
let marketplace: MarketplaceService;
let updates: UpdateService;
let auth: AuthService;
let settings: SettingsService;
const deepLinks = new DeepLinkManager();
const fileOpens = new FileOpenQueue();
/** Update staged by updates:download, consumed by updates:install. */
let stagedUpdate: { kind: 'squirrel' } | { kind: 'nsis'; installerPath: string } | null = null;
let locale: AppLocale = DEFAULT_LOCALE;
let userDataRoot = '';

function brandingRoot(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'runtime')
    : path.resolve(app.getAppPath(), 'assets', 'runtime');
}

function sendLog(line: string): void {
  mainWindow?.webContents.send('runtime:log', line);
}

function registerProtocol(): void {
  if (app.isPackaged) {
    app.setAsDefaultProtocolClient('codedrobe');
    return;
  }
  // The execPath/args form only works on Windows/Linux. On macOS the call
  // registers the shared dev bundle id (com.github.Electron), so Launch
  // Services routes codedrobe:// to a RANDOM Electron.app on disk — never
  // register there in dev. Test macOS deep links with a packaged build, or
  // pass the URL as a launch argument: npm start -- -- "codedrobe://...".
  if (process.platform !== 'darwin' && process.argv[1]) {
    app.setAsDefaultProtocolClient('codedrobe', process.execPath, [path.resolve(process.argv[1])]);
  }
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1220,
    height: 800,
    minWidth: 980,
    minHeight: 680,
    show: false,
    title: 'CodeDrobe',
    icon: path.join(brandingRoot(), 'icon.png'),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('did-finish-load', () => {
    deepLinks.setSink((request) => {
      mainWindow?.show();
      mainWindow?.focus();
      mainWindow?.webContents.send('deeplink:apply', request);
    });
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
}

function updateTrayMenu(): void {
  if (!tray) return;
  const copy = getMainMessages();
  tray.setToolTip(copy.trayTooltip);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: copy.trayOpen, click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { type: 'separator' },
    { label: copy.trayRestore, click: () => void core.restoreAll().catch((error) => sendLog(String(error))) },
    { type: 'separator' },
    { label: copy.trayQuit, click: () => { isQuitting = true; app.quit(); } },
  ]));
}

function createTray(): void {
  const filename = process.platform === 'darwin' ? 'trayTemplate.png' : 'tray-icon.png';
  const source = nativeImage.createFromPath(path.join(brandingRoot(), filename));
  const icon = source.isEmpty() ? nativeImage.createEmpty() : source;
  if (process.platform === 'darwin') icon.setTemplateImage(true);
  tray = new Tray(icon);
  updateTrayMenu();
  tray.on('double-click', () => mainWindow?.show());
}

function settingsDto() {
  const defaultPorts = Object.fromEntries(
    APP_IDS.map((appId) => [appId, core.defaultPortFor(appId)]),
  ) as Record<AppId, number>;
  return settings.toDto(defaultPorts);
}

/** Squirrel.Mac in-place download: resolves once the update is staged. */
function downloadMacInPlace(): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      autoUpdater.removeListener('update-downloaded', onDownloaded);
      autoUpdater.removeListener('update-not-available', onNotAvailable);
      autoUpdater.removeListener('error', onError);
    };
    const onDownloaded = () => { cleanup(); resolve(); };
    const onNotAvailable = () => { cleanup(); reject(new Error('The update feed reports no update.')); };
    const onError = (error: Error) => { cleanup(); reject(error); };
    const timeout = setTimeout(() => { cleanup(); reject(new Error('In-place update timed out.')); }, 10 * 60_000);
    autoUpdater.on('update-downloaded', onDownloaded);
    autoUpdater.on('update-not-available', onNotAvailable);
    autoUpdater.on('error', onError);
    autoUpdater.setFeedURL({
      url: `${API_BASE}/api/v1/releases/squirrel/darwin/${process.arch}?version=${app.getVersion()}`,
    });
    autoUpdater.checkForUpdates();
  });
}

/**
 * Silent NSIS self-update only applies to per-user installs: portable builds
 * have no install dir, and MSI installs (Program Files) would end up with a
 * duplicate per-user copy.
 */
function canSilentNsisUpdate(assetName: string): boolean {
  if (process.platform !== 'win32' || !app.isPackaged) return false;
  if (!/setup\.exe$/i.test(assetName)) return false;
  if (process.env.PORTABLE_EXECUTABLE_DIR) return false;
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) return false;
  return process.execPath.toLowerCase().startsWith(path.join(localAppData, 'Programs').toLowerCase());
}

/**
 * Auto-import a theme package opened from the OS (double-click, "Open with",
 * drag-drop). New theme ids install silently; when the id is already taken the
 * renderer asks the user before replacing (imports never overwrite silently).
 */
async function handleThemeFileOpen(filePath: string): Promise<void> {
  mainWindow?.show();
  mainWindow?.focus();
  try {
    const inspection = await library.inspectPackage(filePath);
    if (inspection.existing) {
      mainWindow?.webContents.send('file:import-confirm', {
        path: filePath,
        incoming: inspection.incoming,
        existing: inspection.existing,
      });
      return;
    }
    const theme = await library.importPackage(filePath);
    mainWindow?.webContents.send('file:imported', { theme, themes: await library.summaries() });
  } catch (error) {
    mainWindow?.webContents.send('file:import-failed', error instanceof Error ? error.message : String(error));
  }
}

function registerIpc(): void {
  ipcMain.handle('app:bootstrap', async () => {
    // The renderer registers its event listeners before app:bootstrap resolves,
    // so flushing queued file opens here (unlike deep links, which flush on
    // did-finish-load) guarantees the confirm prompt is never lost on cold start.
    fileOpens.setSink((filePath) => void handleThemeFileOpen(filePath));
    return {
      themes: await library.summaries(),
      status: await core.status(),
      locale,
      appVersion: app.getVersion(),
      auth: await auth.status(),
      webBaseUrl: API_BASE,
    };
  });
  ipcMain.handle('locale:set', async (_event, nextLocale: unknown) => {
    if (!isAppLocale(nextLocale)) throw new Error(getMainMessages().invalidLocale);
    locale = nextLocale;
    setMainLocale(locale);
    await saveLocalePreference(userDataRoot, locale);
    updateTrayMenu();
  });
  ipcMain.handle('system:status', () => core.status());
  ipcMain.handle('theme:apply', (_event, request: ApplyRequest) => {
    if (!request || !isAppId(request.appId) || typeof request.themeId !== 'string') {
      throw new Error('Invalid apply request.');
    }
    return core.apply(request);
  });
  ipcMain.handle('theme:restore', (_event, appId: unknown) => {
    if (!isAppId(appId)) throw new Error('Invalid app id.');
    return core.restore(appId);
  });
  ipcMain.handle('theme:import', async () => {
    const copy = getMainMessages();
    const selection = await dialog.showOpenDialog(mainWindow!, {
      title: copy.importDialogTitle,
      properties: ['openFile'],
      filters: [{ name: copy.themePackageFilter, extensions: ['codedrobe-theme', 'codex-theme'] }],
    });
    if (selection.canceled || !selection.filePaths[0]) return { canceled: true };
    const theme = await library.importPackage(selection.filePaths[0]);
    return { canceled: false, path: selection.filePaths[0], theme };
  });
  ipcMain.handle('theme:import-path', async (_event, filePath: unknown) => {
    if (typeof filePath !== 'string' || !isThemePackagePath(filePath)) {
      throw new Error(getMainMessages().invalidPackage);
    }
    const theme = await library.importPackage(filePath);
    return { theme, themes: await library.summaries() };
  });
  ipcMain.handle('theme:open-file', (_event, filePath: unknown) => {
    if (typeof filePath !== 'string' || !isThemePackagePath(filePath)) {
      throw new Error(getMainMessages().invalidPackage);
    }
    fileOpens.handlePath(filePath);
  });
  ipcMain.handle('theme:export', async (_event, themeId: string) => {
    const copy = getMainMessages();
    const entry = await library.find(themeId);
    const selection = await dialog.showSaveDialog(mainWindow!, {
      title: copy.exportDialogTitle,
      defaultPath: `${entry.bundle.theme.id}-${entry.bundle.theme.version}${THEME_EXTENSION}`,
      filters: [{ name: copy.themePackageFilter, extensions: ['codedrobe-theme'] }],
    });
    if (selection.canceled || !selection.filePath) return { canceled: true };
    await library.exportPackage(themeId, selection.filePath);
    return { canceled: false, path: selection.filePath };
  });
  ipcMain.handle('theme:delete', async (_event, themeId: string) => {
    const status = await core.status();
    for (const appStatus of status.apps) {
      if (appStatus.activeThemeId === themeId) await core.restore(appStatus.appId);
    }
    await library.delete(themeId);
    return { themes: await library.summaries(), status: await core.status() };
  });
  ipcMain.handle('marketplace:list', (_event, query?: MarketplaceQuery) => marketplace.list(query ?? {}));
  ipcMain.handle('marketplace:categories', () => marketplace.categories());
  ipcMain.handle('marketplace:get', (_event, slug: string) => marketplace.getTheme(slug));
  ipcMain.handle('marketplace:install', (_event, slug: string) => marketplace.install(slug));
  ipcMain.handle('marketplace:like', (_event, slug: string, liked: boolean) => marketplace.setLike(slug, Boolean(liked)));
  ipcMain.handle('auth:login', () => auth.login({
    onAuthorizeUrl: (url) => mainWindow?.webContents.send('auth:login-url', url),
    // The browser owns the foreground during authorization; pull the app back
    // the moment the loopback callback lands.
    onCallback: () => {
      mainWindow?.show();
      mainWindow?.focus();
      app.focus({ steal: true });
    },
  }));
  ipcMain.handle('auth:login-open', () => auth.reopenAuthorizeUrl());
  ipcMain.handle('auth:login-cancel', () => auth.cancelLogin());
  ipcMain.handle('auth:logout', () => auth.logout());
  ipcMain.handle('auth:status', () => auth.status());
  ipcMain.handle('settings:get', () => settingsDto());
  ipcMain.handle('settings:pick-app-path', async (_event, appId: unknown): Promise<SettingsUpdateResult & { canceled: boolean }> => {
    if (!isAppId(appId)) throw new Error('Invalid app id.');
    const copy = getMainMessages();
    const selection = await dialog.showOpenDialog(mainWindow!, {
      title: copy.pickAppDialogTitle(appId),
      properties: ['openFile'],
      filters: process.platform === 'win32'
        ? [{ name: 'Programs', extensions: ['exe'] }]
        : [{ name: 'Applications', extensions: ['app'] }],
    });
    if (selection.canceled || !selection.filePaths[0]) {
      return { canceled: true, settings: settingsDto(), status: await core.status() };
    }
    await settings.setAppPath(appId, selection.filePaths[0]);
    return { canceled: false, settings: settingsDto(), status: await core.status() };
  });
  ipcMain.handle('settings:clear-app-path', async (_event, appId: unknown): Promise<SettingsUpdateResult> => {
    if (!isAppId(appId)) throw new Error('Invalid app id.');
    await settings.setAppPath(appId, null);
    return { settings: settingsDto(), status: await core.status() };
  });
  ipcMain.handle('settings:set-app-port', async (_event, appId: unknown, port: unknown): Promise<SettingsUpdateResult> => {
    if (!isAppId(appId)) throw new Error('Invalid app id.');
    if (port !== null && (!Number.isInteger(port) || (port as number) < 1024 || (port as number) > 65535)) {
      throw new Error('INVALID_PORT');
    }
    await settings.setAppPort(appId, port as number | null);
    return { settings: settingsDto(), status: await core.status() };
  });
  ipcMain.handle('web:open-page', async (_event, page: unknown) => {
    // Whitelisted website destinations only — the renderer never passes URLs.
    const pages: Record<string, string> = { privacy: '/privacy', terms: '/terms', account: '/account' };
    if (typeof page !== 'string' || !(page in pages)) throw new Error('Invalid website page.');
    const prefix = locale === 'zh-CN' ? '/zh' : '';
    await shell.openExternal(`${API_BASE}${prefix}${pages[page]}`);
  });
  ipcMain.handle('share:x', async (_event, text: unknown) => {
    if (typeof text !== 'string' || !text || text.length > 1000) throw new Error('Invalid share text.');
    await shell.openExternal(`https://x.com/intent/post?text=${encodeURIComponent(text)}`);
  });
  ipcMain.handle('updates:check', () => updates.check());
  ipcMain.handle('updates:download', async (): Promise<UpdateDownloadOutcome> => {
    stagedUpdate = null;
    // macOS packaged builds update in place (Squirrel.Mac swaps the .app);
    // any failure falls back to the manual installer flow below.
    if (process.platform === 'darwin' && app.isPackaged) {
      try {
        await downloadMacInPlace();
        stagedUpdate = { kind: 'squirrel' };
        return { ready: true };
      } catch (error) {
        sendLog(`[update] in-place update unavailable, falling back to installer: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    const result = await updates.download((progress) => mainWindow?.webContents.send('updates:progress', progress));
    if (canSilentNsisUpdate(result.assetName)) {
      stagedUpdate = { kind: 'nsis', installerPath: result.path };
      return { ready: true };
    }
    const openError = await shell.openPath(result.path);
    if (openError) shell.showItemInFolder(result.path);
    return { ready: false };
  });
  ipcMain.handle('updates:install', () => {
    if (!stagedUpdate) throw new Error('No staged update.');
    isQuitting = true;
    if (stagedUpdate.kind === 'squirrel') {
      autoUpdater.quitAndInstall();
      return;
    }
    // electron-builder NSIS: /S = silent overwrite, --force-run = relaunch.
    spawn(stagedUpdate.installerPath, ['/S', '--force-run'], { detached: true, stdio: 'ignore' }).unref();
    app.quit();
  });
  ipcMain.handle('updates:open-release', async (_event, value: unknown) => {
    if (typeof value !== 'string') throw new Error('Invalid release URL.');
    const url = new URL(value);
    if (url.origin !== 'https://github.com' || !url.pathname.startsWith('/CodeDrobe/desktop/releases/')) {
      throw new Error('The release URL is not trusted.');
    }
    await shell.openExternal(url.toString());
  });
  ipcMain.handle('shell:show-item', (_event, itemPath: string) => shell.showItemInFolder(itemPath));
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

app.on('second-instance', (_event, argv) => {
  mainWindow?.show();
  mainWindow?.focus();
  const url = extractDeepLinkFromArgv(argv);
  if (url) deepLinks.handleUrl(url);
  for (const filePath of extractThemeFilesFromArgv(argv)) fileOpens.handlePath(filePath);
});

// macOS deep links arrive via open-url (may fire before ready).
app.on('open-url', (event, url) => {
  event.preventDefault();
  deepLinks.handleUrl(url);
});

// macOS file associations arrive via open-file (may fire before ready).
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  fileOpens.handlePath(filePath);
});

app.whenReady().then(async () => {
  app.setName('CodeDrobe');
  registerProtocol();
  if (process.platform === 'darwin' && !app.isPackaged) {
    const dockIcon = nativeImage.createFromPath(path.join(app.getAppPath(), 'assets', 'icon.png'));
    if (!dockIcon.isEmpty()) app.dock?.setIcon(dockIcon);
  }
  userDataRoot = app.getPath('userData');
  locale = await loadLocalePreference(userDataRoot, app.getLocale());
  setMainLocale(locale);
  library = new ThemeLibrary(path.join(userDataRoot, 'themes'));
  await library.initialize();
  const brandIcon = nativeImage.createFromPath(path.join(brandingRoot(), 'icon.png'));
  const brandIconDataUrl = brandIcon.isEmpty()
    ? null
    : brandIcon.resize({ width: 144, height: 144 }).toDataURL();
  auth = new AuthService(API_BASE, path.join(userDataRoot, 'credentials.bin'), fetch, brandIconDataUrl);
  await auth.initialize();
  marketplace = new MarketplaceService(library, API_BASE, fetch, () => auth.getAccessToken());
  updates = new UpdateService(app.getVersion(), app.getPath('downloads'), API_BASE);
  settings = new SettingsService(path.join(userDataRoot, 'settings.json'));
  await settings.initialize();
  core = new CoreService(library, path.join(userDataRoot, 'manager-state.json'), settings);
  core.setLogListener(sendLog);
  await core.initialize();
  registerIpc();
  // Windows cold-start deep link / theme files arrive in argv.
  const initialDeepLink = extractDeepLinkFromArgv(process.argv);
  if (initialDeepLink) deepLinks.handleUrl(initialDeepLink);
  for (const filePath of extractThemeFilesFromArgv(process.argv)) fileOpens.handlePath(filePath);
  await createWindow();
  createTray();
}).catch((error) => {
  dialog.showErrorBox(getMainMessages().startupErrorTitle, error instanceof Error ? error.message : String(error));
  app.quit();
});

app.on('activate', () => {
  if (mainWindow) mainWindow.show();
  else void createWindow();
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  // Keep the manager alive in the tray so route changes can be reinjected.
});
