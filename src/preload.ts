// SPDX-License-Identifier: MPL-2.0

import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { AppLocale } from './shared/i18n';
import type {
  AppId,
  ApplyRequest,
  CodeDrobeApi,
  DeepLinkApplyRequest,
  FileImportConfirmRequest,
  FileImportResult,
  MarketplaceQuery,
} from './shared/types';

function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, payload: T) => listener(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

const api: CodeDrobeApi = {
  getBootstrap: () => ipcRenderer.invoke('app:bootstrap'),
  setLocale: (locale: AppLocale) => ipcRenderer.invoke('locale:set', locale),
  refreshStatus: () => ipcRenderer.invoke('system:status'),
  applyTheme: (request: ApplyRequest) => ipcRenderer.invoke('theme:apply', request),
  restoreApp: (appId: AppId) => ipcRenderer.invoke('theme:restore', appId),
  importTheme: () => ipcRenderer.invoke('theme:import'),
  importThemeFromPath: (path: string) => ipcRenderer.invoke('theme:import-path', path),
  openThemeFile: (path: string) => ipcRenderer.invoke('theme:open-file', path),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  exportTheme: (themeId: string) => ipcRenderer.invoke('theme:export', themeId),
  deleteTheme: (themeId: string) => ipcRenderer.invoke('theme:delete', themeId),
  listMarketplace: (query?: MarketplaceQuery) => ipcRenderer.invoke('marketplace:list', query),
  listMarketplaceCategories: () => ipcRenderer.invoke('marketplace:categories'),
  getMarketplaceTheme: (slug: string) => ipcRenderer.invoke('marketplace:get', slug),
  installMarketplaceTheme: (slug: string) => ipcRenderer.invoke('marketplace:install', slug),
  setThemeLike: (slug: string, liked: boolean) => ipcRenderer.invoke('marketplace:like', slug, liked),
  authLogin: () => ipcRenderer.invoke('auth:login'),
  authLoginOpenBrowser: () => ipcRenderer.invoke('auth:login-open'),
  authLoginCancel: () => ipcRenderer.invoke('auth:login-cancel'),
  authLogout: () => ipcRenderer.invoke('auth:logout'),
  authStatus: () => ipcRenderer.invoke('auth:status'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  pickAppPath: (appId: AppId) => ipcRenderer.invoke('settings:pick-app-path', appId),
  clearAppPath: (appId: AppId) => ipcRenderer.invoke('settings:clear-app-path', appId),
  setAppPort: (appId: AppId, port: number | null) => ipcRenderer.invoke('settings:set-app-port', appId, port),
  openXShare: (text: string) => ipcRenderer.invoke('share:x', text),
  openWebPage: (page: 'privacy' | 'terms' | 'account') => ipcRenderer.invoke('web:open-page', page),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  downloadUpdate: () => ipcRenderer.invoke('updates:download'),
  installUpdate: () => ipcRenderer.invoke('updates:install'),
  openUpdateRelease: (url: string) => ipcRenderer.invoke('updates:open-release', url),
  showInFolder: (itemPath: string) => ipcRenderer.invoke('shell:show-item', itemPath),
  onRuntimeLog: (listener) => subscribe<string>('runtime:log', listener),
  onAuthLoginUrl: (listener) => subscribe<string>('auth:login-url', listener),
  onUpdateDownloadProgress: (listener) => subscribe<number>('updates:progress', listener),
  onDeepLinkApply: (listener) => subscribe<DeepLinkApplyRequest>('deeplink:apply', listener),
  onFileImported: (listener) => subscribe<FileImportResult>('file:imported', listener),
  onFileImportConfirm: (listener) => subscribe<FileImportConfirmRequest>('file:import-confirm', listener),
  onFileImportFailed: (listener) => subscribe<string>('file:import-failed', listener),
};

contextBridge.exposeInMainWorld('codeDrobe', api);
