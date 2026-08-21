import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  adminSessionDataSchema,
  availableGradeListDataSchema,
  errorEnvelopeSchema,
  prizeSchema,
  successEnvelopeSchema,
} from '@math-whiz/contracts';

import { POST as adminLoginRoute } from '@/app/api/v1/admin/auth/login/route';
import { PUT as setCurrentPrizeRoute } from '@/app/api/v1/admin/grades/[gradeId]/current-prize/route';
import {
  GET as listPrizesRoute,
  POST as createPrizeRoute,
} from '@/app/api/v1/admin/prizes/route';
import { POST as disablePrizeRoute } from '@/app/api/v1/admin/prizes/[prizeId]/disable/route';
import { POST as memberLoginRoute } from '@/app/api/v1/mobile/auth/login/route';
import { GET as listAvailableGradesRoute } from '@/app/api/v1/mobile/grades/route';
import { disconnectDatabase, getDatabase } from '@/src/infrastructure/database';
import { bootstrapAdmin } from '@/src/modules/identity/admin-auth/bootstrap';
import { hashPassword } from '@/src/modules/identity/shared/password';

const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? '';
if (
  process.env.npm_lifecycle_event === 'test:integration' &&
  testDatabaseUrl.length === 0
) {
  throw new Error('TEST_DATABASE_URL is required for integration tests');
}

const integration = describe.runIf(testDatabaseUrl.length > 0);
const adminPassword = 'rewards-admin-password-8Xf7qL2m';
const memberPassword = 'rewards-member-password-6Qp9dK4n';

