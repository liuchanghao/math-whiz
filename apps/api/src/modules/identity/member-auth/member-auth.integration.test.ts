import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  errorEnvelopeSchema,
  memberMeDataSchema,
  memberRefreshRequestSchema,
  memberSessionDataSchema,
  successEnvelopeSchema,
} from '@math-whiz/contracts';

import { POST as loginRoute } from '@/app/api/v1/mobile/auth/login/route';
import { POST as changePasswordRoute } from '@/app/api/v1/mobile/auth/change-password/route';
import { POST as logoutRoute } from '@/app/api/v1/mobile/auth/logout/route';
import { POST as refreshRoute } from '@/app/api/v1/mobile/auth/refresh/route';
import { GET as meRoute } from '@/app/api/v1/mobile/me/route';
import { disconnectDatabase, getDatabase } from '@/src/infrastructure/database';
import { hashPassword } from '@/src/modules/identity/shared/password';

const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? '';
const testDatabaseName =
  testDatabaseUrl.length > 0
    ? decodeURIComponent(new URL(testDatabaseUrl).pathname.replace(/^\//, ''))
    : '';
if (
  process.env.npm_lifecycle_event === 'test:integration' &&
  testDatabaseUrl.length === 0
) {
  throw new Error('TEST_DATABASE_URL is required for integration tests');
}
if (testDatabaseUrl.length > 0 && !testDatabaseName.endsWith('_test')) {
  throw new Error(
    'Member integration tests require a database ending in _test',
  );
}
const integration = describe.runIf(testDatabaseUrl.length > 0);
const memberPhone = '13800138000';
const initialPassword = '123456';
const changedPassword = 'new-password-789';
let initialPasswordHash = '';

integration(
  'member authentication through the public REST API with MySQL',
  () => {
    beforeAll(async () => {
      process.env.DATABASE_URL = testDatabaseUrl;
      const database = getDatabase();
      await database.memberSession.updateMany({
        data: { activeMemberId: null, rotatedFromSessionId: null },
      });
      await database.memberSession.deleteMany();
      await database.member.deleteMany();
      initialPasswordHash = await hashPassword(initialPassword);
      await database.member.create({
        data: {
          phone: memberPhone,
          passwordHash: initialPasswordHash,
        },
      });
    });

    beforeEach(async () => {
      const database = getDatabase();
      await database.memberSession.updateMany({
        data: { activeMemberId: null, rotatedFromSessionId: null },
      });
      await database.memberSession.deleteMany();
      await database.member.update({
        where: { phone: memberPhone },
        data: {
          passwordHash: initialPasswordHash,
          status: 'ACTIVE',
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });
    });

    afterAll(async () => {
      await disconnectDatabase();
    });

    it('logs in an initialized member without exposing plaintext secrets', async () => {
      const response = await loginRoute(
        new Request('http://localhost:3001/api/v1/mobile/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            phone: memberPhone,
            password: initialPassword,
          }),
        }),
      );
      const body = successEnvelopeSchema(memberSessionDataSchema).parse(
        await response.json(),
      );

      expect(response.status).toBe(200);
      expect(body.data.member.phone).toBe(memberPhone);
      const stored = await getDatabase().member.findUniqueOrThrow({
        where: { phone: memberPhone },
        include: { sessions: true },
      });
      expect(stored.passwordHash).not.toContain(initialPassword);
      expect(stored.sessions).toHaveLength(1);
      expect(stored.sessions[0]?.accessTokenHash).not.toBe(
        body.data.accessToken,
      );
      expect(stored.sessions[0]?.refreshTokenHash).not.toBe(
        body.data.refreshToken,
      );
    });

    it('returns the same public failure for unknown, wrong and disabled members', async () => {
      const requestLogin = (phone: string, password: string) =>
        loginRoute(
          new Request('http://localhost:3001/api/v1/mobile/auth/login', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ phone, password }),
          }),
        );

      const unknown = await requestLogin('13900139000', 'wrong-password');
      const wrong = await requestLogin(memberPhone, 'wrong-password');
      await getDatabase().member.update({
        where: { phone: memberPhone },
        data: { status: 'DISABLED' },
      });
      const disabled = await requestLogin(memberPhone, initialPassword);

      const failures = await Promise.all(
        [unknown, wrong, disabled].map(async (response) => ({
          status: response.status,
          body: errorEnvelopeSchema.parse(await response.json()),
        })),
      );
      expect(failures.map(({ status }) => status)).toEqual([401, 401, 401]);
      expect(failures.map(({ body }) => body.message)).toEqual([
        '手机号或密码错误',
        '手机号或密码错误',
        '手机号或密码错误',
      ]);
      expect(failures.map(({ body }) => body.data.errorCode)).toEqual([
        'MEMBER_INVALID_CREDENTIALS',
        'MEMBER_INVALID_CREDENTIALS',
        'MEMBER_INVALID_CREDENTIALS',
      ]);
    });

    it('rejects a non-normalized phone before authentication', async () => {
      const response = await loginRoute(
        new Request('http://localhost:3001/api/v1/mobile/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            phone: '138 0013 8000',
            password: initialPassword,
          }),
        }),
      );
      const body = errorEnvelopeSchema.parse(await response.json());

      expect(response.status).toBe(400);
      expect(body.data.errorCode).toBe('VALIDATION_ERROR');
      expect(body.data.fields).toContain('phone');
    });

    it('pauses login for fifteen minutes after five consecutive failures', async () => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await loginRoute(
          new Request('http://localhost:3001/api/v1/mobile/auth/login', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              phone: memberPhone,
              password: 'wrong-password',
            }),
          }),
        );
        expect(response.status).toBe(401);
      }

      const stored = await getDatabase().member.findUniqueOrThrow({
        where: { phone: memberPhone },
      });
      expect(stored.failedLoginCount).toBe(5);
      expect((stored.lockedUntil?.getTime() ?? 0) - Date.now()).toBeGreaterThan(
        14 * 60 * 1000,
      );

      const pausedResponse = await loginRoute(
        new Request('http://localhost:3001/api/v1/mobile/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            phone: memberPhone,
            password: initialPassword,
          }),
        }),
      );
      expect(pausedResponse.status).toBe(401);
    });

    it('keeps only the most recent device session active', async () => {
      const login = async () => {
        const response = await loginRoute(
          new Request('http://localhost:3001/api/v1/mobile/auth/login', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              phone: memberPhone,
              password: initialPassword,
            }),
          }),
        );
        return successEnvelopeSchema(memberSessionDataSchema).parse(
          await response.json(),
        ).data;
      };
      const first = await login();
      const second = await login();

      const firstResponse = await meRoute(
        new Request('http://localhost:3001/api/v1/mobile/me', {
          headers: { authorization: `Bearer ${first.accessToken}` },
        }),
      );
      const secondResponse = await meRoute(
        new Request('http://localhost:3001/api/v1/mobile/me', {
          headers: { authorization: `Bearer ${second.accessToken}` },
        }),
      );
      expect(firstResponse.status).toBe(401);
      expect(secondResponse.status).toBe(200);
      await expect(
        getDatabase().memberSession.count({
          where: { activeMemberId: { not: null }, revokedAt: null },
        }),
      ).resolves.toBe(1);
    });

    it('rotates refresh tokens and rejects replay of the previous token', async () => {
      const loginResponse = await loginRoute(
        new Request('http://localhost:3001/api/v1/mobile/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            phone: memberPhone,
            password: initialPassword,
          }),
        }),
      );
      const login = successEnvelopeSchema(memberSessionDataSchema).parse(
        await loginResponse.json(),
      ).data;

      const refreshResponse = await refreshRoute(
        new Request('http://localhost:3001/api/v1/mobile/auth/refresh', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ refreshToken: login.refreshToken }),
        }),
      );
      const refreshed = successEnvelopeSchema(memberSessionDataSchema).parse(
        await refreshResponse.json(),
      ).data;
      expect(refreshed.refreshToken).not.toBe(login.refreshToken);

      const oldMeResponse = await meRoute(
        new Request('http://localhost:3001/api/v1/mobile/me', {
          headers: { authorization: `Bearer ${login.accessToken}` },
        }),
      );
      expect(oldMeResponse.status).toBe(401);

      const newMeResponse = await meRoute(
        new Request('http://localhost:3001/api/v1/mobile/me', {
          headers: { authorization: `Bearer ${refreshed.accessToken}` },
        }),
      );
      expect(
        successEnvelopeSchema(memberMeDataSchema).parse(
          await newMeResponse.json(),
        ).data.member.phone,
      ).toBe(memberPhone);

      const replayResponse = await refreshRoute(
        new Request('http://localhost:3001/api/v1/mobile/auth/refresh', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(
            memberRefreshRequestSchema.parse({
              refreshToken: login.refreshToken,
            }),
          ),
        }),
      );
      expect(replayResponse.status).toBe(401);
      expect(
        errorEnvelopeSchema.parse(await replayResponse.json()).data.errorCode,
      ).toBe('MEMBER_SESSION_INVALID');
    });

    it('rejects refresh immediately after the member is disabled', async () => {
      const loginResponse = await loginRoute(
        new Request('http://localhost:3001/api/v1/mobile/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            phone: memberPhone,
            password: initialPassword,
          }),
        }),
      );
      const session = successEnvelopeSchema(memberSessionDataSchema).parse(
        await loginResponse.json(),
      ).data;
      await getDatabase().member.update({
        where: { phone: memberPhone },
        data: { status: 'DISABLED' },
      });

      const response = await refreshRoute(
        new Request('http://localhost:3001/api/v1/mobile/auth/refresh', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ refreshToken: session.refreshToken }),
        }),
      );
      expect(response.status).toBe(401);
      await expect(
        getDatabase().memberSession.count({
          where: { activeMemberId: { not: null }, revokedAt: null },
        }),
      ).resolves.toBe(0);
    });

    it('revokes the current device session on logout', async () => {
      const loginResponse = await loginRoute(
        new Request('http://localhost:3001/api/v1/mobile/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            phone: memberPhone,
            password: initialPassword,
          }),
        }),
      );
      const session = successEnvelopeSchema(memberSessionDataSchema).parse(
        await loginResponse.json(),
      ).data;

      const logoutResponse = await logoutRoute(
        new Request('http://localhost:3001/api/v1/mobile/auth/logout', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ refreshToken: session.refreshToken }),
        }),
      );
      expect(logoutResponse.status).toBe(200);

      const meResponse = await meRoute(
        new Request('http://localhost:3001/api/v1/mobile/me', {
          headers: { authorization: `Bearer ${session.accessToken}` },
        }),
      );
      expect(meResponse.status).toBe(401);

      const refreshResponse = await refreshRoute(
        new Request('http://localhost:3001/api/v1/mobile/auth/refresh', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ refreshToken: session.refreshToken }),
        }),
      );
      expect(refreshResponse.status).toBe(401);
    });

    it('changes the password after verifying the original and revokes every session', async () => {
      const loginResponse = await loginRoute(
        new Request('http://localhost:3001/api/v1/mobile/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            phone: memberPhone,
            password: initialPassword,
          }),
        }),
      );
      const session = successEnvelopeSchema(memberSessionDataSchema).parse(
        await loginResponse.json(),
      ).data;

      const changeResponse = await changePasswordRoute(
        new Request(
          'http://localhost:3001/api/v1/mobile/auth/change-password',
          {
            method: 'POST',
            headers: {
              authorization: `Bearer ${session.accessToken}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              currentPassword: initialPassword,
              newPassword: changedPassword,
              confirmNewPassword: changedPassword,
            }),
          },
        ),
      );
      expect(changeResponse.status).toBe(200);

      const oldSessionResponse = await meRoute(
        new Request('http://localhost:3001/api/v1/mobile/me', {
          headers: { authorization: `Bearer ${session.accessToken}` },
        }),
      );
      expect(oldSessionResponse.status).toBe(401);

      const oldPasswordResponse = await loginRoute(
        new Request('http://localhost:3001/api/v1/mobile/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            phone: memberPhone,
            password: initialPassword,
          }),
        }),
      );
      expect(oldPasswordResponse.status).toBe(401);

      const newPasswordResponse = await loginRoute(
        new Request('http://localhost:3001/api/v1/mobile/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            phone: memberPhone,
            password: changedPassword,
          }),
        }),
      );
      expect(newPasswordResponse.status).toBe(200);
    });

    it('keeps the current session when the original password is wrong', async () => {
      const loginResponse = await loginRoute(
        new Request('http://localhost:3001/api/v1/mobile/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            phone: memberPhone,
            password: initialPassword,
          }),
        }),
      );
      const session = successEnvelopeSchema(memberSessionDataSchema).parse(
        await loginResponse.json(),
      ).data;

      const response = await changePasswordRoute(
        new Request(
          'http://localhost:3001/api/v1/mobile/auth/change-password',
          {
            method: 'POST',
            headers: {
              authorization: `Bearer ${session.accessToken}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              currentPassword: 'wrong-password',
              newPassword: changedPassword,
              confirmNewPassword: changedPassword,
            }),
          },
        ),
      );
      expect(response.status).toBe(401);

      const meResponse = await meRoute(
        new Request('http://localhost:3001/api/v1/mobile/me', {
          headers: { authorization: `Bearer ${session.accessToken}` },
        }),
      );
      expect(meResponse.status).toBe(200);
    });
  },
  30_000,
);
