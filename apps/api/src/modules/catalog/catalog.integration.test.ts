import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  adminSessionDataSchema,
  errorEnvelopeSchema,
  gradeListDataSchema,
  gradeSchema,
  knowledgePointListDataSchema,
  knowledgePointSchema,
  successEnvelopeSchema,
} from '@math-whiz/contracts';

import { GET as listGradesRoute } from '@/app/api/v1/admin/grades/route';
import { PATCH as updateGradeRoute } from '@/app/api/v1/admin/grades/[gradeId]/route';
import { POST as loginRoute } from '@/app/api/v1/admin/auth/login/route';
import {
  GET as listKnowledgePointsRoute,
  POST as createKnowledgePointRoute,
} from '@/app/api/v1/admin/knowledge-points/route';
import {
  GET as getKnowledgePointRoute,
  PATCH as updateKnowledgePointRoute,
} from '@/app/api/v1/admin/knowledge-points/[knowledgePointId]/route';
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
const strongPassword = 'catalog-integration-password-9Bw3qRm7Tz2X';

integration(
  'grade and knowledge-point administration with MySQL',
  () => {
    beforeAll(async () => {
      process.env.DATABASE_URL = testDatabaseUrl;
      process.env.AUDIT_HMAC_SECRET =
        'integration-test-audit-secret-with-32-characters';

      const database = getDatabase();
      await database.knowledgePointGrade.deleteMany();
      await database.knowledgePoint.deleteMany();
      await database.$executeRaw`UPDATE grades SET sort_order = id + 100, status = 'ACTIVE'`;
      await database.$executeRaw`UPDATE grades SET sort_order = id`;
      const existingAdmin = await database.admin.findFirst();
      if (existingAdmin === null) {
        await bootstrapAdmin({
          username: 'catalog_admin',
          password: strongPassword,
          requestId: 'catalog-bootstrap',
        });
      } else {
        await database.adminSession.deleteMany({
          where: { adminId: existingAdmin.id },
        });
        await database.admin.update({
          where: { id: existingAdmin.id },
          data: {
            username: 'catalog_admin',
            passwordHash: await hashPassword(strongPassword),
            status: 'ACTIVE',
            failedLoginCount: 0,
            lockedUntil: null,
          },
        });
      }
    });

    afterAll(async () => {
      await disconnectDatabase();
    });

    it('returns the fixed six-grade catalogue through the protected REST API', async () => {
      const loginResponse = await loginRoute(
        new Request('http://localhost:3001/api/v1/admin/auth/login', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: 'http://localhost:3000',
            'x-forwarded-for': '10.50.0.1',
          },
          body: JSON.stringify({
            username: 'catalog_admin',
            password: strongPassword,
          }),
        }),
      );
      const sessionCookie = /__Host-mw_admin=[^;]+/.exec(
        loginResponse.headers.get('set-cookie') ?? '',
      )?.[0];

      const response = await listGradesRoute(
        new Request('http://localhost:3001/api/v1/admin/grades', {
          headers: {
            origin: 'http://localhost:3000',
            cookie: sessionCookie ?? '',
          },
        }),
      );
      const body = successEnvelopeSchema(gradeListDataSchema).parse(
        await response.json(),
      );

      expect(response.status).toBe(200);
      expect(body.data).toHaveLength(6);
      expect(body.data.map((grade) => grade.id)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('updates an existing grade with CSRF protection and atomic auditing', async () => {
      const loginResponse = await loginRoute(
        new Request('http://localhost:3001/api/v1/admin/auth/login', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: 'http://localhost:3000',
            'x-forwarded-for': '10.50.0.2',
          },
          body: JSON.stringify({
            username: 'catalog_admin',
            password: strongPassword,
          }),
        }),
      );
      const loginBody = successEnvelopeSchema(adminSessionDataSchema).parse(
        await loginResponse.json(),
      );
      const sessionCookie = /__Host-mw_admin=[^;]+/.exec(
        loginResponse.headers.get('set-cookie') ?? '',
      )?.[0];
      const request = new Request(
        'http://localhost:3001/api/v1/admin/grades/1',
        {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            origin: 'http://localhost:3000',
            cookie: sessionCookie ?? '',
            'x-csrf-token': loginBody.data.csrfToken,
            'x-request-id': 'catalog-grade-update',
          },
          body: JSON.stringify({
            name: '一年级',
            sortOrder: 10,
            status: 'DISABLED',
          }),
        },
      );
      const response = await updateGradeRoute(request, {
        params: Promise.resolve({ gradeId: '1' }),
      });
      const body = successEnvelopeSchema(gradeSchema).parse(
        await response.json(),
      );

      expect(body.data).toMatchObject({
        id: 1,
        name: '一年级',
        sortOrder: 10,
        status: 'DISABLED',
      });
      await expect(
        getDatabase().auditLog.findFirstOrThrow({
          where: {
            action: 'GRADE_UPDATED',
            requestId: 'catalog-grade-update',
          },
        }),
      ).resolves.toMatchObject({ targetType: 'GRADE', targetId: '1' });

      const auditCount = await getDatabase().auditLog.count();
      const conflictResponse = await updateGradeRoute(
        new Request('http://localhost:3001/api/v1/admin/grades/2', {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            origin: 'http://localhost:3000',
            cookie: sessionCookie ?? '',
            'x-csrf-token': loginBody.data.csrfToken,
            'x-request-id': 'catalog-grade-conflict',
          },
          body: JSON.stringify({ sortOrder: 10 }),
        }),
        { params: Promise.resolve({ gradeId: '2' }) },
      );
      const conflictBody = errorEnvelopeSchema.parse(
        await conflictResponse.json(),
      );

      expect(conflictResponse.status).toBe(409);
      expect(conflictBody.data.errorCode).toBe('GRADE_SORT_ORDER_CONFLICT');
      await expect(getDatabase().auditLog.count()).resolves.toBe(auditCount);
      await expect(
        getDatabase().grade.findUniqueOrThrow({ where: { id: 2 } }),
      ).resolves.toMatchObject({ sortOrder: 2 });
    });

    it('creates, reads and updates a multi-grade knowledge point with conflict handling', async () => {
      const loginResponse = await loginRoute(
        new Request('http://localhost:3001/api/v1/admin/auth/login', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: 'http://localhost:3000',
            'x-forwarded-for': '10.50.0.3',
          },
          body: JSON.stringify({
            username: 'catalog_admin',
            password: strongPassword,
          }),
        }),
      );
      const loginBody = successEnvelopeSchema(adminSessionDataSchema).parse(
        await loginResponse.json(),
      );
      const sessionCookie = /__Host-mw_admin=[^;]+/.exec(
        loginResponse.headers.get('set-cookie') ?? '',
      )?.[0];
      const headers = {
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
        cookie: sessionCookie ?? '',
        'x-csrf-token': loginBody.data.csrfToken,
      };

      const createResponse = await createKnowledgePointRoute(
        new Request('http://localhost:3001/api/v1/admin/knowledge-points', {
          method: 'POST',
          headers: { ...headers, 'x-request-id': 'catalog-kp-create' },
          body: JSON.stringify({
            name: '20 以内加减法',
            gradeIds: [1, 2],
          }),
        }),
      );
      const created = successEnvelopeSchema(knowledgePointSchema).parse(
        await createResponse.json(),
      ).data;

      expect(created).toMatchObject({
        name: '20 以内加减法',
        status: 'ACTIVE',
        gradeIds: [1, 2],
      });

      const listResponse = await listKnowledgePointsRoute(
        new Request('http://localhost:3001/api/v1/admin/knowledge-points', {
          headers: { origin: headers.origin, cookie: headers.cookie },
        }),
      );
      const listed = successEnvelopeSchema(knowledgePointListDataSchema).parse(
        await listResponse.json(),
      ).data;
      expect(listed).toEqual([created]);

      const getResponse = await getKnowledgePointRoute(
        new Request(
          `http://localhost:3001/api/v1/admin/knowledge-points/${created.id}`,
          { headers: { origin: headers.origin, cookie: headers.cookie } },
        ),
        { params: Promise.resolve({ knowledgePointId: created.id }) },
      );
      expect(
        successEnvelopeSchema(knowledgePointSchema).parse(
          await getResponse.json(),
        ).data,
      ).toEqual(created);

      const updateResponse = await updateKnowledgePointRoute(
        new Request(
          `http://localhost:3001/api/v1/admin/knowledge-points/${created.id}`,
          {
            method: 'PATCH',
            headers: { ...headers, 'x-request-id': 'catalog-kp-update' },
            body: JSON.stringify({
              name: '百以内加减法',
              gradeIds: [2, 3],
              status: 'DISABLED',
            }),
          },
        ),
        { params: Promise.resolve({ knowledgePointId: created.id }) },
      );
      const updated = successEnvelopeSchema(knowledgePointSchema).parse(
        await updateResponse.json(),
      ).data;
      expect(updated).toMatchObject({
        id: created.id,
        name: '百以内加减法',
        gradeIds: [2, 3],
        status: 'DISABLED',
      });

      const auditCount = await getDatabase().auditLog.count();
      const conflictResponse = await createKnowledgePointRoute(
        new Request('http://localhost:3001/api/v1/admin/knowledge-points', {
          method: 'POST',
          headers: { ...headers, 'x-request-id': 'catalog-kp-conflict' },
          body: JSON.stringify({ name: '百以内加减法', gradeIds: [1] }),
        }),
      );
      const conflictBody = errorEnvelopeSchema.parse(
        await conflictResponse.json(),
      );
      expect(conflictResponse.status).toBe(409);
      expect(conflictBody.data.errorCode).toBe('KNOWLEDGE_POINT_NAME_CONFLICT');
      await expect(getDatabase().auditLog.count()).resolves.toBe(auditCount);
      await expect(
        getDatabase().auditLog.count({
          where: {
            action: {
              in: ['KNOWLEDGE_POINT_CREATED', 'KNOWLEDGE_POINT_UPDATED'],
            },
            targetId: created.id,
          },
        }),
      ).resolves.toBe(2);
    });
  },
  30_000,
);