integration('prizes and available grades with MySQL', () => {
  let adminCookie = '';
  let csrfToken = '';
  let accessToken = '';

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.AUDIT_HMAC_SECRET =
      'integration-test-audit-secret-with-32-characters';
    const database = getDatabase();

    await database.questionGrade.deleteMany();
    await database.question.deleteMany();
    await database.grade.updateMany({
      data: { currentPrizeId: null, status: 'ACTIVE' },
    });
    await database.prizeGrade.deleteMany();
    await database.prize.deleteMany();

    const existingAdmin = await database.admin.findFirst();
    if (existingAdmin === null) {
      await bootstrapAdmin({
        username: 'rewards_admin',
        password: adminPassword,
        requestId: 'rewards-bootstrap',
      });
    } else {
      await database.adminSession.deleteMany({
        where: { adminId: existingAdmin.id },
      });
      await database.admin.update({
        where: { id: existingAdmin.id },
        data: {
          username: 'rewards_admin',
          passwordHash: await hashPassword(adminPassword),
          status: 'ACTIVE',
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });
    }

    const member = await database.member.upsert({
      where: { phone: '13800138000' },
      update: {
        passwordHash: await hashPassword(memberPassword),
        status: 'ACTIVE',
      },
      create: {
        phone: '13800138000',
        passwordHash: await hashPassword(memberPassword),
      },
    });
    await database.memberSession.deleteMany({ where: { memberId: member.id } });

    for (let index = 1; index <= 10; index += 1) {
      await database.question.create({
        data: {
          status: 'ACTIVE',
          grades: { create: { gradeId: 1 } },
        },
      });
    }
    for (let index = 1; index <= 9; index += 1) {
      await database.question.create({
        data: {
          status: 'ACTIVE',
          grades: { create: { gradeId: 2 } },
        },
      });
    }

    const adminLoginResponse = await adminLoginRoute(
      new Request('http://localhost:3001/api/v1/admin/auth/login', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'http://localhost:3000',
          'x-forwarded-for': '10.70.0.1',
        },
        body: JSON.stringify({
          username: 'rewards_admin',
          password: adminPassword,
        }),
      }),
    );
    const adminLogin = successEnvelopeSchema(adminSessionDataSchema).parse(
      await adminLoginResponse.json(),
    ).data;
    adminCookie =
      /__Host-mw_admin=[^;]+/.exec(
        adminLoginResponse.headers.get('set-cookie') ?? '',
      )?.[0] ?? '';
    csrfToken = adminLogin.csrfToken;

    const memberLoginResponse = await memberLoginRoute(
      new Request('http://localhost:3001/api/v1/mobile/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          phone: '13800138000',
          password: memberPassword,
        }),
      }),
    );
    accessToken = (await memberLoginResponse.json()).data.accessToken as string;
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('creates a text-only prize and writes a redacted audit record', async () => {
    const response = await createPrizeRoute(
      new Request('http://localhost:3001/api/v1/admin/prizes', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'http://localhost:3000',
          cookie: adminCookie,
          'x-csrf-token': csrfToken,
          'x-request-id': 'rewards-prize-create',
        },
        body: JSON.stringify({
          name: '数学星球模型',
          description: '一枚适合桌面摆放的实物奖品',
          claimInstructions: '请联系项目维护者线下领取',
          gradeIds: [1, 2],
        }),
      }),
    );
    const created = successEnvelopeSchema(prizeSchema).parse(
      await response.json(),
    ).data;

    expect(created).toMatchObject({
      name: '数学星球模型',
      status: 'ACTIVE',
      gradeIds: [1, 2],
    });
    const audit = await getDatabase().auditLog.findFirstOrThrow({
      where: { requestId: 'rewards-prize-create' },
    });
    expect(JSON.stringify(audit.summary)).not.toContain(created.name);
    expect(audit).toMatchObject({
      action: 'PRIZE_CREATED',
      targetType: 'PRIZE',
      targetId: created.id,
    });
  });

  it('opens only grades meeting status, ten-question and current-prize rules', async () => {
    const prizesResponse = await listPrizesRoute(
      new Request('http://localhost:3001/api/v1/admin/prizes', {
        headers: { origin: 'http://localhost:3000', cookie: adminCookie },
      }),
    );
    const prizeId = (await prizesResponse.json()).data[0].id as string;

    for (const gradeId of [1, 2]) {
      const response = await setCurrentPrizeRoute(
        new Request(
          `http://localhost:3001/api/v1/admin/grades/${gradeId}/current-prize`,
          {
            method: 'PUT',
            headers: {
              'content-type': 'application/json',
              origin: 'http://localhost:3000',
              cookie: adminCookie,
              'x-csrf-token': csrfToken,
              'x-request-id': `rewards-current-prize-${gradeId}`,
            },
            body: JSON.stringify({ prizeId }),
          },
        ),
        { params: Promise.resolve({ gradeId: String(gradeId) }) },
      );
      expect(response.status).toBe(200);
    }

    const response = await listAvailableGradesRoute(
      new Request('http://localhost:3001/api/v1/mobile/grades', {
        headers: { authorization: `Bearer ${accessToken}` },
      }),
    );
    const available = successEnvelopeSchema(availableGradeListDataSchema).parse(
      await response.json(),
    ).data;

    expect(available.map((grade) => grade.id)).toEqual([1]);
    expect(available[0]?.currentPrize.name).toBe('数学星球模型');
  });

  it('rejects an inapplicable prize and disabling a current prize never auto-switches', async () => {
    const database = getDatabase();
    const incompatible = await database.prize.create({
      data: {
        name: '六年级奖品',
        description: '只适用于六年级',
        claimInstructions: '线下领取',
        grades: { create: { gradeId: 6 } },
      },
    });
    const rejected = await setCurrentPrizeRoute(
      new Request('http://localhost:3001/api/v1/admin/grades/1/current-prize', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          origin: 'http://localhost:3000',
          cookie: adminCookie,
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ prizeId: incompatible.id }),
      }),
      { params: Promise.resolve({ gradeId: '1' }) },
    );
    expect(
      errorEnvelopeSchema.parse(await rejected.json()).data.errorCode,
    ).toBe('PRIZE_NOT_APPLICABLE');

    const gradeBefore = await database.grade.findUniqueOrThrow({
      where: { id: 1 },
    });
    const disabled = await disablePrizeRoute(
      new Request(
        `http://localhost:3001/api/v1/admin/prizes/${gradeBefore.currentPrizeId}/disable`,
        {
          method: 'POST',
          headers: {
            origin: 'http://localhost:3000',
            cookie: adminCookie,
            'x-csrf-token': csrfToken,
          },
        },
      ),
      {
        params: Promise.resolve({ prizeId: gradeBefore.currentPrizeId ?? '' }),
      },
    );
    expect(disabled.status).toBe(200);
    await expect(
      database.grade.findUniqueOrThrow({ where: { id: 1 } }),
    ).resolves.toMatchObject({ currentPrizeId: gradeBefore.currentPrizeId });

    const mobileResponse = await listAvailableGradesRoute(
      new Request('http://localhost:3001/api/v1/mobile/grades', {
        headers: { authorization: `Bearer ${accessToken}` },
      }),
    );
    expect((await mobileResponse.json()).data).toEqual([]);
  });
});
