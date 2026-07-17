// SPDX-License-Identifier: MPL-2.0

import { createHash } from 'node:crypto';
import { isAppId, type AppId, type LikeResult, type MarketplaceCategory, type MarketplaceInstallResult, type MarketplacePage, type MarketplaceQuery, type MarketplaceTheme } from '../shared/types';
import type { ThemeLibrary } from './theme-library';

const MAX_PACKAGE_BYTES = 30 * 1024 * 1024;
const HEX_SHA256 = /^[a-f0-9]{64}$/i;
const SLUG = /^[a-z0-9-]+$/;
const SORTS = new Set(['newest', 'name', 'downloads', 'likes']);

type FetchLike = typeof fetch;
type TokenProvider = () => Promise<string | null>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function localized(value: unknown): { en: string; zh: string } {
  const record = isRecord(value) ? value : {};
  return {
    en: typeof record.en === 'string' ? record.en : '',
    zh: typeof record.zh === 'string' ? record.zh : '',
  };
}

function localizedNullable(value: unknown): { en: string | null; zh: string | null } {
  const record = isRecord(value) ? value : {};
  return {
    en: typeof record.en === 'string' ? record.en : null,
    zh: typeof record.zh === 'string' ? record.zh : null,
  };
}

export class MarketplaceService {
  private readonly base: URL;

  constructor(
    private readonly library: ThemeLibrary,
    baseUrl: string,
    private readonly fetcher: FetchLike = fetch,
    private readonly tokenProvider: TokenProvider = async () => null,
  ) {
    this.base = new URL(baseUrl);
  }

  /** Security-critical URLs (downloads) must stay same-origin. */
  private normalizeUrl(value: string): string {
    const url = new URL(value, this.base);
    if (url.origin !== this.base.origin) {
      throw new Error('The marketplace returned an untrusted URL.');
    }
    return url.toString();
  }

  /**
   * Display-only URLs (covers, previews, avatars): same-origin relative paths
   * are resolved; absolute https URLs (e.g. GitHub avatars) pass through;
   * anything else is dropped instead of failing the whole listing.
   */
  private displayUrl(value: unknown): string | null {
    if (typeof value !== 'string' || !value) return null;
    try {
      const url = new URL(value, this.base);
      if (url.origin === this.base.origin || url.protocol === 'https:') return url.toString();
      return null;
    } catch {
      return null;
    }
  }

