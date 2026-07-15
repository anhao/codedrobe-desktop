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
  showInFolder: (itemPath: string) => ipcRenderer.invoke('shell:show-item', itemPath),
  onRuntimeLog: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, line: string) => listener(line);
    ipcRenderer.on('runtime:log', handler);
    return () => ipcRenderer.removeListener('runtime:log', handler);
  },
};

contextBridge.exposeInMainWorld('codeDrobe', api);
