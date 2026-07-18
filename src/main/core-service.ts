// SPDX-License-Identifier: MPL-2.0

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  applySkin,
  discoverApp,
  findRunningPids,
  findTargets,
  getAdapter,
  resolveThemeTarget,
  restoreSkin,
} from '@codedrobe/core';
import type { AppAdapter } from '@codedrobe/core';
import { getMainMessages } from '../shared/i18n';
import {
  APP_IDS,
  type AppId,
  type ApplyRequest,
  type ApplyResponse,
  type AppStatus,
  type Platform,
  type SystemStatus,
} from '../shared/types';
import type { SettingsService } from './settings-service';
import type { ThemeLibrary } from './theme-library';

interface PersistedState {
  version: 2;
  apps: Partial<Record<AppId, { activeThemeId: string | null; port: number }>>;
}

function platform(): Platform {
  return process.platform === 'darwin' || process.platform === 'win32'
    ? process.platform
    : 'unsupported';
}

function isPort(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1024 && (value as number) <= 65535;
}

/**
 * Bridges the renderer to @codedrobe/core: per-app detection, skin apply and
 * restore. All core calls run in the main process (core is ESM + node:*).
 */
export class CoreService {
  private state: PersistedState = { version: 2, apps: {} };
  private logListener: ((line: string) => void) | null = null;

  constructor(
    private readonly library: ThemeLibrary,
    private readonly stateFile: string,
    private readonly settings: SettingsService,
  ) {}

  setLogListener(listener: (line: string) => void): void {
    this.logListener = listener;
  }

  private log(line: string): void {
    this.logListener?.(line);
  }

  async initialize(): Promise<void> {
    try {
      const parsed = JSON.parse(await fs.readFile(this.stateFile, 'utf8')) as PersistedState;
      if (parsed && parsed.version === 2 && parsed.apps && typeof parsed.apps === 'object') {
        this.state = parsed;
      }
    } catch {
      // Fresh install or legacy state — defaults apply.
    }
  }

  private async persist(): Promise<void> {
    await fs.mkdir(path.dirname(this.stateFile), { recursive: true });
    await fs.writeFile(this.stateFile, `${JSON.stringify(this.state, null, 2)}\n`, 'utf8');
  }

  private adapter(appId: AppId): AppAdapter {
    return getAdapter(appId);
  }

  portFor(appId: AppId): number {
    return this.settings.overridesFor(appId).port
      ?? this.state.apps[appId]?.port
      ?? this.adapter(appId).defaultPort;
  }

  defaultPortFor(appId: AppId): number {
    return this.adapter(appId).defaultPort;
  }

  activeThemeId(appId: AppId): string | null {
    return this.state.apps[appId]?.activeThemeId ?? null;
  }

  private async appStatus(appId: AppId): Promise<AppStatus> {
    const adapter = this.adapter(appId);
    const port = this.portFor(appId);
    const override = this.settings.overridesFor(appId);
    let discovered: Awaited<ReturnType<typeof discoverApp>> = null;
    let running = false;
    let debugReady = false;
    try {
      discovered = await discoverApp(adapter, process.platform, override.appPath);
    } catch {
      discovered = null;
    }
    const installed = Boolean(discovered);
    if (installed) {
      try {
        running = (await findRunningPids(adapter, process.platform, discovered?.executable ?? null)).length > 0;
      } catch {
        running = false;
      }
    }
    if (running) {
      try {
        debugReady = (await findTargets(adapter, port, 1200)).length > 0;
      } catch {
        debugReady = false;
      }
    }
    return {
      appId,
      displayName: adapter.displayName,
      installed,
      running,
      debugReady,
      port,
      activeThemeId: this.activeThemeId(appId),
    };
  }

  async status(): Promise<SystemStatus> {
    const apps = await Promise.all(APP_IDS.map((appId) => this.appStatus(appId)));
    return { platform: platform(), apps };
  }

  async apply(request: ApplyRequest): Promise<ApplyResponse> {
    const copy = getMainMessages();
    if (platform() === 'unsupported') throw new Error(copy.unsupportedPlatform);
    const appId = request.appId;
    const adapter = this.adapter(appId);
    const port = request.port ?? this.portFor(appId);
    if (!isPort(port)) throw new Error(copy.invalidCdpPort);

    const entry = await this.library.find(request.themeId);
    const targetTheme = resolveThemeTarget(entry.bundle, appId);

    this.log(`[apply] ${entry.bundle.theme.id} -> ${appId} (port ${port})`);
    try {
      await applySkin({
        adapter,
        targetTheme,
        port,
        launch: true,
        appPath: this.settings.overridesFor(appId).appPath,
        restartExisting: Boolean(request.restartExisting),
      });
    } catch (error) {
      const code = (error as { code?: string }).code;
      const message = error instanceof Error ? error.message : String(error);
      this.log(`[apply] ${appId} failed${code ? ` [${code}]` : ''}: ${message}`);
      if (code === 'CODEDROBE_RESTART_REQUIRED') {
        return {
          status: 'requires-restart',
          message: copy.restartRequiredMessage,
          system: await this.status(),
        };
      }
      // An occupied port is not fixed by restarting the target app, so it must
      // not funnel into the restart dialog.
      if (code === 'CODEDROBE_PORT_OCCUPIED') {
        const occupiedPort = (error as { port?: number }).port ?? port;
        return {
          status: 'port-occupied',
          message: copy.portOccupiedMessage(occupiedPort),
          system: await this.status(),
        };
      }
      throw error;
    }

    this.state.apps[appId] = { activeThemeId: entry.bundle.theme.id, port };
    await this.persist();
    this.log(`[apply] ${entry.bundle.theme.id} applied to ${appId}`);
    return {
      status: 'applied',
      message: copy.themeApplied(entry.bundle.theme.displayName, adapter.displayName),
      system: await this.status(),
    };
  }

  async restore(appId: AppId): Promise<SystemStatus> {
    const adapter = this.adapter(appId);
    const port = this.portFor(appId);
    this.log(`[restore] ${appId} (port ${port})`);
    try {
      await restoreSkin({ adapter, port });
    } catch (error) {
      // Restoring when the app is closed still clears host settings state.
      this.log(`[restore] ${appId}: ${(error as Error).message}`);
    }
    this.state.apps[appId] = { activeThemeId: null, port };
    await this.persist();
    return this.status();
  }

  async restoreAll(): Promise<void> {
    for (const appId of APP_IDS) {
      if (this.activeThemeId(appId)) {
        await this.restore(appId).catch(() => undefined);
      }
    }
  }
}
