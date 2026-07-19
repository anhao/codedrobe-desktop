// SPDX-License-Identifier: MPL-2.0

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  convertLegacyThemeFile,
  readThemePackage,
  validateThemePackage,
  LEGACY_THEME_EXTENSION,
  THEME_EXTENSION,
} from '@codedrobe/core';
import type { ThemePackage } from '@codedrobe/core';
import { getMainLocale, getMainMessages } from '../shared/i18n';
import { isAppId, type AppId, type InstalledTheme } from '../shared/types';

const SAFE_ID = /^[a-z0-9][a-z0-9_-]*$/i;

export interface ThemeEntry {
  bundle: ThemePackage;
  filePath: string;
}

export interface PackageInspection {
  incoming: InstalledTheme;
  /** The installed theme this import would replace, when the id is taken. */
  existing: InstalledTheme | null;
}

function coverDataUrl(bundle: ThemePackage): string | null {
  const image = bundle.assets?.images?.hero ?? bundle.assets?.art ?? null;
  if (!image?.base64) return null;
  return `data:${image.mimeType || 'image/png'};base64,${image.base64}`;
}

function supportedApps(bundle: ThemePackage): AppId[] {
  return Object.keys(bundle.targets).filter(isAppId);
}

export function toInstalledTheme(entry: ThemeEntry): InstalledTheme {
  const { bundle } = entry;
  const tagline = bundle.theme.copy && typeof bundle.theme.copy.tagline === 'string'
    ? bundle.theme.copy.tagline
    : null;
  return {
    id: bundle.theme.id,
    displayName: bundle.theme.displayName,
    version: bundle.theme.version,
    supportedApps: supportedApps(bundle),
    coverDataUrl: coverDataUrl(bundle),
    tagline,
  };
}

/**
 * Installed themes are stored as raw `.codedrobe-theme` package files under
 * userData/themes. Reads always revalidate through @codedrobe/core.
 */
export class ThemeLibrary {
  constructor(private readonly root: string) {}

  async initialize(): Promise<void> {
    await fs.mkdir(this.root, { recursive: true });
    await this.migrateLegacyDirectories();
  }

