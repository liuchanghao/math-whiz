import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  adminSessionDataSchema,
  errorEnvelopeSchema,
  successEnvelopeSchema,
} from '@math-whiz/contracts';

const loginAdmin = vi.fn();
const restoreAdminSession = vi.fn();
const logoutAdmin = vi.fn();

vi.mock('@/src/modules/identity/admin-auth/service', () => ({
  loginAdmin,
  restoreAdminSession,
  logoutAdmin,
}));

const origin = 'http://localhost:3000';

const request = (
  path: string,
  init: RequestInit & { cookie?: string } = {},
) => {
  const headers = new Headers(init.headers);
  headers.set('origin', origin);
  if (init.body !== undefined) {
    headers.set('content-type', 'application/json');
  }
  if (init.cookie !== undefined) {
    headers.set('cookie', init.cookie);
  }

  return new Request(`http://localhost:3001${path}`, {
    ...init,
    headers,
  });
};

describe('administrator authentication routes', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_WEB_ORIGIN', origin);
    loginAdmin.mockReset();
    restoreAdminSession.mockReset();
    logoutAdmin.mockReset();
  });

  it('logs in with an opaque secure cookie and minimal public data', async () => {
    loginAdmin.mockResolvedValue({
      kind: 'success',
      admin: {
        id: '8ca3da70-6101-499a-b4e9-e12bfbca02f8',
        username: 'math_admin',
      },
      sessionToken: 'session-token',
      csrfToken: 'mH3Q6xTRrB67hi6snjguvBXtc7Ix6wM6xGSwukmejrQ',
      expiresAt: new Date('2026-08-21T16:00:00.000Z'),
    });
    const { POST } = await import('./login/route');

    const response = await POST(
      request('/api/v1/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: 'math_admin',
          password: 'one-time-strong-password',
        }),
      }),
    );
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(successEnvelopeSchema(adminSessionDataSchema).parse(body)).toEqual({
      status: 200,
      message: '登录成功',
      data: {
        admin: {
          id: '8ca3da70-6101-499a-b4e9-e12bfbca02f8',
          username: 'math_admin',
        },
        csrfToken: 'mH3Q6xTRrB67hi6snjguvBXtc7Ix6wM6xGSwukmejrQ',
      },
    });
    expect(response.headers.get('set-cookie')).toContain(
      '__Host-mw_admin=session-token',
    );
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('set-cookie')).toContain('Secure');
    expect(response.headers.get('set-cookie')).toContain('SameSite=strict');
    expect(response.headers.get('access-control-allow-origin')).toBe(origin);
  });

  it('uses one response for every invalid credential state', async () => {
    loginAdmin.mockResolvedValue({ kind: 'invalid-credentials' });
    const { POST } = await import('./login/route');

    const response = await POST(
      request('/api/v1/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'unknown', password: 'wrong' }),
      }),
    );

    expect(response.status).toBe(401);
    expect(errorEnvelopeSchema.parse(await response.json())).toEqual({
      status: 401,
      message: '用户名或密码错误',
      data: { errorCode: 'ADMIN_INVALID_CREDENTIALS' },
    });
  });

  it('rejects untrusted origins before checking credentials', async () => {
    const { POST } = await import('./login/route');
    const untrustedRequest = new Request(
      'http://localhost:3001/api/v1/admin/auth/login',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://evil.example',
        },
        body: JSON.stringify({ username: 'math_admin', password: 'wrong' }),
      },
    );

    const response = await POST(untrustedRequest);

    expect(response.status).toBe(403);
    expect(loginAdmin).not.toHaveBeenCalled();
  });

  it('restores an active database session and rotates its CSRF token', async () => {
    restoreAdminSession.mockResolvedValue({
      kind: 'success',
      admin: {
        id: '8ca3da70-6101-499a-b4e9-e12bfbca02f8',
        username: 'math_admin',
      },
      csrfToken: 'new-csrf-token-value-that-is-long-enough',
    });
    const { GET } = await import('../me/route');

    const response = await GET(
      request('/api/v1/admin/me', {
        cookie: '__Host-mw_admin=session-token',
      }),
    );

    expect(response.status).toBe(200);
    expect(
      successEnvelopeSchema(adminSessionDataSchema).parse(
        await response.json(),
      ),
    ).toMatchObject({
      data: { admin: { username: 'math_admin' } },
    });
  });

  it('requires a session-bound CSRF header to log out', async () => {
    const { POST } = await import('./logout/route');

    const response = await POST(
      request('/api/v1/admin/auth/logout', {
        method: 'POST',
        cookie: '__Host-mw_admin=session-token',
      }),
    );

    expect(response.status).toBe(403);
    expect(logoutAdmin).not.toHaveBeenCalled();
  });

  it('revokes the session and expires the cookie on logout', async () => {
    logoutAdmin.mockResolvedValue({ kind: 'success' });
    const { POST } = await import('./logout/route');

    const response = await POST(
      request('/api/v1/admin/auth/logout', {
        method: 'POST',
        headers: { 'x-csrf-token': 'valid-csrf-token' },
        cookie: '__Host-mw_admin=session-token',
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('__Host-mw_admin=;');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });
});
