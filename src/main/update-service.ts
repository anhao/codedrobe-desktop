// SPDX-License-Identifier: MPL-2.0

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { UpdateAsset, UpdateDownloadResult, UpdateInfo } from '../shared/types';
import { compareVersions, normalizeVersion } from '../shared/version';

export { compareVersions, normalizeVersion } from '../shared/version';

const RELEASE_API = 'https://api.github.com/repos/anhao/codedrobe-desktop/releases/latest';
const DOWNLOAD_PREFIX = 'https://github.com/anhao/codedrobe-desktop/releases/download/';
const MAX_UPDATE_BYTES = 500 * 1024 * 1024;

type FetchLike = typeof fetch;

interface GitHubAsset {
  name: string;
  size: number;
  digest?: string | null;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  assets: GitHubAsset[];
}

function trustedDownloadUrl(value: string): boolean {
  return value.startsWith(DOWNLOAD_PREFIX);
}

export function selectReleaseAsset(
  assets: GitHubAsset[],
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): UpdateAsset | null {
  const valid = assets.filter((asset) => asset.size > 0 && asset.size <= MAX_UPDATE_BYTES && trustedDownloadUrl(asset.browser_download_url));
  let selected: GitHubAsset | undefined;
  if (platform === 'win32') {
    selected = valid.find((asset) => /setup\.exe$/i.test(asset.name));
  } else if (platform === 'darwin') {
    const archPattern = arch === 'arm64' ? /arm64|aarch64/i : /x64|x86_64/i;
    selected = valid.find((asset) => /\.dmg$/i.test(asset.name) && archPattern.test(asset.name))
      ?? valid.find((asset) => /\.dmg$/i.test(asset.name))
      ?? valid.find((asset) => /\.zip$/i.test(asset.name) && archPattern.test(asset.name));
  }
  if (!selected) return null;
  const digest = selected.digest?.match(/^sha256:([a-f0-9]{64})$/i)?.[1]?.toLowerCase() ?? null;
  return {
    name: selected.name,
    url: selected.browser_download_url,
    sizeBytes: selected.size,
    sha256: digest,
  };
}

export class UpdateService {
  private latest: UpdateInfo | null = null;

  constructor(
    private readonly currentVersion: string,
    private readonly downloadsRoot: string,
    private readonly fetcher: FetchLike = fetch,
    private readonly platform: NodeJS.Platform = process.platform,
    private readonly arch: string = process.arch,
  ) {}

  async check(): Promise<UpdateInfo> {
    const checkedAt = new Date().toISOString();
    try {
      const response = await this.fetcher(RELEASE_API, {
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'CodeDrobe-Desktop',
        },
        signal: AbortSignal.timeout(12_000),
      });
      if (response.status === 404) {
        this.latest = { status: 'up-to-date', currentVersion: this.currentVersion, latestVersion: null, releaseUrl: null, asset: null, checkedAt };
        return this.latest;
      }
      if (!response.ok) throw new Error(`GitHub Releases request failed (${response.status}).`);
      const release = await response.json() as GitHubRelease;
      if (!release.tag_name || !release.html_url || !Array.isArray(release.assets)) throw new Error('GitHub returned an invalid release.');
      const latestVersion = normalizeVersion(release.tag_name);
      const available = compareVersions(latestVersion, this.currentVersion) > 0;
      const asset = available ? selectReleaseAsset(release.assets, this.platform, this.arch) : null;
      this.latest = {
        status: available ? 'available' : 'up-to-date',
        currentVersion: this.currentVersion,
        latestVersion,
        releaseUrl: release.html_url,
        asset,
        checkedAt,
        message: available && !asset ? 'A new release exists, but no installer matches this platform.' : undefined,
      };
      return this.latest;
    } catch (error) {
      this.latest = {
        status: 'unavailable',
        currentVersion: this.currentVersion,
        latestVersion: null,
        releaseUrl: null,
        asset: null,
        checkedAt,
        message: error instanceof Error ? error.message : String(error),
      };
      return this.latest;
    }
  }

  async download(onProgress?: (progress: number) => void): Promise<UpdateDownloadResult> {
    const info = this.latest?.status === 'available' ? this.latest : await this.check();
    if (info.status !== 'available' || !info.asset) throw new Error(info.message ?? 'No compatible update is available.');
    if (!trustedDownloadUrl(info.asset.url)) throw new Error('The update download URL is not trusted.');
    await fsp.mkdir(this.downloadsRoot, { recursive: true });
    const filename = path.basename(info.asset.name).replace(/[^a-z0-9._-]/gi, '-');
    const destination = path.join(this.downloadsRoot, filename);
    const temporary = `${destination}.downloading`;
    const response = await this.fetcher(info.asset.url, {
      headers: { Accept: 'application/octet-stream', 'User-Agent': 'CodeDrobe-Desktop' },
      redirect: 'follow',
      signal: AbortSignal.timeout(10 * 60_000),
    });
    if (!response.ok || !response.body) throw new Error(`Update download failed (${response.status}).`);
    const declaredLength = Number(response.headers.get('content-length') ?? info.asset.sizeBytes);
    if (declaredLength > MAX_UPDATE_BYTES) throw new Error('The update installer is too large.');

    let received = 0;
    const hash = createHash('sha256');
    const progress = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        received += chunk.length;
        if (received > MAX_UPDATE_BYTES) return callback(new Error('The update installer is too large.'));
        hash.update(chunk);
        onProgress?.(Math.min(100, Math.round((received / info.asset!.sizeBytes) * 100)));
        callback(null, chunk);
      },
    });
    await fsp.rm(temporary, { force: true });
    try {
      await pipeline(Readable.fromWeb(response.body as never), progress, fs.createWriteStream(temporary, { flags: 'wx' }));
      if (info.asset.sizeBytes && received !== info.asset.sizeBytes) throw new Error('The update installer size does not match the GitHub release.');
      const digest = hash.digest('hex');
      if (info.asset.sha256 && digest !== info.asset.sha256) throw new Error('The update installer failed its SHA-256 integrity check.');
      await fsp.rm(destination, { force: true });
      await fsp.rename(temporary, destination);
      onProgress?.(100);
      return { path: destination, assetName: info.asset.name };
    } catch (error) {
      await fsp.rm(temporary, { force: true });
      throw error;
    }
  }
}
