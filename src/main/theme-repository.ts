// SPDX-License-Identifier: MPL-2.0

import fs from 'node:fs/promises';
import path from 'node:path';
import { getMainLocale, getMainMessages } from '../shared/i18n';
import type { ThemeManifest, ThemePackage, ThemeSummary } from '../shared/types';

const MAX_PACKAGE_BYTES = 30 * 1024 * 1024;
const SAFE_ID = /^[a-z0-9][a-z0-9_-]*$/i;
const REMOTE_CSS = /@import\s|url\(\s*["']?(?!data:)/i;

export interface ThemeRecord {
  manifest: ThemeManifest;
  manifestPath: string;
  source: 'builtin' | 'imported';
}

function assertManifest(value: unknown): asserts value is ThemeManifest {
  const copy = getMainMessages();
  if (!value || typeof value !== 'object') throw new Error(copy.manifestInvalidObject);
  const manifest = value as Partial<ThemeManifest>;
  if (manifest.schemaVersion !== 1) throw new Error(copy.manifestUnsupportedVersion);
  if (!manifest.id || !SAFE_ID.test(manifest.id)) throw new Error(copy.manifestInvalidId);
  if (!manifest.displayName?.trim()) throw new Error(copy.manifestMissingName);
  if (!manifest.version?.trim()) throw new Error(copy.manifestMissingVersion);
  if (!manifest.css?.trim()) throw new Error(copy.manifestMissingCss);
}

function mimeTypeFor(file: string): string {
  switch (path.extname(file).toLowerCase()) {
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.webp': return 'image/webp';
    case '.gif': return 'image/gif';
    default: return 'image/png';
  }
}

function safeAssetName(filename: string, fallback: string): string {
  const basename = path.basename(filename).replace(/[^a-z0-9._-]/gi, '-');
  return basename || fallback;
}

function safeColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-f]{3,8}$/i.test(value) ? value : fallback;
}

export class ThemeRepository {
  constructor(
    private readonly userRoot: string,
    private readonly builtinRoot?: string,
  ) {}

  async initialize(): Promise<void> {
    await fs.mkdir(this.userRoot, { recursive: true });
  }

  private async readManifest(manifestPath: string, source: ThemeRecord['source']): Promise<ThemeRecord> {
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as unknown;
    assertManifest(manifest);
    const cssPath = path.resolve(path.dirname(manifestPath), manifest.css);
    const css = await fs.readFile(cssPath, 'utf8');
    if (REMOTE_CSS.test(css)) throw new Error(getMainMessages().themeRemoteCss(manifest.id));
    if (manifest.art) await fs.access(path.resolve(path.dirname(manifestPath), manifest.art));
    return { manifest, manifestPath, source };
  }

