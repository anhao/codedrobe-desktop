// SPDX-License-Identifier: MPL-2.0

import type { AppLocale } from './i18n';

export type Platform = 'darwin' | 'win32' | 'unsupported';

/** Platform-registered target applications (mirrors @codedrobe/core adapters). */
export type AppId = 'codex' | 'workbuddy';
export const APP_IDS: readonly AppId[] = ['codex', 'workbuddy'];

export function isAppId(value: unknown): value is AppId {
  return typeof value === 'string' && (APP_IDS as readonly string[]).includes(value);
}

export interface LocalizedText {
  en: string;
  zh: string;
}

// --- Installed themes (codedrobe-theme packages under userData/themes) ---

export interface InstalledTheme {
  id: string;
  displayName: string;
  version: string;
  supportedApps: AppId[];
  coverDataUrl: string | null;
  tagline: string | null;
}

// --- System / app status ---

export interface AppStatus {
  appId: AppId;
  displayName: string;
  installed: boolean;
  running: boolean;
  debugReady: boolean;
  port: number;
  activeThemeId: string | null;
}

export interface SystemStatus {
  platform: Platform;
  apps: AppStatus[];
}

// --- Auth ---

export interface AuthUserInfo {
  name: string | null;
  email: string | null;
  handle: string | null;
  avatarUrl: string | null;
}

export type AuthState =
  | { loggedIn: false }
  | { loggedIn: true; user: AuthUserInfo; scopes: string[] };

// --- Marketplace (docs/marketplace-api-contract.md) ---

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

export interface MarketplaceAuthor {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface MarketplaceTheme {
  id: string;
  slug: string;
  name: LocalizedText;
  description: { en: string | null; zh: string | null };
  version: string;
  categories: MarketplaceThemeCategory[];
  previewUrl: string;
  coverUrl: string | null;
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
  supportedApps: AppId[];
  author: MarketplaceAuthor | null;
  likeCount: number;
  downloadCount: number;
  likedByMe?: boolean;
}

export type MarketplaceSort = 'newest' | 'name' | 'downloads' | 'likes';

export interface MarketplaceQuery {
  app?: AppId;
  category?: string;
  q?: string;
  sort?: MarketplaceSort;
  cursor?: string;
  limit?: number;
  /** Only themes the signed-in user liked (requires auth). */
  liked?: boolean;
}

export interface MarketplacePage {
  themes: MarketplaceTheme[];
  total: number;
  nextCursor: string | null;
}

export interface MarketplaceInstallResult {
  theme: InstalledTheme;
  themes: InstalledTheme[];
}

export interface LikeResult {
  likeCount: number;
  likedByMe: boolean;
}

// --- Apply / restore ---

export interface ApplyRequest {
  themeId: string;
  appId: AppId;
  port?: number;
  restartExisting?: boolean;
}

export interface ApplyResponse {
  status: 'applied' | 'requires-restart';
  message: string;
  system: SystemStatus;
}

// --- Deep links (codedrobe://themes/apply?...) ---

export interface DeepLinkApplyRequest {
  slug: string;
  version: string | null;
  appId: AppId;
}

// --- Desktop settings (userData/settings.json) ---

export interface AppOverride {
  /** Manual install location when auto-detection fails (mainly Windows). */
  appPath: string | null;
  /** Debug-port override when the adapter default is occupied. */
  port: number | null;
}

export interface DesktopSettings {
  apps: Record<AppId, AppOverride>;
  defaultPorts: Record<AppId, number>;
}

export interface SettingsUpdateResult {
  settings: DesktopSettings;
  status: SystemStatus;
}

// --- Updates ---

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

// --- IPC results ---

export interface BootstrapData {
  themes: InstalledTheme[];
  status: SystemStatus;
  locale: AppLocale;
  appVersion: string;
  auth: AuthState;
  /** Website origin used to build shareable theme links. */
  webBaseUrl: string;
}

export interface DialogResult {
  canceled: boolean;
  path?: string;
  theme?: InstalledTheme;
}

export interface DeleteThemeResult {
  themes: InstalledTheme[];
  status: SystemStatus;
}

// --- contextBridge surface ---

export interface CodeDrobeApi {
  getBootstrap(): Promise<BootstrapData>;
  setLocale(locale: AppLocale): Promise<void>;
  refreshStatus(): Promise<SystemStatus>;
  applyTheme(request: ApplyRequest): Promise<ApplyResponse>;
  restoreApp(appId: AppId): Promise<SystemStatus>;
  importTheme(): Promise<DialogResult>;
  exportTheme(themeId: string): Promise<DialogResult>;
  deleteTheme(themeId: string): Promise<DeleteThemeResult>;
  listMarketplace(query?: MarketplaceQuery): Promise<MarketplacePage>;
  listMarketplaceCategories(): Promise<MarketplaceCategory[]>;
  getMarketplaceTheme(slug: string): Promise<MarketplaceTheme>;
  installMarketplaceTheme(slug: string): Promise<MarketplaceInstallResult>;
  setThemeLike(slug: string, liked: boolean): Promise<LikeResult>;
  authLogin(): Promise<AuthState>;
  authLoginOpenBrowser(): Promise<void>;
  authLoginCancel(): Promise<void>;
  authLogout(): Promise<AuthState>;
  authStatus(): Promise<AuthState>;
  getSettings(): Promise<DesktopSettings>;
  pickAppPath(appId: AppId): Promise<SettingsUpdateResult & { canceled: boolean }>;
  clearAppPath(appId: AppId): Promise<SettingsUpdateResult>;
  setAppPort(appId: AppId, port: number | null): Promise<SettingsUpdateResult>;
  openXShare(text: string): Promise<void>;
  openWebPage(page: 'privacy' | 'terms' | 'account'): Promise<void>;
  checkForUpdates(): Promise<UpdateInfo>;
  downloadUpdate(): Promise<UpdateDownloadResult>;
  openUpdateRelease(url: string): Promise<void>;
  showInFolder(path: string): Promise<void>;
  onRuntimeLog(listener: (line: string) => void): () => void;
  onAuthLoginUrl(listener: (url: string) => void): () => void;
  onUpdateDownloadProgress(listener: (progress: number) => void): () => void;
  onDeepLinkApply(listener: (request: DeepLinkApplyRequest) => void): () => void;
}
