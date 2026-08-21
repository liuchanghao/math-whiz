import { createHmac } from 'node:crypto';

import type { AdminPublic } from '@math-whiz/contracts';

import { getDatabase } from '@/src/infrastructure/database';

import { verifyPassword } from './password';
import { createOpaqueToken, digestToken, tokensMatch } from './token';

const ADMIN_FAILED_LOGIN_LIMIT = 3;
const ADMIN_LOCK_DURATION_MS = 30 * 60 * 1000;
const IP_ATTEMPT_LIMIT = 10;
const IP_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const DUMMY_PASSWORD_HASH =
  'scrypt$32768$8$3$M5OkUHxdbmW5Cti4p0qCIQ$gujxbsCpiOY6OlZJs3OLLsgXLfMDYdU9XPz-OT05TGoZrw4rnTnGDq4gt3ix782WvBhSb01juqUSvuzw1ZNbhQ';

type LoginAdminInput = {
  username: string;
  password: string;
  ipAddress: string;
  requestId: string;
  now?: Date;
};

type LoginAdminResult =
  | {
      kind: 'success';
      admin: AdminPublic;
      sessionToken: string;
      csrfToken: string;
      expiresAt: Date;
    }
  | { kind: 'invalid-credentials' }
  | { kind: 'blocked' };

type RestoreAdminSessionResult =
  | { kind: 'success'; admin: AdminPublic; csrfToken: string }
  | { kind: 'unauthorized' };

type LogoutAdminResult =
  { kind: 'success' } | { kind: 'unauthorized' } | { kind: 'csrf-invalid' };

const auditHmacSecret = () => {
  const value = process.env.AUDIT_HMAC_SECRET;
  if (value !== undefined && value.length >= 32) {
    return value;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUDIT_HMAC_SECRET must contain at least 32 characters');
  }

  return 'local-development-audit-secret-change-me';
};

const auditFingerprint = (value: string) =>
  createHmac('sha256', auditHmacSecret()).update(value).digest('hex');

const isUniqueConstraintError = (error: unknown) =>
  error instanceof Error &&
  'code' in error &&
  (error as Error & { code?: string }).code === 'P2002';

const recordLoginAudit = async ({
  adminId,
  usernameFingerprint,
  ipFingerprint,
  requestId,
  outcome,
}: {
  adminId?: string;
  usernameFingerprint: string;
  ipFingerprint: string;
  requestId: string;
  outcome: 'SUCCESS' | 'FAILURE';
}) => {
  const database = getDatabase();
  await database.auditLog.create({
    data: {
      adminId,
      action:
        outcome === 'SUCCESS' ? 'ADMIN_LOGIN_SUCCEEDED' : 'ADMIN_LOGIN_FAILED',
      targetType: 'ADMIN_AUTH',
      targetId: usernameFingerprint,
      summary: {
        outcome,
        ipFingerprint,
      },
      requestId,
    },
  });
};