  /**
   * Pre-rewrite installs stored unpacked legacy codex-theme directories
   * (manifest.json + theme.css + art). Convert each one to a codedrobe-theme
   * package once; failures keep the directory untouched.
   */
  private async migrateLegacyDirectories(): Promise<void> {
    const entries = await fs.readdir(this.root, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const directory = path.join(this.root, entry.name);
      try {
        const manifestRaw = await fs.readFile(path.join(directory, 'manifest.json'), 'utf8');
        const manifest = JSON.parse(manifestRaw) as {
          id?: string; css?: string; art?: string | null;
        };
        if (!manifest.id || !manifest.css) continue;
        const css = await fs.readFile(path.join(directory, manifest.css), 'utf8');
        const legacyBundle: Record<string, unknown> = {
          format: 'codex-theme',
          schemaVersion: 1,
          manifest: { ...manifest, css: 'theme.css' },
          css,
        };
        if (manifest.art) {
          const artPath = path.join(directory, manifest.art);
          const bytes = await fs.readFile(artPath);
          const ext = path.extname(artPath).toLowerCase();
          legacyBundle.art = {
            filename: path.basename(artPath),
            mimeType: ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
              : ext === '.webp' ? 'image/webp'
                : ext === '.gif' ? 'image/gif' : 'image/png',
            base64: bytes.toString('base64'),
          };
        }
        const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'codedrobe-migrate-'));
        try {
          const legacyFile = path.join(temporary, `${manifest.id}.codex-theme`);
          await fs.writeFile(legacyFile, JSON.stringify(legacyBundle), 'utf8');
          const converted = path.join(temporary, `${manifest.id}${THEME_EXTENSION}`);
          await convertLegacyThemeFile(legacyFile, converted, { force: true });
          await this.installFile(converted);
          await fs.rm(directory, { recursive: true, force: true });
          console.info(`[themes] migrated legacy theme ${manifest.id}`);
        } finally {
          await fs.rm(temporary, { recursive: true, force: true });
        }
      } catch (error) {
        console.warn(`[themes] legacy migration skipped for ${entry.name}:`, error);
      }
    }
  }

  private packagePath(themeId: string): string {
    if (!SAFE_ID.test(themeId)) throw new Error(getMainMessages().manifestInvalidId);
    return path.join(this.root, `${themeId}${THEME_EXTENSION}`);
  }

  async entries(): Promise<ThemeEntry[]> {
    const sortLocale = getMainLocale() === 'en' ? 'en-US' : 'zh-CN';
    const files = await fs.readdir(this.root, { withFileTypes: true }).catch(() => []);
    const result: ThemeEntry[] = [];
    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith(THEME_EXTENSION)) continue;
      const filePath = path.join(this.root, file.name);
      try {
        result.push({ bundle: await readThemePackage(filePath), filePath });
      } catch (error) {
        console.warn(`[themes] skipped invalid package ${file.name}:`, error);
      }
    }
    return result.sort((a, b) =>
      a.bundle.theme.displayName.localeCompare(b.bundle.theme.displayName, sortLocale));
  }

  async summaries(): Promise<InstalledTheme[]> {
    return (await this.entries()).map(toInstalledTheme);
  }

  async find(themeId: string): Promise<ThemeEntry> {
    const filePath = this.packagePath(themeId);
    try {
      return { bundle: await readThemePackage(filePath), filePath };
    } catch {
      throw new Error(getMainMessages().themeNotFound(themeId));
    }
  }

  /** Validate and copy a .codedrobe-theme file into the library (atomic replace). */
  async installFile(sourcePath: string): Promise<InstalledTheme> {
    const bundle = await readThemePackage(sourcePath);
    const destination = this.packagePath(bundle.theme.id);
    const temporary = `${destination}.installing-${Date.now()}`;
    await fs.copyFile(sourcePath, temporary);
    await fs.rename(temporary, destination);
    return toInstalledTheme({ bundle, filePath: destination });
  }

  /** Install from in-memory bytes (marketplace downloads). */
  async installBytes(bytes: Buffer, suggestedId: string): Promise<InstalledTheme> {
    const parsed = JSON.parse(bytes.toString('utf8')) as unknown;
    const bundle = validateThemePackage(parsed);
    if (!SAFE_ID.test(bundle.theme.id)) throw new Error(getMainMessages().manifestInvalidId);
    const destination = this.packagePath(bundle.theme.id || suggestedId);
    const temporary = `${destination}.installing-${Date.now()}`;
    await fs.writeFile(temporary, bytes);
    await fs.rename(temporary, destination);
    return toInstalledTheme({ bundle, filePath: destination });
  }

  /**
   * Run `use` with a path to a valid codedrobe-theme file. Legacy .codex-theme
   * files are converted into a temp file that lives for the duration of `use`.
   */
  private async withNormalizedPackage<T>(
    sourcePath: string,
    use: (packagePath: string) => Promise<T>,
  ): Promise<T> {
    if (sourcePath.endsWith(THEME_EXTENSION)) {
      return use(sourcePath);
    }
    if (sourcePath.endsWith(LEGACY_THEME_EXTENSION)) {
      const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'codedrobe-convert-'));
      try {
        const converted = path.join(temporary, `converted${THEME_EXTENSION}`);
        await convertLegacyThemeFile(sourcePath, converted, { force: true });
        return await use(converted);
      } finally {
        await fs.rm(temporary, { recursive: true, force: true });
      }
    }
    throw new Error(getMainMessages().invalidPackage);
  }

  /**
   * Import a user-picked package. Legacy .codex-theme files are converted to
   * the codedrobe-theme format on the way in.
   */
  async importPackage(sourcePath: string): Promise<InstalledTheme> {
    return this.withNormalizedPackage(sourcePath, (packagePath) => this.installFile(packagePath));
  }

  /**
   * Validate a package and report what importing it would do, without touching
   * the library. Used by file-open auto-import to decide between installing
   * directly and asking the user to confirm a replacement.
   */
  async inspectPackage(sourcePath: string): Promise<PackageInspection> {
    return this.withNormalizedPackage(sourcePath, async (packagePath) => {
      const bundle = await readThemePackage(packagePath);
      if (!SAFE_ID.test(bundle.theme.id)) throw new Error(getMainMessages().manifestInvalidId);
      const incoming = toInstalledTheme({ bundle, filePath: sourcePath });
      let existing: InstalledTheme | null = null;
      try {
        existing = toInstalledTheme(await this.find(bundle.theme.id));
      } catch {
        existing = null;
      }
      return { incoming, existing };
    });
  }

  async exportPackage(themeId: string, destination: string): Promise<void> {
    const entry = await this.find(themeId);
    await fs.copyFile(entry.filePath, destination);
  }

  async delete(themeId: string): Promise<void> {
    await fs.rm(this.packagePath(themeId), { force: true });
  }
}
