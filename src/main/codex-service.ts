// SPDX-License-Identifier: MPL-2.0

import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { getMainLocale, getMainMessages } from '../shared/i18n';
import type { LaunchRequest, LaunchResponse, Platform, SystemStatus } from '../shared/types';
import type { ThemeRepository } from './theme-repository';
import { runNodeModule, spawnNodeModule } from './runtime-process';

const execFileAsync = promisify(execFile);

interface PersistedState {
  activeThemeId: string | null;
  port: number;
}

export class CodexService {
  private injector: ChildProcessWithoutNullStreams | null = null;
  private activeThemeId: string | null = null;
  private readonly port = 9335;
  private readonly statePath: string;
  private readonly configPath = path.join(os.homedir(), '.codex', 'config.toml');
  private readonly backupPath: string;
  private logListener: ((line: string) => void) | null = null;

  constructor(
    private readonly runtimeRoot: string,
    private readonly userDataRoot: string,
    private readonly themes: ThemeRepository,
  ) {
    this.statePath = path.join(userDataRoot, 'manager-state.json');
    this.backupPath = path.join(userDataRoot, 'config.before-codedrobe.toml');
  }

  setLogListener(listener: (line: string) => void): void {
    this.logListener = listener;
  }

  private log(line: string): void {
    const timeLocale = getMainLocale() === 'en' ? 'en-US' : 'zh-CN';
    const message = `[${new Date().toLocaleTimeString(timeLocale, { hour12: false })}] ${line}`;
    this.logListener?.(message);
    void fs.appendFile(path.join(this.userDataRoot, 'runtime.log'), `${message}\n`).catch(() => undefined);
  }

  private get platform(): Platform {
    return process.platform === 'darwin' || process.platform === 'win32' ? process.platform : 'unsupported';
  }