  private async headers(withAuth: boolean): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': 'CodeDrobe-Desktop',
    };
    if (withAuth) {
      const token = await this.tokenProvider().catch(() => null);
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }

  private async request(pathname: string, init: RequestInit & { withAuth?: boolean } = {}): Promise<Response> {
    const url = new URL(pathname, this.base);
    const response = await this.fetcher(url, {
      ...init,
      headers: { ...(await this.headers(init.withAuth ?? false)), ...(init.headers as Record<string, string> | undefined) },
      signal: AbortSignal.timeout(15_000),
    });
    return response;
  }

  private mapTheme(value: unknown): MarketplaceTheme {
    if (!isRecord(value)
      || typeof value.id !== 'string'
      || typeof value.slug !== 'string' || !SLUG.test(value.slug)
      || typeof value.version !== 'string'
      || typeof value.downloadUrl !== 'string'
      || !isRecord(value.package)
      || typeof value.package.sizeBytes !== 'number'
      || typeof value.package.sha256 !== 'string' || !HEX_SHA256.test(value.package.sha256)
      || !isRecord(value.price)) {
      throw new Error('The marketplace returned an invalid theme.');
    }
    const categories = Array.isArray(value.categories)
      ? value.categories.filter(isRecord).map((category) => ({
          slug: typeof category.slug === 'string' ? category.slug : '',
          name: localized(category.name),
          primary: Boolean(category.primary),
        }))
      : [];
    const author = isRecord(value.author) && typeof value.author.handle === 'string'
      ? {
          handle: value.author.handle,
          displayName: typeof value.author.displayName === 'string' ? value.author.displayName : value.author.handle,
          avatarUrl: this.displayUrl(value.author.avatarUrl),
        }
      : null;
    return {
      id: value.id,
      slug: value.slug,
      name: localized(value.name),
      description: localizedNullable(value.description),
      version: value.version,
      categories,
      previewUrl: this.displayUrl(value.previewUrl) ?? '',
      coverUrl: this.displayUrl(value.coverUrl),
      downloadUrl: this.normalizeUrl(value.downloadUrl),
      price: {
        currency: typeof value.price.currency === 'string' ? value.price.currency : 'usd',
        unitAmount: typeof value.price.unitAmount === 'number' ? value.price.unitAmount : 0,
        free: Boolean(value.price.free),
      },
      package: {
        sizeBytes: value.package.sizeBytes,
        sha256: value.package.sha256.toLowerCase(),
      },
      publishedAt: typeof value.publishedAt === 'string' ? value.publishedAt : '',
      supportedApps: Array.isArray(value.supportedApps) ? value.supportedApps.filter(isAppId) : [],
      author,
      likeCount: typeof value.likeCount === 'number' ? value.likeCount : 0,
      downloadCount: typeof value.downloadCount === 'number' ? value.downloadCount : 0,
      likedByMe: typeof value.likedByMe === 'boolean' ? value.likedByMe : undefined,
    };
  }

  async list(query: MarketplaceQuery = {}): Promise<MarketplacePage> {
    const params = new URLSearchParams();
    if (query.app && isAppId(query.app)) params.set('app', query.app);
    if (query.category && SLUG.test(query.category)) params.set('category', query.category);
    if (query.q?.trim()) params.set('q', query.q.trim().slice(0, 80));
    if (query.sort && SORTS.has(query.sort)) params.set('sort', query.sort);
    if (query.cursor && /^\d+$/.test(query.cursor)) params.set('cursor', query.cursor);
    if (query.liked) params.set('liked', 'true');
    params.set('limit', String(query.limit && query.limit >= 1 && query.limit <= 100 ? query.limit : 24));
    const response = await this.request(`/api/v1/themes?${params}`, { withAuth: true });
    if (!response.ok) throw new Error(`Marketplace request failed (${response.status}).`);
    const payload = await response.json() as { data?: unknown[]; meta?: { total?: number; nextCursor?: string | null } };
    if (!Array.isArray(payload.data)) throw new Error('The marketplace returned an invalid theme list.');
    return {
      themes: payload.data.map((theme) => this.mapTheme(theme)),
      total: typeof payload.meta?.total === 'number' ? payload.meta.total : payload.data.length,
      nextCursor: typeof payload.meta?.nextCursor === 'string' ? payload.meta.nextCursor : null,
    };
  }

  async categories(): Promise<MarketplaceCategory[]> {
    const response = await this.request('/api/v1/categories');
    if (!response.ok) throw new Error(`Marketplace request failed (${response.status}).`);
    const payload = await response.json() as { data?: unknown[] };
    if (!Array.isArray(payload.data)) return [];
    return payload.data.filter(isRecord).map((category) => ({
      id: typeof category.id === 'string' ? category.id : '',
      slug: typeof category.slug === 'string' ? category.slug : '',
      name: localized(category.name),
      description: localized(category.description),
      themeCount: typeof category.themeCount === 'number' ? category.themeCount : 0,
    })).filter((category) => category.slug);
  }

  async getTheme(slug: string): Promise<MarketplaceTheme> {
    if (!SLUG.test(slug)) throw new Error('Invalid theme slug.');
    const response = await this.request(`/api/v1/themes/${encodeURIComponent(slug)}`, { withAuth: true });
    if (!response.ok) throw new Error(`Marketplace request failed (${response.status}).`);
    const payload = await response.json() as { data?: unknown };
    return this.mapTheme(payload.data);
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
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new Error(`Theme download failed (${response.status}).`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_PACKAGE_BYTES) throw new Error('The downloaded theme package is too large.');
    if (bytes.length !== theme.package.sizeBytes) {
      throw new Error('The downloaded theme package size does not match the marketplace record.');
    }
    const digest = createHash('sha256').update(bytes).digest('hex');
    const headerDigest = response.headers.get('x-codedrobe-sha256')?.toLowerCase() ?? null;
    if (digest !== theme.package.sha256 || (headerDigest && digest !== headerDigest)) {
      throw new Error('The downloaded theme failed its SHA-256 integrity check.');
    }

    const installed = await this.library.installBytes(bytes, theme.slug);
    return { theme: installed, themes: await this.library.summaries() };
  }

  async setLike(slug: string, liked: boolean): Promise<LikeResult> {
    if (!SLUG.test(slug)) throw new Error('Invalid theme slug.');
    const response = await this.request(`/api/v1/themes/${encodeURIComponent(slug)}/like`, {
      method: liked ? 'POST' : 'DELETE',
      withAuth: true,
    });
    if (response.status === 401 || response.status === 403) {
      throw new Error('LIKE_REQUIRES_LOGIN');
    }
    if (!response.ok) throw new Error(`Like request failed (${response.status}).`);
    const payload = await response.json().catch(() => null) as
      | { data?: { likeCount?: number; likedByMe?: boolean } }
      | null;
    return {
      likeCount: payload?.data?.likeCount ?? 0,
      likedByMe: payload?.data?.likedByMe ?? liked,
    };
  }
}
