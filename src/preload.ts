// SPDX-License-Identifier: MPL-2.0

import { contextBridge, ipcRenderer } from 'electron';
import type { AppLocale } from './shared/i18n';
import type { CodeDrobeApi, LaunchRequest, RestoreRequest } from './shared/types';

const api: CodeDrobeApi = {
  getBootstrap: () => ipcRenderer.invoke('app:bootstrap'),
  setLocale: (locale: AppLocale) => ipcRenderer.invoke('locale:set', locale),
  refreshStatus: () => ipcRenderer.invoke('system:status'),
  launchTheme: (request: LaunchRequest) => ipcRenderer.invoke('theme:launch', request),
  restore: (request?: RestoreRequest) => ipcRenderer.invoke('theme:restore', request),
  importTheme: () => ipcRenderer.invoke('theme:import'),
  exportTheme: (themeId: string) => ipcRenderer.invoke('theme:export', themeId),
  deleteTheme: (themeId: string) => ipcRenderer.invoke('theme:delete', themeId),
  getMarketplace: (category?: string) => ipcRenderer.invoke('marketplace:list', category),
  installMarketplaceTheme: (slug: string) => ipcRenderer.invoke('marketplace:install', slug),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  downloadUpdate: () => ipcRenderer.invoke('updates:download'),
  openUpdateRelease: (url: string) => ipcRenderer.invoke('updates:open-release', url),
  showInFolder: (itemPath: string) => ipcRenderer.invoke('shell:show-item', itemPath),
  onRuntimeLog: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, line: string) => listener(line);
    ipcRenderer.on('runtime:log', handler);
    return () => ipcRenderer.removeListener('runtime:log', handler);
  },
  onUpdateDownloadProgress: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: number) => listener(progress);
    ipcRenderer.on('updates:progress', handler);
    return () => ipcRenderer.removeListener('updates:progress', handler);
  },
};

contextBridge.exposeInMainWorld('codeDrobe', api);