  private script(name: string): string {
    return path.join(this.runtimeRoot, 'scripts', name);
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.userDataRoot, { recursive: true });
    try {
      const state = JSON.parse(await fs.readFile(this.statePath, 'utf8')) as PersistedState;
      this.activeThemeId = state.activeThemeId ?? null;
    } catch {
      this.activeThemeId = null;
    }
    if (this.activeThemeId) {
      try {
        await this.themes.find(this.activeThemeId);
      } catch {
        // A bundled theme may have been removed by an app update. Restore the
        // original Codex configuration instead of keeping an unusable state.
        this.activeThemeId = null;
        await this.persist();
        await this.restore(true).catch((error) => {
          this.log(getMainMessages().restoreBaseFailed(error instanceof Error ? error.message : String(error)));
        });
      }
    }
    if (this.activeThemeId && await this.debugReady()) {
      try {
        await this.startInjector(this.activeThemeId);
        this.log(getMainMessages().reconnectedTheme(this.activeThemeId));
      } catch (error) {
        this.log(getMainMessages().restoreInjectorFailed(error instanceof Error ? error.message : String(error)));
      }
    }
  }

  private async persist(): Promise<void> {
    const state: PersistedState = { activeThemeId: this.activeThemeId, port: this.port };
    await fs.writeFile(this.statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  }

  private async powershell(command: string): Promise<string> {
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
      windowsHide: true,
      timeout: 15_000,
    });
    return stdout.trim();
  }

  async detectCodexExecutable(): Promise<string | null> {
    if (this.platform === 'darwin') {
      const candidates = [
        '/Applications/ChatGPT.app/Contents/MacOS/ChatGPT',
        path.join(os.homedir(), 'Applications', 'ChatGPT.app', 'Contents', 'MacOS', 'ChatGPT'),
      ];
      for (const candidate of candidates) {
        try { await fs.access(candidate); return candidate; } catch { /* keep looking */ }
      }
      try {
        const { stdout } = await execFileAsync('mdfind', ['kMDItemCFBundleIdentifier == "com.openai.codex"'], { timeout: 5_000 });
        for (const bundle of stdout.split('\n').filter((entry) => entry.endsWith('.app'))) {
          const candidate = path.join(bundle, 'Contents', 'MacOS', 'ChatGPT');
          try { await fs.access(candidate); return candidate; } catch { /* keep looking */ }
        }
      } catch { /* Spotlight can be unavailable or disabled */ }
      return null;
    }
    if (this.platform === 'win32') {
      try {
        const location = await this.powershell("Get-AppxPackage OpenAI.Codex | Sort-Object Version -Descending | Select-Object -First 1 -ExpandProperty InstallLocation");
        return location ? path.join(location, 'app', 'ChatGPT.exe') : null;
      } catch {
        return null;
      }
    }
    return null;
  }

  async isCodexRunning(): Promise<boolean> {
    if (this.platform === 'darwin') {
      try {
        const { stdout } = await execFileAsync('ps', ['-axo', 'command=']);
        return stdout.split('\n').some((line) => /\/ChatGPT\.app\/Contents\/MacOS\/ChatGPT(?:\s|$)/.test(line));
      } catch { return false; }
    }
    if (this.platform === 'win32') {
      try {
        return (await this.powershell("@(Get-Process ChatGPT -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }).Count")) !== '0';
      }
      catch { return false; }
    }
    return false;
  }

  async debugReady(): Promise<boolean> {
    try {
      const response = await fetch(`http://127.0.0.1:${this.port}/json/list`, { signal: AbortSignal.timeout(1_200) });
      if (!response.ok) return false;
      const targets = await response.json() as Array<{ type?: string; url?: string }>;
      return targets.some((target) => target.type === 'page' && target.url?.startsWith('app://'));
    } catch { return false; }
  }

  private async portOccupied(): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = net.createConnection({ host: '127.0.0.1', port: this.port });
      const finish = (value: boolean) => { socket.destroy(); resolve(value); };
      socket.setTimeout(800);
      socket.once('connect', () => finish(true));
      socket.once('timeout', () => finish(false));
      socket.once('error', () => finish(false));
    });
  }

  private async stopCodex(): Promise<void> {
    this.log(getMainMessages().closingCodex);
    if (this.platform === 'darwin') {
      await execFileAsync('osascript', ['-e', 'tell application id "com.openai.codex" to quit']).catch(() => undefined);
      for (let attempt = 0; attempt < 24 && await this.isCodexRunning(); attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      if (await this.isCodexRunning()) {
        await execFileAsync('pkill', ['-f', '/ChatGPT\\.app/Contents/MacOS/ChatGPT']).catch(() => undefined);
      }
    } else if (this.platform === 'win32') {
      await this.powershell("Get-Process ChatGPT -ErrorAction SilentlyContinue | ForEach-Object { [void]$_.CloseMainWindow() }; Start-Sleep -Seconds 2; Get-Process ChatGPT -ErrorAction SilentlyContinue | Stop-Process -Force");
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  private launchCodex(executable: string): void {
    const child = spawn(executable, [
      '--remote-debugging-address=127.0.0.1',
      `--remote-debugging-port=${this.port}`,
    ], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();
  }

  private async waitForDebugPort(): Promise<void> {
    for (let attempt = 0; attempt < 75; attempt += 1) {
      if (await this.debugReady()) return;
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    throw new Error(getMainMessages().debugPortTimeout);
  }

  private stopInjector(): void {
    if (!this.injector) return;
    this.injector.kill();
    this.injector = null;
  }

  private async startInjector(themeId: string): Promise<void> {
    this.stopInjector();
    const theme = await this.themes.find(themeId);
    const child = spawnNodeModule(this.script('injector.mjs'), [
      '--watch', '--port', String(this.port), '--theme', theme.manifestPath,
    ]);
    this.injector = child;
    child.stdout.on('data', (chunk) => this.log(chunk.toString().trim()));
    child.stderr.on('data', (chunk) => this.log(chunk.toString().trim()));
    child.on('exit', (code) => {
      if (this.injector === child) this.injector = null;
      this.log(getMainMessages().injectorExited(code ?? 'unknown'));
    });
    await new Promise((resolve) => setTimeout(resolve, 700));
    if (child.exitCode !== null) throw new Error(getMainMessages().injectorStartFailed);
  }

  private async applyBaseTheme(manifestPath: string): Promise<void> {
    const result = await runNodeModule(this.script('theme-tool.mjs'), [
      'apply', '--theme', manifestPath, '--platform', process.platform,
      '--config', this.configPath, '--backup', this.backupPath,
    ]);
    if (result.code !== 0) throw new Error(result.stderr.trim() || getMainMessages().baseThemeFailed);
  }

  private async verifyTheme(manifestPath: string): Promise<void> {
    const result = await runNodeModule(this.script('injector.mjs'), [
      '--verify', '--port', String(this.port), '--theme', manifestPath, '--timeout-ms', '8000',
    ], 12_000);
    if (result.code !== 0) throw new Error(result.stderr.trim() || getMainMessages().verifyFailed);
  }

  async launch(request: LaunchRequest): Promise<LaunchResponse> {
    const copy = getMainMessages();
    if (this.platform === 'unsupported') throw new Error(copy.unsupportedPlatform);
    const theme = await this.themes.find(request.themeId);
    const executable = await this.detectCodexExecutable();
    if (!executable) throw new Error(copy.codexNotFound);
    const debugReady = await this.debugReady();
    const running = await this.isCodexRunning();
    if (running && !debugReady && !request.restartExisting) {
      return {
        status: 'requires-restart',
        message: copy.restartRequired,
        system: await this.status(),
      };
    }

    this.log(copy.preparingTheme(theme.manifest.displayName));
    await this.applyBaseTheme(theme.manifestPath);
    if (running && !debugReady) await this.stopCodex();
    if (!await this.debugReady()) {
      if (await this.portOccupied()) throw new Error(copy.portOccupied(this.port));
      this.log(copy.startingCodex);
      this.launchCodex(executable);
      await this.waitForDebugPort();
    }
    await this.startInjector(theme.manifest.id);
    await this.verifyTheme(theme.manifestPath);
    this.activeThemeId = theme.manifest.id;
    await this.persist();
    this.log(copy.themeActive(theme.manifest.displayName));
    return {
      status: 'started',
      message: copy.themeApplied(theme.manifest.displayName),
      system: await this.status(),
    };
  }

  async restore(restoreBaseTheme = false): Promise<SystemStatus> {
    this.stopInjector();
    if (await this.debugReady()) {
      await runNodeModule(this.script('injector.mjs'), [
        '--remove', '--port', String(this.port), '--timeout-ms', '4000',
      ], 6_000).catch(() => undefined);
    }
    if (restoreBaseTheme) {
      try {
        const result = await runNodeModule(this.script('theme-tool.mjs'), [
          'restore', '--config', this.configPath, '--backup', this.backupPath,
        ]);
        if (result.code !== 0) throw new Error(result.stderr);
      } catch (error) {
        throw new Error(getMainMessages().restoreBaseFailed(error instanceof Error ? error.message : String(error)));
      }
    }
    this.activeThemeId = null;
    await this.persist();
    this.log(getMainMessages().restoredNative);
    return this.status();
  }

  async status(): Promise<SystemStatus> {
    const [codexExecutable, codexRunning, debugReady] = await Promise.all([
      this.detectCodexExecutable(), this.isCodexRunning(), this.debugReady(),
    ]);
    return {
      platform: this.platform,
      codexInstalled: Boolean(codexExecutable),
      codexRunning,
      debugReady,
      injectorRunning: Boolean(this.injector && this.injector.exitCode === null),
      activeThemeId: this.activeThemeId,
      port: this.port,
    };
  }

  shutdown(): void {
    this.stopInjector();
  }
}