const registerIpAttempt = async (
  fingerprintHash: string,
  now: Date,
): Promise<boolean> => {
  const database = getDatabase();
  try {
    await database.adminLoginThrottle.create({
      data: {
        fingerprintHash,
        windowStartedAt: now,
        attemptCount: 0,
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }
  }

  const current = await database.adminLoginThrottle.findUniqueOrThrow({
    where: { fingerprintHash },
  });
  if (current.blockedUntil !== null && current.blockedUntil > now) {
    return false;
  }

  const windowCutoff = new Date(now.getTime() - IP_ATTEMPT_WINDOW_MS);
  await database.adminLoginThrottle.updateMany({
    where: {
      fingerprintHash,
      windowStartedAt: { lte: windowCutoff },
      OR: [{ blockedUntil: null }, { blockedUntil: { lte: now } }],
    },
    data: {
      windowStartedAt: now,
      attemptCount: 0,
      blockedUntil: null,
    },
  });

  const incremented = await database.adminLoginThrottle.updateMany({
    where: {
      fingerprintHash,
      OR: [{ blockedUntil: null }, { blockedUntil: { lte: now } }],
    },
    data: { attemptCount: { increment: 1 } },
  });
  if (incremented.count === 0) {
    return false;
  }

  const updated = await database.adminLoginThrottle.findUniqueOrThrow({
    where: { fingerprintHash },
  });
  if (updated.attemptCount > IP_ATTEMPT_LIMIT) {
    await database.adminLoginThrottle.updateMany({
      where: {
        fingerprintHash,
        OR: [{ blockedUntil: null }, { blockedUntil: { lte: now } }],
      },
      data: {
        blockedUntil: new Date(now.getTime() + ADMIN_LOCK_DURATION_MS),
      },
    });
    return false;
  }

  return true;
};

export const loginAdmin = async ({
  username,
  password,
  ipAddress,
  requestId,
  now = new Date(),
}: LoginAdminInput): Promise<LoginAdminResult> => {
  const database = getDatabase();
  const ipFingerprint = auditFingerprint(ipAddress);
  const usernameFingerprint = auditFingerprint(username.toLowerCase());

  if (!(await registerIpAttempt(ipFingerprint, now))) {
    await recordLoginAudit({
      usernameFingerprint,
      ipFingerprint,
      requestId,
      outcome: 'FAILURE',
    });
    return { kind: 'blocked' };
  }

  const admin = await database.admin.findUnique({ where: { username } });
  if (
    admin?.lockedUntil !== null &&
    admin?.lockedUntil !== undefined &&
    admin.lockedUntil > now
  ) {
    await verifyPassword(password, admin.passwordHash);
    await recordLoginAudit({
      adminId: admin.id,
      usernameFingerprint,
      ipFingerprint,
      requestId,
      outcome: 'FAILURE',
    });
    return { kind: 'invalid-credentials' };
  }

  const passwordMatches = await verifyPassword(
    password,
    admin?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );
  const credentialsValid =
    admin !== null && admin.status === 'ACTIVE' && passwordMatches;

  if (!credentialsValid) {
    await database.$transaction(async (transaction) => {
      if (admin !== null) {
        const failed = await transaction.admin.update({
          where: { id: admin.id },
          data: { failedLoginCount: { increment: 1 } },
          select: { failedLoginCount: true },
        });
        if (failed.failedLoginCount >= ADMIN_FAILED_LOGIN_LIMIT) {
          await transaction.admin.update({
            where: { id: admin.id },
            data: {
              lockedUntil: new Date(now.getTime() + ADMIN_LOCK_DURATION_MS),
            },
          });
        }
      }

      await transaction.auditLog.create({
        data: {
          adminId: admin?.id,
          action: 'ADMIN_LOGIN_FAILED',
          targetType: 'ADMIN_AUTH',
          targetId: usernameFingerprint,
          summary: { outcome: 'FAILURE', ipFingerprint },
          requestId,
        },
      });
    });

    return { kind: 'invalid-credentials' };
  }

  const sessionToken = createOpaqueToken();
  const csrfToken = createOpaqueToken();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);

  await database.$transaction(async (transaction) => {
    await transaction.admin.update({
      where: { id: admin.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
    await transaction.adminSession.create({
      data: {
        adminId: admin.id,
        tokenHash: digestToken(sessionToken),
        csrfTokenHash: digestToken(csrfToken),
        expiresAt,
        lastSeenAt: now,
      },
    });
    await transaction.auditLog.create({
      data: {
        adminId: admin.id,
        action: 'ADMIN_LOGIN_SUCCEEDED',
        targetType: 'ADMIN_AUTH',
        targetId: usernameFingerprint,
        summary: { outcome: 'SUCCESS', ipFingerprint },
        requestId,
      },
    });
  });

  return {
    kind: 'success',
    admin: { id: admin.id, username: admin.username },
    sessionToken,
    csrfToken,
    expiresAt,
  };
};

export const restoreAdminSession = async ({
  sessionToken,
  now = new Date(),
}: {
  sessionToken: string;
  now?: Date;
}): Promise<RestoreAdminSessionResult> => {
  const database = getDatabase();
  const session = await database.adminSession.findUnique({
    where: { tokenHash: digestToken(sessionToken) },
    include: { admin: true },
  });

  if (
    session === null ||
    session.revokedAt !== null ||
    session.expiresAt <= now ||
    session.admin.status !== 'ACTIVE'
  ) {
    if (session !== null && session.revokedAt === null) {
      await database.adminSession.update({
        where: { id: session.id },
        data: { revokedAt: now },
      });
    }

    return { kind: 'unauthorized' };
  }

  const csrfToken = createOpaqueToken();
  await database.adminSession.update({
    where: { id: session.id },
    data: {
      csrfTokenHash: digestToken(csrfToken),
      lastSeenAt: now,
    },
  });

  return {
    kind: 'success',
    admin: { id: session.admin.id, username: session.admin.username },
    csrfToken,
  };
};

export const logoutAdmin = async ({
  sessionToken,
  csrfToken,
  requestId,
  now = new Date(),
}: {
  sessionToken: string;
  csrfToken: string;
  requestId: string;
  now?: Date;
}): Promise<LogoutAdminResult> => {
  const database = getDatabase();
  const session = await database.adminSession.findUnique({
    where: { tokenHash: digestToken(sessionToken) },
    include: { admin: true },
  });

  if (
    session === null ||
    session.revokedAt !== null ||
    session.expiresAt <= now ||
    session.admin.status !== 'ACTIVE'
  ) {
    return { kind: 'unauthorized' };
  }

  if (!tokensMatch(csrfToken, session.csrfTokenHash)) {
    return { kind: 'csrf-invalid' };
  }

  await database.$transaction([
    database.adminSession.update({
      where: { id: session.id },
      data: { revokedAt: now },
    }),
    database.auditLog.create({
      data: {
        adminId: session.adminId,
        action: 'ADMIN_LOGOUT',
        targetType: 'ADMIN_SESSION',
        targetId: session.id,
        summary: { outcome: 'SUCCESS' },
        requestId,
      },
    }),
  ]);

  return { kind: 'success' };
};
