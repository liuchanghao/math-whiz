import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  adminSessionDataSchema,
  successEnvelopeSchema,
} from '@math-whiz/contracts';

import { POST as loginRoute } from '@/app/api/v1/admin/auth/login/route';
import { POST as logoutRoute } from '@/app/api/v1/admin/auth/logout/route';
import { GET as meRoute } from '@/app/api/v1/admin/me/route';
import { disconnectDatabase, getDatabase } from '@/src/infrastructure/database';

import { AdminAlreadyInitializedError, bootstrapAdmin } from './bootstrap';
import { verifyPassword } from './password';
import { loginAdmin, logoutAdmin, restoreAdminSession } from './service';
import { digestToken } from './token';

const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? '';
if (
  process.env.npm_lifecycle_event === 'test:integration' &&
  testDatabaseUrl.length === 0
) {
  throw new Error('TEST_DATABASE_URL is required for integration tests');
}
const integration = describe.runIf(testDatabaseUrl.length > 0);
const strongPassword = 'integration-only-password-4vPteuKz2S6Dq9Yx';

integration(
  'administrator authentication with MySQL',
  () => {
    beforeAll(async () => {
      process.env.DATABASE_URL = testDatabaseUrl;
      process.env.AUDIT_HMAC_SECRET =
        'integration-test-audit-secret-with-32-characters';

      const database = getDatabase();
      await expect(database.admin.count()).resolves.toBe(0);
    });

    afterAll(async () => {
      await disconnectDatabase();
    });

    it('bootstraps exactly one administrator without storing plaintext', async () => {
      const publicAdmin = await bootstrapAdmin({
        username: 'math_admin',
        password: strongPassword,
        requestId: 'integration-bootstrap',
      });
      const stored = await getDatabase().admin.findUniqueOrThrow({
        where: { id: publicAdmin.id },
      });

      expect(publicAdmin).toEqual({ id: stored.id, username: 'math_admin' });
      expect(stored.passwordHash).not.toContain(strongPassword);
      await expect(
        verifyPassword(strongPassword, stored.passwordHash),
      ).resolves.toBe(true);
      await expect(
        bootstrapAdmin({
          username: 'another_admin',
          password: strongPassword,
          requestId: 'integration-bootstrap-again',
        }),
      ).rejects.toBeInstanceOf(AdminAlreadyInitializedError);
    });

    it('returns the same public failure for unknown, wrong and disabled accounts', async () => {
      const unknown = await loginAdmin({
        username: 'unknown_admin',
        password: 'wrong',
        ipAddress: '10.10.0.1',
        requestId: 'integration-unknown',
      });
      const wrong = await loginAdmin({
        username: 'math_admin',
        password: 'wrong',
        ipAddress: '10.10.0.2',
        requestId: 'integration-wrong',
      });
      await getDatabase().admin.update({
        where: { username: 'math_admin' },
        data: { status: 'DISABLED', failedLoginCount: 0, lockedUntil: null },
      });
      const disabled = await loginAdmin({
        username: 'math_admin',
        password: strongPassword,
        ipAddress: '10.10.0.3',
        requestId: 'integration-disabled',
      });

      expect(unknown).toEqual({ kind: 'invalid-credentials' });
      expect(wrong).toEqual({ kind: 'invalid-credentials' });
      expect(disabled).toEqual({ kind: 'invalid-credentials' });

      await getDatabase().admin.update({
        where: { username: 'math_admin' },
        data: { status: 'ACTIVE', failedLoginCount: 0, lockedUntil: null },
      });
    });

    it('locks the administrator after three consecutive failures', async () => {
      const now = new Date('2026-08-21T08:00:00.000Z');
      await expect(
        Promise.all(
          Array.from({ length: 3 }, (_, attempt) =>
            loginAdmin({
              username: 'math_admin',
              password: 'wrong',
              ipAddress: `10.20.0.${attempt + 1}`,
              requestId: `integration-lock-${attempt + 1}`,
              now,
            }),
          ),
        ),
      ).resolves.toEqual([
        { kind: 'invalid-credentials' },
        { kind: 'invalid-credentials' },
        { kind: 'invalid-credentials' },
      ]);

      const stored = await getDatabase().admin.findUniqueOrThrow({
        where: { username: 'math_admin' },
      });
      expect(stored.failedLoginCount).toBe(3);
      expect(stored.lockedUntil).toEqual(new Date('2026-08-21T08:30:00.000Z'));
      await expect(
        loginAdmin({
          username: 'math_admin',
          password: strongPassword,
          ipAddress: '10.20.0.9',
          requestId: 'integration-locked',
          now,
        }),
      ).resolves.toEqual({ kind: 'invalid-credentials' });

      await getDatabase().admin.update({
        where: { username: 'math_admin' },
        data: { failedLoginCount: 0, lockedUntil: null },
      });
    });

    it('atomically throttles concurrent attempts from one client address', async () => {
      const now = new Date('2026-08-21T09:00:00.000Z');
      const results = await Promise.all(
        Array.from({ length: 11 }, (_, attempt) =>
          loginAdmin({
            username: `unknown_${attempt}`,
            password: 'wrong',
            ipAddress: '10.25.0.1',
            requestId: `integration-throttle-${attempt}`,
            now,
          }),
        ),
      );
      const throttle = await getDatabase().adminLoginThrottle.findFirstOrThrow({
        where: { attemptCount: { gte: 11 } },
        orderBy: { updatedAt: 'desc' },
      });

      expect(results.some((result) => result.kind === 'blocked')).toBe(true);
      expect(throttle.attemptCount).toBe(11);
      expect(throttle.blockedUntil).toEqual(
        new Date('2026-08-21T09:30:00.000Z'),
      );
    });

    it('exercises login, session restore and logout through the public REST API', async () => {
      const loginResponse = await loginRoute(
        new Request('http://localhost:3001/api/v1/admin/auth/login', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: 'http://localhost:3000',
            'x-forwarded-for': '10.40.0.1',
          },
          body: JSON.stringify({
            username: 'math_admin',
            password: strongPassword,
          }),
        }),
      );
      const loginBody = successEnvelopeSchema(adminSessionDataSchema).parse(
        await loginResponse.json(),
      );
      const setCookie = loginResponse.headers.get('set-cookie') ?? '';
      const sessionCookie = /__Host-mw_admin=[^;]+/.exec(setCookie)?.[0];

      expect(loginResponse.status).toBe(200);
      expect(sessionCookie).toBeDefined();

      const meResponse = await meRoute(
        new Request('http://localhost:3001/api/v1/admin/me', {
          headers: {
            origin: 'http://localhost:3000',
            cookie: sessionCookie ?? '',
          },
        }),
      );
      const meBody = successEnvelopeSchema(adminSessionDataSchema).parse(
        await meResponse.json(),
      );
      expect(meBody.data.admin).toEqual(loginBody.data.admin);

      const logoutResponse = await logoutRoute(
        new Request('http://localhost:3001/api/v1/admin/auth/logout', {
          method: 'POST',
          headers: {
            origin: 'http://localhost:3000',
            cookie: sessionCookie ?? '',
            'x-csrf-token': meBody.data.csrfToken,
          },
        }),
      );
      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.headers.get('set-cookie')).toContain('Max-Age=0');
    });

    it('stores only token digests, rotates CSRF and revokes logout sessions', async () => {
      const loginResult = await loginAdmin({
        username: 'math_admin',
        password: strongPassword,
        ipAddress: '10.30.0.1',
        requestId: 'integration-login-success',
      });
      expect(loginResult.kind).toBe('success');
      if (loginResult.kind !== 'success') {
        throw new Error('Expected administrator login to succeed');
      }

      const storedSession = await getDatabase().adminSession.findUniqueOrThrow({
        where: { tokenHash: digestToken(loginResult.sessionToken) },
      });
      expect(storedSession.tokenHash).not.toBe(loginResult.sessionToken);
      expect(storedSession.csrfTokenHash).not.toBe(loginResult.csrfToken);

      const restored = await restoreAdminSession({
        sessionToken: loginResult.sessionToken,
      });
      expect(restored.kind).toBe('success');
      if (restored.kind !== 'success') {
        throw new Error('Expected administrator session to be restored');
      }
      expect(restored.csrfToken).not.toBe(loginResult.csrfToken);

      await expect(
        logoutAdmin({
          sessionToken: loginResult.sessionToken,
          csrfToken: 'incorrect-csrf-token',
          requestId: 'integration-bad-csrf',
        }),
      ).resolves.toEqual({ kind: 'csrf-invalid' });
      await expect(
        logoutAdmin({
          sessionToken: loginResult.sessionToken,
          csrfToken: restored.csrfToken,
          requestId: 'integration-logout',
        }),
      ).resolves.toEqual({ kind: 'success' });
      await expect(
        restoreAdminSession({ sessionToken: loginResult.sessionToken }),
      ).resolves.toEqual({ kind: 'unauthorized' });
    });

    it('keeps redacted audit records append-only', async () => {
      const audits = await getDatabase().auditLog.findMany();
      const serialized = JSON.stringify(audits);

      expect(
        audits.some((audit) => audit.action === 'ADMIN_LOGIN_SUCCEEDED'),
      ).toBe(true);
      expect(
        audits.some((audit) => audit.action === 'ADMIN_LOGIN_FAILED'),
      ).toBe(true);
      expect(serialized).not.toContain(strongPassword);
      expect(serialized).not.toContain('incorrect-csrf-token');

      const auditId = audits[0]?.id;
      expect(auditId).toBeDefined();
      await expect(
        getDatabase()
          .$executeRaw`UPDATE audit_logs SET action = 'TAMPERED' WHERE id = ${auditId}`,
      ).rejects.toThrow(/append-only/i);
      await expect(
        getDatabase().$executeRaw`DELETE FROM audit_logs WHERE id = ${auditId}`,
      ).rejects.toThrow(/append-only/i);
    });
  },
  30_000,
);
