// SPDX-License-Identifier: MPL-2.0

import fs from 'node:fs/promises';
import path from 'node:path';
import { APP_IDS, type AppId, type AppOverride, type DesktopSettings } from '../shared/types';

interface PersistedSettings {
  version: 1;
  apps: Partial<Record<AppId, Partial<AppOverride>>>;
}

const EMPTY_OVERRIDE: AppOverride = { appPath: null, port: null };

function isValidPort(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1024 && (value as number) <= 65535;
}

/** User-set detection overrides: manual app paths and debug ports (userData/settings.json). */
export class SettingsService {
  private data: PersistedSettings = { version: 1, apps: {} };

  constructor(private readonly file: string) {}

  async initialize(): Promise<void> {
    try {
      const parsed = JSON.parse(await fs.readFile(this.file, 'utf8')) as PersistedSettings;
      if (parsed && parsed.version === 1 && parsed.apps && typeof parsed.apps === 'object') {
        this.data = parsed;
      }
    } catch {
      // Fresh install — defaults apply.
    }
  }

  private async persist(): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, `${JSON.stringify(this.data, null, 2)}\n`, 'utf8');
  }

  overridesFor(appId: AppId): AppOverride {
    const entry = this.data.apps[appId];
    return {
      appPath: typeof entry?.appPath === 'string' && entry.appPath ? entry.appPath : null,
      port: isValidPort(entry?.port) ? entry.port : null,
    };
  }

  toDto(defaultPorts: Record<AppId, number>): DesktopSettings {
    const apps = {} as Record<AppId, AppOverride>;
    for (const appId of APP_IDS) apps[appId] = this.overridesFor(appId);
    return { apps, defaultPorts };
  }

  async setAppPath(appId: AppId, appPath: string | null): Promise<void> {
    this.data.apps[appId] = { ...EMPTY_OVERRIDE, ...this.data.apps[appId], appPath };
    await this.persist();
  }

  async setAppPort(appId: AppId, port: number | null): Promise<void> {
    if (port !== null && !isValidPort(port)) throw new Error('INVALID_PORT');
    this.data.apps[appId] = { ...EMPTY_OVERRIDE, ...this.data.apps[appId], port };
    await this.persist();
  }
}