  private async builtinRecords(): Promise<ThemeRecord[]> {
    if (!this.builtinRoot) return [];
    const entries = await fs.readdir(this.builtinRoot, { withFileTypes: true }).catch(() => []);
    const records: ThemeRecord[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || path.extname(entry.name) !== '.json') continue;
      try {
        records.push(await this.readManifest(path.join(this.builtinRoot, entry.name), 'builtin'));
      } catch (error) {
        console.warn(`[themes] skipped builtin theme ${entry.name}:`, error);
      }
    }
    return records;
  }

  private async importedRecords(): Promise<ThemeRecord[]> {
    const entries = await fs.readdir(this.userRoot, { withFileTypes: true });
    const records: ThemeRecord[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        records.push(await this.readManifest(path.join(this.userRoot, entry.name, 'manifest.json'), 'imported'));
      } catch (error) {
        console.warn(`[themes] skipped imported theme ${entry.name}:`, error);
      }
    }
    return records;
  }

  async records(): Promise<ThemeRecord[]> {
    const sortLocale = getMainLocale() === 'en' ? 'en-US' : 'zh-CN';
    const byId = new Map((await this.builtinRecords()).map((record) => [record.manifest.id, record]));
    for (const record of await this.importedRecords()) byId.set(record.manifest.id, record);
    return [...byId.values()]
      .sort((a, b) => a.manifest.displayName.localeCompare(b.manifest.displayName, sortLocale));
  }

  async find(themeId: string): Promise<ThemeRecord> {
    const record = (await this.records()).find((candidate) => candidate.manifest.id === themeId);
    if (!record) throw new Error(getMainMessages().themeNotFound(themeId));
    return record;
  }

  async summary(record: ThemeRecord): Promise<ThemeSummary> {
    const { manifest } = record;
    let artDataUrl: string | null = null;
    if (manifest.art) {
      const artPath = path.resolve(path.dirname(record.manifestPath), manifest.art);
      const data = await fs.readFile(artPath);
      artDataUrl = `data:${mimeTypeFor(artPath)};base64,${data.toString('base64')}`;
    }
    return {
      id: manifest.id,
      displayName: manifest.displayName,
      version: manifest.version,
      source: record.source,
      artDataUrl,
      accent: safeColor(manifest.baseTheme?.accent, '#9f6fef'),
      ink: safeColor(manifest.baseTheme?.ink, '#261c2d'),
      surface: safeColor(manifest.baseTheme?.surface, '#f7f1f8'),
      tagline: typeof manifest.copy?.tagline === 'string' ? manifest.copy.tagline : getMainMessages().defaultThemeTagline,
    };
  }

  async summaries(): Promise<ThemeSummary[]> {
    return Promise.all((await this.records()).map((record) => this.summary(record)));
  }

  async exportPackage(themeId: string): Promise<ThemePackage> {
    const record = await this.find(themeId);
    const base = path.dirname(record.manifestPath);
    const css = await fs.readFile(path.resolve(base, record.manifest.css), 'utf8');
    const packageManifest: ThemeManifest = { ...record.manifest, css: 'theme.css' };
    let art: ThemePackage['art'];
    if (record.manifest.art) {
      const artPath = path.resolve(base, record.manifest.art);
      const filename = safeAssetName(record.manifest.art, 'art.png');
      art = {
        filename,
        mimeType: mimeTypeFor(artPath),
        base64: (await fs.readFile(artPath)).toString('base64'),
      };
      packageManifest.art = filename;
    } else {
      packageManifest.art = null;
    }
    return {
      format: 'codex-theme',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      manifest: packageManifest,
      css,
      art,
    };
  }

  async importPackage(packagePath: string): Promise<ThemeSummary> {
    const stat = await fs.stat(packagePath);
    const copy = getMainMessages();
    if (stat.size > MAX_PACKAGE_BYTES) throw new Error(copy.packageTooLarge);
    const bundle = JSON.parse(await fs.readFile(packagePath, 'utf8')) as Partial<ThemePackage>;
    if (bundle.format !== 'codex-theme' || bundle.schemaVersion !== 1 || typeof bundle.css !== 'string') {
      throw new Error(copy.invalidPackage);
    }
    const packageManifest = bundle.manifest;
    assertManifest(packageManifest);
    if (REMOTE_CSS.test(bundle.css)) throw new Error(copy.packageRemoteCss);
    const destination = path.join(this.userRoot, packageManifest.id);
    const temp = `${destination}.importing-${Date.now()}`;
    await fs.mkdir(temp, { recursive: true });
    try {
      const manifest: ThemeManifest = { ...packageManifest, css: 'theme.css' };
      await fs.writeFile(path.join(temp, 'theme.css'), bundle.css, 'utf8');
      if (bundle.art) {
        if (!bundle.art.base64 || bundle.art.base64.length > MAX_PACKAGE_BYTES * 1.5) throw new Error(copy.invalidThemeArt);
        const filename = safeAssetName(bundle.art.filename, 'art.png');
        manifest.art = filename;
        await fs.writeFile(path.join(temp, filename), Buffer.from(bundle.art.base64, 'base64'));
      } else {
        manifest.art = null;
      }
      await fs.writeFile(path.join(temp, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
      await fs.rm(destination, { recursive: true, force: true });
      await fs.rename(temp, destination);
      return this.summary(await this.readManifest(path.join(destination, 'manifest.json'), 'imported'));
    } catch (error) {
      await fs.rm(temp, { recursive: true, force: true });
      throw error;
    }
  }

  async delete(themeId: string): Promise<void> {
    if (!SAFE_ID.test(themeId)) throw new Error(getMainMessages().manifestInvalidId);
    const record = await this.find(themeId);
    if (record.source !== 'imported') throw new Error(getMainMessages().themeCannotDeleteBuiltin);
    await fs.rm(path.join(this.userRoot, themeId), { recursive: true, force: true });
  }
}
