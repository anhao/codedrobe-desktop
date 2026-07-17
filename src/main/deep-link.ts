// SPDX-License-Identifier: MPL-2.0

import { isAppId, type DeepLinkApplyRequest } from '../shared/types';

const SLUG = /^[a-z0-9-]{1,64}$/;
const VERSION = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

export function parseDeepLink(raw: string): DeepLinkApplyRequest | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'codedrobe:') return null;
  // codedrobe://themes/apply?theme=<slug>&version=<v>&app=<appId>
  const route = `${url.host}${url.pathname}`.replace(/\/+$/, '');
  if (route !== 'themes/apply') return null;
  const slug = url.searchParams.get('theme') ?? '';
  const appId = url.searchParams.get('app') ?? '';
  const version = url.searchParams.get('version');
  if (!SLUG.test(slug) || !isAppId(appId)) return null;
  return {
    slug,
    version: version && VERSION.test(version) ? version : null,
    appId,
  };
}

export function extractDeepLinkFromArgv(argv: string[]): string | null {
  return argv.find((argument) => argument.startsWith('codedrobe://')) ?? null;
}

/**
 * Queues theme-apply deep links until the renderer is ready; the renderer
 * shows the confirmation dialog (web pages must never switch themes silently).
 */
export class DeepLinkManager {
  private pending: DeepLinkApplyRequest[] = [];
  private sink: ((request: DeepLinkApplyRequest) => void) | null = null;

  handleUrl(raw: string): boolean {
    const request = parseDeepLink(raw);
    if (!request) return false;
    if (this.sink) this.sink(request);
    else this.pending.push(request);
    return true;
  }

  setSink(sink: (request: DeepLinkApplyRequest) => void): void {
    this.sink = sink;
    for (const request of this.pending.splice(0)) sink(request);
  }

  clearSink(): void {
    this.sink = null;
  }
}
