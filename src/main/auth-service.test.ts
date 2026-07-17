// SPDX-License-Identifier: MPL-2.0

import { mkdtempSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => false,
  },
  shell: {
    openExternal: vi.fn(async () => undefined),
  },
}));

import { shell } from 'electron';
import { AuthService } from './auth-service';

const BASE = 'https://codedrobe.test';

function fakeFetcher(): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === `${BASE}/api/auth/oauth2/token`) {
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, string>;
      if (body.grant_type === 'authorization_code' && body.code === 'test-code' && body.code_verifier) {
        return Response.json({
          access_token: 'cdbat_test',
          refresh_token: 'cdbrt_test',
          expires_in: 900,
          scope: 'openid profile offline_access profile:write theme:read theme:write theme:submit',
        });
      }
      return Response.json({ error: 'invalid_grant' }, { status: 400 });
    }
    if (url === `${BASE}/api/v1/me`) {
      return Response.json({
        data: { user: { name: 'Tester', email: 't@example.com', image: null }, creator: { handle: 'tester' } },
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;
}

function service(): AuthService {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'cdb-auth-'));
  return new AuthService(BASE, path.join(dir, 'credentials.bin'), fakeFetcher());
}

async function waitFor<T>(read: () => T | null, timeoutMs = 3000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value !== null) return value;
    if (Date.now() > deadline) throw new Error('waitFor timed out');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function httpGet(target: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    http.get(target, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode ?? 0, body }));
    }).on('error', reject);
  });
}

describe('AuthService PKCE login', () => {
  it('emits the authorize URL to the renderer and completes on the loopback callback', async () => {
    const auth = service();
    let authorizeUrl: string | null = null;
    const loginPromise = auth.login({ onAuthorizeUrl: (url) => { authorizeUrl = url; } });
    const emitted = await waitFor(() => authorizeUrl);

    const parsed = new URL(emitted);
    expect(parsed.origin + parsed.pathname).toBe(`${BASE}/api/auth/oauth2/authorize`);
    expect(parsed.searchParams.get('client_id')).toBe('codedrobe-desktop');
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
    expect(parsed.searchParams.get('scope')).toBe('openid profile offline_access profile:write theme:read theme:write theme:submit');
    const state = parsed.searchParams.get('state');
    const redirectUri = new URL(parsed.searchParams.get('redirect_uri')!);
    expect(state).toBeTruthy();

    // The dialog's copy-link/browser fallback and the automatic launch share the URL.
    expect(vi.mocked(shell.openExternal)).toHaveBeenCalledWith(emitted);
    await auth.reopenAuthorizeUrl();
    expect(vi.mocked(shell.openExternal)).toHaveBeenCalledTimes(2);

    const callback = await httpGet(`http://127.0.0.1:${redirectUri.port}/oauth/callback?code=test-code&state=${state}`);
    expect(callback.status).toBe(200);
    // The browser lands on a localized, branded page with a close button.
    expect(callback.body).toContain('lang="zh-CN"');
    expect(callback.body).toContain('登录成功');
    expect(callback.body).toContain('window.close()');

    const result = await loginPromise;
    expect(result.loggedIn).toBe(true);
    if (result.loggedIn) expect(result.user.handle).toBe('tester');
  });

  it('rejects with LOGIN_CANCELLED when the dialog cancels the flow', async () => {
    const auth = service();
    let authorizeUrl: string | null = null;
    const loginPromise = auth.login({ onAuthorizeUrl: (url) => { authorizeUrl = url; } });
    await waitFor(() => authorizeUrl);

    auth.cancelLogin();
    await expect(loginPromise).rejects.toThrow('LOGIN_CANCELLED');

    // The flow is fully torn down: a new login can start immediately.
    let second: string | null = null;
    const retry = auth.login({ onAuthorizeUrl: (url) => { second = url; } });
    await waitFor(() => second);
    auth.cancelLogin();
    await expect(retry).rejects.toThrow('LOGIN_CANCELLED');
  });
});
