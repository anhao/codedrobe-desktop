// SPDX-License-Identifier: MPL-2.0

import type { AppLocale } from './i18n';

export type Platform = 'darwin' | 'win32' | 'unsupported';
export type ThemeSource = 'builtin' | 'imported';

export interface ThemeCopy {
  brandTitle?: string;
  brandSubtitle?: string;
  signature?: string;
  tagline?: string;
  projectPrefix?: string;
  projectLabel?: string;
  ribbon?: string;
}

export interface ThemeBase {
  mode?: string;
  codeTheme?: string;
  accent?: string;
  contrast?: number;
  ink?: string;
  surface?: string;
  opaqueWindows?: boolean;
  fonts?: Record<string, string>;
  semanticColors?: Record<string, string>;
}

export interface ThemeManifest {
  schemaVersion: 1;
  id: string;
  displayName: string;
  version: string;
  css: string;
  art?: string | null;
  copy?: ThemeCopy;
  baseTheme?: ThemeBase;
}

export interface ThemeSummary {
  id: string;
  displayName: string;
  version: string;
  source: ThemeSource;
  artDataUrl: string | null;
  accent: string;
  ink: string;
  surface: string;
  tagline: string;
}

export interface SystemStatus {
  platform: Platform;
  codexInstalled: boolean;
  codexRunning: boolean;
  debugReady: boolean;
  injectorRunning: boolean;
  activeThemeId: string | null;
  port: number;
}

export interface BootstrapData {
  themes: ThemeSummary[];
  status: SystemStatus;
  locale: AppLocale;
  appVersion: string;
}

export interface LocalizedText {
  en: string;
  zh: string;
}

export interface MarketplaceCategory {
  id: string;
  slug: string;
  name: LocalizedText;
  description: LocalizedText;
  themeCount: number;
}

export interface MarketplaceThemeCategory {
  slug: string;
  name: LocalizedText;
  primary: boolean;
}

export interface MarketplaceTheme {
  id: string;
  slug: string;
  name: LocalizedText;
  description: LocalizedText;
  version: string;
  categories: MarketplaceThemeCategory[];
  previewUrl: string;
  downloadUrl: string;
  price: {
    currency: string;
    unitAmount: number;
    free: boolean;
  };
  package: {
    sizeBytes: number;
    sha256: string;
  };
  publishedAt: string;
}

export interface MarketplaceData {
  categories: MarketplaceCategory[];
  themes: MarketplaceTheme[];
}

export interface MarketplaceInstallResult {
  theme: ThemeSummary;
  themes: ThemeSummary[];
}

export interface UpdateAsset {
  name: string;
  url: string;
  sizeBytes: number;
  sha256: string | null;
}

export interface UpdateInfo {
  status: 'up-to-date' | 'available' | 'unavailable';
  currentVersion: string;
  latestVersion: string | null;
  releaseUrl: string | null;
  asset: UpdateAsset | null;
  checkedAt: string;
  message?: string;
}

export interface UpdateDownloadResult {
  path: string;
  assetName: string;
}

export interface LaunchRequest {
  themeId: string;
  restartExisting?: boolean;
}

export interface LaunchResponse {
  status: 'started' | 'requires-restart';
  message: string;
  system: SystemStatus;
}

export interface RestoreRequest {
  restoreBaseTheme?: boolean;
}

export interface DialogResult {
  canceled: boolean;
  path?: string;
  theme?: ThemeSummary;
}

export interface DeleteThemeResult {
  themes: ThemeSummary[];
  status: SystemStatus;
}

export interface CodeDrobeApi {
  getBootstrap(): Promise<BootstrapData>;
  setLocale(locale: AppLocale): Promise<void>;
  refreshStatus(): Promise<SystemStatus>;
  launchTheme(request: LaunchRequest): Promise<LaunchResponse>;
  restore(request?: RestoreRequest): Promise<SystemStatus>;
  importTheme(): Promise<DialogResult>;
  exportTheme(themeId: string): Promise<DialogResult>;
  deleteTheme(themeId: string): Promise<DeleteThemeResult>;
  getMarketplace(category?: string): Promise<MarketplaceData>;
  installMarketplaceTheme(slug: string): Promise<MarketplaceInstallResult>;
  checkForUpdates(): Promise<UpdateInfo>;
  downloadUpdate(): Promise<UpdateDownloadResult>;
  openUpdateRelease(url: string): Promise<void>;
  showInFolder(path: string): Promise<void>;
  onRuntimeLog(listener: (line: string) => void): () => void;
  onUpdateDownloadProgress(listener: (progress: number) => void): () => void;
}

export interface ThemePackage {
  format: 'codex-theme';
  schemaVersion: 1;
  exportedAt: string;
  manifest: ThemeManifest;
  css: string;
  art?: {
    filename: string;
    mimeType: string;
    base64: string;
  };
}
