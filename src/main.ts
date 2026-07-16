// SPDX-License-Identifier: MPL-2.0

import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, shell, Tray } from 'electron';
import squirrelStartup from 'electron-squirrel-startup';
import fs from 'node:fs/promises';
import path from 'node:path';
import { CodexService } from './main/codex-service';
import { loadLocalePreference, saveLocalePreference } from './main/locale-preferences';
import { MarketplaceService } from './main/marketplace-service';
import { ThemeRepository } from './main/theme-repository';
import { UpdateService } from './main/update-service';
import { DEFAULT_LOCALE, getMainMessages, isAppLocale, setMainLocale, type AppLocale } from './shared/i18n';
import type { LaunchRequest, RestoreRequest } from './shared/types';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let themes: ThemeRepository;
let codex: CodexService;
let marketplace: MarketplaceService;
let updates: UpdateService;
let locale: AppLocale = DEFAULT_LOCALE;
let userDataRoot = '';

if (squirrelStartup) app.quit();

function runtimeRoot(): string {
  return app.isPackaged
    ? process.resourcesPath
    : path.resolve(app.getAppPath(), 'node_modules', '@codedrobe', 'codex-core');
}

function brandingRoot(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'runtime')
    : path.resolve(app.getAppPath(), 'assets', 'runtime');
}

function sendLog(line: string): void {
  mainWindow?.webContents.send('runtime:log', line);
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
    backgroundColor: '#17131a',
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
    { label: copy.trayRestore, click: () => void codex.restore(false).catch((error) => sendLog(String(error))) },
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

function registerIpc(): void {
  ipcMain.handle('app:bootstrap', async () => ({
    themes: await themes.summaries(),
    status: await codex.status(),
    locale,
    appVersion: app.getVersion(),
  }));
  ipcMain.handle('locale:set', async (_event, nextLocale: unknown) => {
    if (!isAppLocale(nextLocale)) throw new Error(getMainMessages().invalidLocale);
    locale = nextLocale;
    setMainLocale(locale);
    await saveLocalePreference(userDataRoot, locale);
    updateTrayMenu();
  });
  ipcMain.handle('system:status', () => codex.status());
  ipcMain.handle('theme:launch', (_event, request: LaunchRequest) => codex.launch(request));
  ipcMain.handle('theme:restore', (_event, request?: RestoreRequest) => codex.restore(Boolean(request?.restoreBaseTheme)));
  ipcMain.handle('theme:import', async () => {
    const copy = getMainMessages();
    const selection = await dialog.showOpenDialog(mainWindow!, {
      title: copy.importDialogTitle,
      properties: ['openFile'],
      filters: [{ name: copy.themePackageFilter, extensions: ['codex-theme'] }],
    });
    if (selection.canceled || !selection.filePaths[0]) return { canceled: true };
    const theme = await themes.importPackage(selection.filePaths[0]);
    return { canceled: false, path: selection.filePaths[0], theme };
  });
  ipcMain.handle('theme:export', async (_event, themeId: string) => {
    const copy = getMainMessages();
    const bundle = await themes.exportPackage(themeId);
    const selection = await dialog.showSaveDialog(mainWindow!, {
      title: copy.exportDialogTitle,
      defaultPath: `${bundle.manifest.id}-${bundle.manifest.version}.codex-theme`,
      filters: [{ name: copy.themePackageFilter, extensions: ['codex-theme'] }],
    });
    if (selection.canceled || !selection.filePath) return { canceled: true };
    await fs.writeFile(selection.filePath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
    return { canceled: false, path: selection.filePath };
  });
  ipcMain.handle('theme:delete', async (_event, themeId: string) => {
    const status = await codex.status();
    if (status.activeThemeId === themeId) await codex.restore(true);
    await themes.delete(themeId);
    return { themes: await themes.summaries(), status: await codex.status() };
  });
  ipcMain.handle('marketplace:list', (_event, category?: string) => marketplace.list(category));
  ipcMain.handle('marketplace:install', (_event, slug: string) => marketplace.install(slug));
  ipcMain.handle('updates:check', () => updates.check());
  ipcMain.handle('updates:download', async () => {
    const result = await updates.download((progress) => mainWindow?.webContents.send('updates:progress', progress));
    const openError = await shell.openPath(result.path);
    if (openError) shell.showItemInFolder(result.path);
    return result;
  });
  ipcMain.handle('updates:open-release', async (_event, value: unknown) => {
    if (typeof value !== 'string') throw new Error('Invalid release URL.');
    const url = new URL(value);
    if (url.origin !== 'https://github.com' || !url.pathname.startsWith('/anhao/codedrobe-desktop/releases/')) {
      throw new Error('The release URL is not trusted.');
    }
    await shell.openExternal(url.toString());
  });
  ipcMain.handle('shell:show-item', (_event, itemPath: string) => shell.showItemInFolder(itemPath));
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

app.on('second-instance', () => {
  mainWindow?.show();
  mainWindow?.focus();
});

app.whenReady().then(async () => {
  app.setName('CodeDrobe');
  if (process.platform === 'darwin' && !app.isPackaged) {
    const dockIcon = nativeImage.createFromPath(path.join(app.getAppPath(), 'assets', 'icon.png'));
    if (!dockIcon.isEmpty()) app.dock?.setIcon(dockIcon);
  }
  const root = runtimeRoot();
  userDataRoot = app.getPath('userData');
  locale = await loadLocalePreference(userDataRoot, app.getLocale());
  setMainLocale(locale);
  themes = new ThemeRepository(path.join(userDataRoot, 'themes'), path.join(root, 'themes'));
  await themes.initialize();
  marketplace = new MarketplaceService(themes);
  updates = new UpdateService(app.getVersion(), app.getPath('downloads'));
  codex = new CodexService(root, userDataRoot, themes);
  codex.setLogListener(sendLog);
  await codex.initialize();
  registerIpc();
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
  codex?.shutdown();
});

app.on('window-all-closed', () => {
  // Keep the manager alive in the tray so route changes can be reinjected.
});
