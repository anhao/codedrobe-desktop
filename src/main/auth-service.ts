// SPDX-License-Identifier: MPL-2.0

import { randomBytes, createHash } from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { safeStorage, shell } from 'electron';
import { getMainLocale, getMainMessages } from '../shared/i18n';
import type { AuthState } from '../shared/types';

const CLIENT_ID = 'codedrobe-desktop';
const SCOPES = ['openid', 'profile', 'offline_access', 'profile:write', 'theme:read', 'theme:write', 'theme:submit'];
const ACCESS_RENEW_MARGIN_MS = 60_000;
const LOGIN_TIMEOUT_MS = 5 * 60_000;

type FetchLike = typeof fetch;

interface StoredCredentials {
  version: 1;
  clientId: string;
  refreshToken: string;
  accessToken: string | null;
  accessTokenExpiresAt: string | null;
  scopes: string[];
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}

function base64url(bytes: Buffer): string {
  return bytes.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

type CallbackVariant = 'success' | 'denied' | 'invalid';

/** Localized, branded page shown in the browser tab after the OAuth redirect. */
function callbackHtml(variant: CallbackVariant, iconDataUrl: string | null): string {
  const copy = getMainMessages();
  const [title, body] = variant === 'success'
    ? [copy.callbackSuccessTitle, copy.callbackSuccessBody]
    : variant === 'denied'
      ? [copy.callbackDeniedTitle, copy.callbackDeniedBody]
      : [copy.callbackInvalidTitle, copy.callbackInvalidBody];
  const mark = variant === 'success' ? '✓' : '•';
  const icon = iconDataUrl
    ? `<img src="${iconDataUrl}" alt="" width="72" height="72" style="border-radius:18px" draggable="false">`
    : '';
  return `<!doctype html>
<html lang="${getMainLocale()}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CodeDrobe</title>
<style>
  :root { color-scheme: light dark; }
  body {
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    display: grid; place-items: center; min-height: 100vh; margin: 0;
    background: #fafafa; color: #171717;
  }
  @media (prefers-color-scheme: dark) {
    body { background: #111113; color: #ededef; }
    .card { background: #1b1b1f; border-color: #2a2a30; }
    .muted { color: #9b9ba3; }
    .close { background: #ededef; color: #111113; }
  }
  .card {
    display: flex; flex-direction: column; align-items: center; gap: 14px;
    background: #ffffff; border: 1px solid #e5e5e5; border-radius: 20px;
    padding: 44px 52px; text-align: center; max-width: 340px;
    box-shadow: 0 8px 30px rgb(0 0 0 / 0.06);
  }
  h1 { font-size: 19px; margin: 0; letter-spacing: -0.01em; }
  .muted { font-size: 14px; line-height: 1.6; color: #6f6f76; margin: 0; }
  .mark { font-size: 15px; font-weight: 600; }
  .close {
    margin-top: 8px; border: 0; border-radius: 999px; padding: 9px 22px;
    font-size: 14px; font-weight: 500; cursor: pointer;
    background: #171717; color: #ffffff;
  }
</style>
</head>
<body>
<div class="card">
  ${icon}
  <h1><span class="mark">${mark}</span> ${title}</h1>
  <p class="muted">${body}</p>
  <button class="close" onclick="window.close()">${copy.callbackCloseAction}</button>
</div>
<script>
  // Tabs opened by a native app usually allow window.close(); harmless if not.
  if (${variant === 'success' ? 'true' : 'false'}) setTimeout(() => window.close(), 2500);
</script>
</body>
</html>`;
}

/**
 * Authorization Code + PKCE (S256) against codedrobe.app, per
 * website/docs/oauth-clients-contract.md §3. Refresh tokens are encrypted with
 * Electron safeStorage and rotated atomically; the access token stays in memory.
 */
export class AuthService {
  private credentials: StoredCredentials | null = null;
  private loginInFlight = false;
  private pendingAuthorizeUrl: string | null = null;
  private abortLogin: (() => void) | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly credentialsFile: string,
    private readonly fetcher: FetchLike = fetch,
    /** data: URL of the app icon, embedded into the browser callback page. */
    private readonly iconDataUrl: string | null = null,
  ) {}

  async initialize(): Promise<void> {
    try {
      const encrypted = await fs.readFile(this.credentialsFile);
      const raw = safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(encrypted)
        : encrypted.toString('utf8');
      const parsed = JSON.parse(raw) as StoredCredentials;
      if (parsed?.version === 1 && parsed.clientId === CLIENT_ID && typeof parsed.refreshToken === 'string') {
        this.credentials = parsed;
      }
    } catch {
      this.credentials = null;
    }
  }

  private async persist(): Promise<void> {
    if (!this.credentials) {
      await fs.rm(this.credentialsFile, { force: true });
      return;
    }
    const raw = JSON.stringify(this.credentials);
    const payload = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(raw)
      : Buffer.from(raw, 'utf8');
    await fs.mkdir(path.dirname(this.credentialsFile), { recursive: true });
    const temporary = `${this.credentialsFile}.tmp`;
    await fs.writeFile(temporary, payload, { mode: 0o600 });
    await fs.rename(temporary, this.credentialsFile);
  }

  private async tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
    const response = await this.fetcher(`${this.baseUrl}/api/auth/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json().catch(() => null) as
      | (TokenResponse & { error?: string; error_description?: string })
      | null;
    if (!response.ok || !payload?.access_token) {
      const error = new Error(payload?.error_description || payload?.error || `Token request failed (${response.status}).`);
      (error as { code?: string }).code = payload?.error ?? 'token_failed';
      throw error;
    }
    return payload;
  }

  private applyTokens(tokens: TokenResponse): void {
    this.credentials = {
      version: 1,
      clientId: CLIENT_ID,
      refreshToken: tokens.refresh_token ?? this.credentials?.refreshToken ?? '',
      accessToken: tokens.access_token,
      accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      scopes: tokens.scope ? tokens.scope.split(' ') : this.credentials?.scopes ?? SCOPES,
    };
  }

  /** Silent-renew seam used by every authenticated API call. */
  async getAccessToken(): Promise<string | null> {
    if (!this.credentials?.refreshToken) return null;
    const expiresAt = Date.parse(this.credentials.accessTokenExpiresAt ?? '');
    if (this.credentials.accessToken && Number.isFinite(expiresAt)
      && expiresAt - Date.now() > ACCESS_RENEW_MARGIN_MS) {
      return this.credentials.accessToken;
    }
    try {
      const tokens = await this.tokenRequest({
        grant_type: 'refresh_token',
        refresh_token: this.credentials.refreshToken,
        client_id: CLIENT_ID,
      });
      this.applyTokens(tokens);
      await this.persist();
      return this.credentials?.accessToken ?? null;
    } catch (error) {
      if ((error as { code?: string }).code === 'invalid_grant') {
        this.credentials = null;
        await this.persist();
        return null;
      }
      throw error;
    }
  }

  async status(): Promise<AuthState> {
    const token = await this.getAccessToken().catch(() => null);
    if (!token) return { loggedIn: false };
    try {
      const response = await this.fetcher(`${this.baseUrl}/api/v1/me`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) {
        if (response.status === 401) {
          this.credentials = null;
          await this.persist();
        }
        return { loggedIn: false };
      }
      const payload = await response.json() as {
        data?: {
          user?: { name?: string; email?: string; image?: string | null };
          creator?: { handle?: string };
        };
      };
      const image = payload.data?.user?.image;
      return {
        loggedIn: true,
        user: {
          name: payload.data?.user?.name ?? null,
          email: payload.data?.user?.email ?? null,
          handle: payload.data?.creator?.handle ?? null,
          avatarUrl: typeof image === 'string' && /^https:\/\//.test(image) ? image : null,
        },
        scopes: this.credentials?.scopes ?? [],
      };
    } catch {
      // Network trouble: report logged-in-unknown as logged in with stored scopes.
      return this.credentials
        ? {
            loggedIn: true,
            user: { name: null, email: null, handle: null, avatarUrl: null },
            scopes: this.credentials.scopes,
          }
        : { loggedIn: false };
    }
  }

  /**
   * Full PKCE login: loopback listener → system browser → consent →
   * callback with code → token exchange. Resolves once tokens are stored.
   */
  async login(options: {
    onAuthorizeUrl?: (url: string) => void;
    /** Fires when the browser hits the loopback callback — used to refocus the app window. */
    onCallback?: () => void;
  } = {}): Promise<AuthState> {
    if (this.loginInFlight) throw new Error('LOGIN_IN_PROGRESS');
    this.loginInFlight = true;
    try {
      const verifier = base64url(randomBytes(48));
      const challenge = base64url(createHash('sha256').update(verifier).digest());
      const state = base64url(randomBytes(24));

      const { code, redirectUri } = await new Promise<{ code: string; redirectUri: string }>((resolve, reject) => {
        const server = http.createServer((request, response) => {
          const url = new URL(request.url ?? '/', 'http://127.0.0.1');
          if (url.pathname !== '/oauth/callback') {
            response.writeHead(404).end();
            return;
          }
          const receivedState = url.searchParams.get('state');
          const error = url.searchParams.get('error');
          const receivedCode = url.searchParams.get('code');
          options.onCallback?.();
          if (error) {
            response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
              .end(callbackHtml('denied', this.iconDataUrl));
            cleanup();
            reject(new Error(error === 'access_denied' ? 'LOGIN_DENIED' : `Login failed: ${error}`));
            return;
          }
          if (!receivedCode || receivedState !== state) {
            response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
              .end(callbackHtml('invalid', this.iconDataUrl));
            cleanup();
            reject(new Error('LOGIN_INVALID_CALLBACK'));
            return;
          }
          response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
            .end(callbackHtml('success', this.iconDataUrl));
          const address = server.address();
          const port = typeof address === 'object' && address ? address.port : 0;
          cleanup();
          resolve({ code: receivedCode, redirectUri: `http://127.0.0.1:${port}/oauth/callback` });
        });
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error('LOGIN_TIMEOUT'));
        }, LOGIN_TIMEOUT_MS);
        const cleanup = () => {
          clearTimeout(timeout);
          this.abortLogin = null;
          setImmediate(() => server.close());
        };
        this.abortLogin = () => {
          cleanup();
          reject(new Error('LOGIN_CANCELLED'));
        };
        server.on('error', (error) => {
          cleanup();
          reject(error);
        });
        server.listen(0, '127.0.0.1', () => {
          const address = server.address();
          const port = typeof address === 'object' && address ? address.port : 0;
          const authorize = new URL(`${this.baseUrl}/api/auth/oauth2/authorize`);
          authorize.searchParams.set('response_type', 'code');
          authorize.searchParams.set('client_id', CLIENT_ID);
          authorize.searchParams.set('redirect_uri', `http://127.0.0.1:${port}/oauth/callback`);
          authorize.searchParams.set('scope', SCOPES.join(' '));
          authorize.searchParams.set('state', state);
          authorize.searchParams.set('code_challenge', challenge);
          authorize.searchParams.set('code_challenge_method', 'S256');
          this.pendingAuthorizeUrl = authorize.toString();
          options.onAuthorizeUrl?.(this.pendingAuthorizeUrl);
          // Browser launch can fail (no default browser, sandboxed env);
          // the login dialog offers copy-link and reopen as fallbacks.
          shell.openExternal(this.pendingAuthorizeUrl).catch(() => undefined);
        });
      });

      const tokens = await this.tokenRequest({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: CLIENT_ID,
        code_verifier: verifier,
      });
      this.applyTokens(tokens);
      await this.persist();
      return this.status();
    } finally {
      this.loginInFlight = false;
      this.pendingAuthorizeUrl = null;
      this.abortLogin = null;
    }
  }

  /** Re-opens the system browser at the in-flight authorize URL. */
  async reopenAuthorizeUrl(): Promise<void> {
    if (!this.pendingAuthorizeUrl) return;
    await shell.openExternal(this.pendingAuthorizeUrl).catch(() => undefined);
  }

  /** Aborts the in-flight PKCE login; the pending login() rejects with LOGIN_CANCELLED. */
  cancelLogin(): void {
    this.abortLogin?.();
  }

  async logout(): Promise<AuthState> {
    const refreshToken = this.credentials?.refreshToken;
    if (refreshToken) {
      // Revoking the refresh token kills the whole grant server-side.
      await this.fetcher(`${this.baseUrl}/api/auth/oauth2/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ token: refreshToken, client_id: CLIENT_ID }),
        signal: AbortSignal.timeout(10_000),
      }).catch(() => undefined);
    }
    this.credentials = null;
    await this.persist();
    return { loggedIn: false };
  }
}
