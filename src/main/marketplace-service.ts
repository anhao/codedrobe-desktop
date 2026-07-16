// SPDX-License-Identifier: MPL-2.0

import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type {
  MarketplaceCategory,
  MarketplaceData,
  MarketplaceInstallResult,
  MarketplaceTheme,
} from '../shared/types';
import type { ThemeRepository } from './theme-repository';

const DEFAULT_BASE_URL = 'https://codedrobe.app';
const MAX_PACKAGE_BYTES = 30 * 1024 * 1024;
const HEX_SHA256 = /^[a-f0-9]{64}$/i;

type FetchLike = typeof fetch;

interface ApiResponse<T> {
  data: T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assertCategory(value: unknown): asserts value is MarketplaceCategory {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.slug !== 'string'
    || !isRecord(value.name) || typeof value.name.en !== 'string' || typeof value.name.zh !== 'string'
    || !isRecord(value.description) || typeof value.description.en !== 'string' || typeof value.description.zh !== 'string'
    || typeof value.themeCount !== 'number') {
    throw new Error('The marketplace returned an invalid category.');
  }
}

function assertTheme(value: unknown): asserts value is MarketplaceTheme {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.slug !== 'string'
    || !/^[a-z0-9-]+$/.test(value.slug) || typeof value.version !== 'string'
    || !isRecord(value.name) || typeof value.name.en !== 'string' || typeof value.name.zh !== 'string'
    || !isRecord(value.description) || typeof value.description.en !== 'string' || typeof value.description.zh !== 'string'
    || typeof value.previewUrl !== 'string' || typeof value.downloadUrl !== 'string'
    || !Array.isArray(value.categories) || !isRecord(value.price) || typeof value.price.free !== 'boolean'
    || !isRecord(value.package) || typeof value.package.sizeBytes !== 'number'
    || typeof value.package.sha256 !== 'string' || !HEX_SHA256.test(value.package.sha256)) {
    throw new Error('The marketplace returned an invalid theme.');
  }
}

export function normalizeMarketplaceUrl(value: string, baseUrl = DEFAULT_BASE_URL): string {
  const base = new URL(baseUrl);
  const url = new URL(value, base);
  if (url.origin !== base.origin) throw new Error('The marketplace returned an untrusted URL.');
  return url.toString();
}

export class MarketplaceService {
  private readonly base: URL;

  constructor(
    private readonly themes: ThemeRepository,
    baseUrl = DEFAULT_BASE_URL,
    private readonly fetcher: FetchLike = fetch,
  ) {
    this.base = new URL(baseUrl);
  }

  private url(pathname: string): URL {
    return new URL(pathname, this.base);
  }

  private async json<T>(pathname: string): Promise<T> {
    const url = this.url(pathname);
    url.searchParams.set('_refresh', String(Date.now()));
    const response = await this.fetcher(url, {
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        'User-Agent': 'CodeDrobe-Desktop',
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`Marketplace request failed (${response.status}).`);
    return response.json() as Promise<T>;
  }

  private normalizeTheme(theme: MarketplaceTheme): MarketplaceTheme {
    return {
      ...theme,
      previewUrl: normalizeMarketplaceUrl(theme.previewUrl, this.base.toString()),
      downloadUrl: normalizeMarketplaceUrl(theme.downloadUrl, this.base.toString()),
    };
  }

  async list(category?: string): Promise<MarketplaceData> {
    if (category && !/^[a-z0-9-]+$/.test(category)) throw new Error('Invalid marketplace category.');
    const query = category ? `?category=${encodeURIComponent(category)}` : '';
    const [categoryResult, themeResult] = await Promise.all([
      this.json<ApiResponse<unknown[]>>('/api/v1/categories'),
      this.json<ApiResponse<unknown[]>>(`/api/v1/themes${query}`),
    ]);
    categoryResult.data.forEach(assertCategory);
    themeResult.data.forEach(assertTheme);
    const categories = categoryResult.data as MarketplaceCategory[];
    const themes = themeResult.data as MarketplaceTheme[];
    return {
      categories,
      themes: themes.map((theme) => this.normalizeTheme(theme)),
    };
  }

  private async getTheme(slug: string): Promise<MarketplaceTheme> {
    if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('Invalid theme slug.');
    const result = await this.json<ApiResponse<unknown>>(`/api/v1/themes/${encodeURIComponent(slug)}`);
    assertTheme(result.data);
    return this.normalizeTheme(result.data);
  }

  async install(slug: string): Promise<MarketplaceInstallResult> {
    const theme = await this.getTheme(slug);
    if (!theme.price.free) throw new Error('Paid themes are not available in this version yet.');
    if (theme.package.sizeBytes <= 0 || theme.package.sizeBytes > MAX_PACKAGE_BYTES) {
      throw new Error('The marketplace theme package is too large.');
    }

    const response = await this.fetcher(theme.downloadUrl, {
      headers: { Accept: 'application/octet-stream', 'User-Agent': 'CodeDrobe-Desktop' },
      redirect: 'follow',
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Theme download failed (${response.status}).`);
    const declaredLength = Number(response.headers.get('content-length') ?? '0');
    if (declaredLength > MAX_PACKAGE_BYTES) throw new Error('The downloaded theme package is too large.');
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_PACKAGE_BYTES) throw new Error('The downloaded theme package is too large.');
    if (bytes.length !== theme.package.sizeBytes) throw new Error('The downloaded theme package size does not match the marketplace record.');
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (digest !== theme.package.sha256.toLowerCase()) throw new Error('The downloaded theme failed its SHA-256 integrity check.');

    const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'codedrobe-marketplace-'));
    const packagePath = path.join(temporaryRoot, `${theme.slug}.codex-theme`);
    try {
      await fs.writeFile(packagePath, bytes, { flag: 'wx' });
      const imported = await this.themes.importPackage(packagePath);
      return { theme: imported, themes: await this.themes.summaries() };
    } finally {
      await fs.rm(temporaryRoot, { recursive: true, force: true });
    }
  }
}
