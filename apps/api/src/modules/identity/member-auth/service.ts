import type { MemberPublic, MemberSessionData } from '@math-whiz/contracts';

import { getDatabase } from '@/src/infrastructure/database';
import {
  hashPassword,
  verifyPassword,
} from '@/src/modules/identity/shared/password';
import {
  createOpaqueToken,
  digestToken,
} from '@/src/modules/identity/shared/token';

const MEMBER_FAILED_LOGIN_LIMIT = 5;
const MEMBER_LOCK_DURATION_MS = 15 * 60 * 1000;
const ACCESS_TOKEN_DURATION_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const DUMMY_PASSWORD_HASH =
  'scrypt$32768$8$3$M5OkUHxdbmW5Cti4p0qCIQ$gujxbsCpiOY6OlZJs3OLLsgXLfMDYdU9XPz-OT05TGoZrw4rnTnGDq4gt3ix782WvBhSb01juqUSvuzw1ZNbhQ';
const NON_MEMBER_ID = '00000000-0000-0000-0000-000000000000';

type LoginMemberResult =
  | { kind: 'success'; session: MemberSessionData }
  | { kind: 'invalid-credentials' };

type MemberSessionResult =
  { kind: 'success'; session: MemberSessionData } | { kind: 'invalid-session' };

type AuthenticatedMemberResult =
  | { kind: 'success'; member: MemberPublic; sessionId: string }
  | { kind: 'unauthorized' };

const publicMember = (member: MemberPublic): MemberPublic => ({
  id: member.id,
  phone: member.phone,
});

const createSessionSecrets = (now: Date) => ({
  accessToken: createOpaqueToken(),
  accessTokenExpiresAt: new Date(now.getTime() + ACCESS_TOKEN_DURATION_MS),
  refreshToken: createOpaqueToken(),
  refreshTokenExpiresAt: new Date(now.getTime() + REFRESH_TOKEN_DURATION_MS),
});

export const loginMember = async ({
  phone,
  password,
  now = new Date(),
}: {
  phone: string;
  password: string;
  now?: Date;
}): Promise<LoginMemberResult> => {
  const database = getDatabase();
  const member = await database.member.findUnique({ where: { phone } });

  const passwordMatches = await verifyPassword(
    password,
    member?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );
  const loginIsPaused =
    member?.lockedUntil !== null &&
    member?.lockedUntil !== undefined &&
    member.lockedUntil > now;
  const credentialsValid =
    member !== null &&
    member.status === 'ACTIVE' &&
    !loginIsPaused &&
    passwordMatches;

  if (!credentialsValid) {
    const candidateId = member?.id ?? NON_MEMBER_ID;
    const eligibleForFailureCount = {
      id: candidateId,
      status: 'ACTIVE' as const,
      OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }],
    };
    await database.$transaction(async (transaction) => {
      await transaction.member.updateMany({
        where: eligibleForFailureCount,
        data: { failedLoginCount: { increment: 1 } },
      });
      await transaction.member.updateMany({
        where: {
          ...eligibleForFailureCount,
          failedLoginCount: { gte: MEMBER_FAILED_LOGIN_LIMIT },
        },
        data: {
          lockedUntil: new Date(now.getTime() + MEMBER_LOCK_DURATION_MS),
        },
      });
    });
    return { kind: 'invalid-credentials' };
  }

  const secrets = createSessionSecrets(now);
  await database.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM members WHERE id = ${member.id} FOR UPDATE`;
    await transaction.memberSession.updateMany({
      where: { activeMemberId: member.id, revokedAt: null },
      data: { activeMemberId: null, revokedAt: now },
    });
    await transaction.member.update({
      where: { id: member.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
    await transaction.memberSession.create({
      data: {
        memberId: member.id,
        activeMemberId: member.id,
        accessTokenHash: digestToken(secrets.accessToken),
        accessExpiresAt: secrets.accessTokenExpiresAt,
        refreshTokenHash: digestToken(secrets.refreshToken),
        refreshExpiresAt: secrets.refreshTokenExpiresAt,
      },
    });
  });

  return {
    kind: 'success',
    session: {
      member: publicMember(member),
      accessToken: secrets.accessToken,
      accessTokenExpiresAt: secrets.accessTokenExpiresAt.toISOString(),
      refreshToken: secrets.refreshToken,
      refreshTokenExpiresAt: secrets.refreshTokenExpiresAt.toISOString(),
    },
  };
};

export const refreshMemberSession = async ({
  refreshToken,
  now = new Date(),
}: {
  refreshToken: string;
  now?: Date;
}): Promise<MemberSessionResult> => {
  const database = getDatabase();
  const tokenHash = digestToken(refreshToken);
  const candidate = await database.memberSession.findUnique({
    where: { refreshTokenHash: tokenHash },
    select: { memberId: true },
  });
  if (candidate === null) {
    return { kind: 'invalid-session' };
  }

  return database.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM members WHERE id = ${candidate.memberId} FOR UPDATE`;
    const current = await transaction.memberSession.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: { member: true },
    });
    if (
      current === null ||
      current.revokedAt !== null ||
      current.activeMemberId !== current.memberId ||
      current.refreshExpiresAt <= now ||
      current.member.status !== 'ACTIVE'
    ) {
      if (current?.revokedAt === null) {
        await transaction.memberSession.update({
          where: { id: current.id },
          data: { activeMemberId: null, revokedAt: now },
        });
      }
      return { kind: 'invalid-session' } as const;
    }

    const secrets = createSessionSecrets(now);
    await transaction.memberSession.update({
      where: { id: current.id },
      data: { activeMemberId: null, revokedAt: now },
    });
    await transaction.memberSession.create({
      data: {
        memberId: current.memberId,
        activeMemberId: current.memberId,
        accessTokenHash: digestToken(secrets.accessToken),
        accessExpiresAt: secrets.accessTokenExpiresAt,
        refreshTokenHash: digestToken(secrets.refreshToken),
        refreshExpiresAt: secrets.refreshTokenExpiresAt,
        rotatedFromSessionId: current.id,
      },
    });

    return {
      kind: 'success',
      session: {
        member: publicMember(current.member),
        accessToken: secrets.accessToken,
        accessTokenExpiresAt: secrets.accessTokenExpiresAt.toISOString(),
        refreshToken: secrets.refreshToken,
        refreshTokenExpiresAt: secrets.refreshTokenExpiresAt.toISOString(),
      },
    } as const;
  });
};

export const authenticateMember = async ({
  accessToken,
  now = new Date(),
}: {
  accessToken: string;
  now?: Date;
}): Promise<AuthenticatedMemberResult> => {
  const database = getDatabase();
  const session = await database.memberSession.findUnique({
    where: { accessTokenHash: digestToken(accessToken) },
    include: { member: true },
  });
  if (
    session === null ||
    session.revokedAt !== null ||
    session.activeMemberId !== session.memberId ||
    session.accessExpiresAt <= now ||
    session.member.status !== 'ACTIVE'
  ) {
    if (
      session !== null &&
      session.revokedAt === null &&
      (session.member.status !== 'ACTIVE' || session.refreshExpiresAt <= now)
    ) {
      await database.memberSession.update({
        where: { id: session.id },
        data: { activeMemberId: null, revokedAt: now },
      });
    }
    return { kind: 'unauthorized' };
  }

  return {
    kind: 'success',
    member: publicMember(session.member),
    sessionId: session.id,
  };
};

export const logoutMember = async ({
  refreshToken,
  now = new Date(),
}: {
  refreshToken: string;
  now?: Date;
}) => {
  await getDatabase().memberSession.updateMany({
    where: {
      refreshTokenHash: digestToken(refreshToken),
      revokedAt: null,
    },
    data: { activeMemberId: null, revokedAt: now },
  });
};

export const changeMemberPassword = async ({
  memberId,
  currentPassword,
  newPassword,
  now = new Date(),
}: {
  memberId: string;
  currentPassword: string;
  newPassword: string;
  now?: Date;
}): Promise<
  | { kind: 'success' }
  | { kind: 'invalid-current-password' }
  | { kind: 'unauthorized' }
> => {
  const database = getDatabase();
  const member = await database.member.findUnique({ where: { id: memberId } });
  if (member === null || member.status !== 'ACTIVE') {
    return { kind: 'unauthorized' };
  }
  if (!(await verifyPassword(currentPassword, member.passwordHash))) {
    return { kind: 'invalid-current-password' };
  }

  const passwordHash = await hashPassword(newPassword);
  return database.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM members WHERE id = ${memberId} FOR UPDATE`;
    const current = await transaction.member.findUnique({
      where: { id: memberId },
    });
    if (
      current === null ||
      current.status !== 'ACTIVE' ||
      current.passwordHash !== member.passwordHash
    ) {
      return { kind: 'unauthorized' } as const;
    }

    await transaction.member.update({
      where: { id: memberId },
      data: {
        passwordHash,
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
    await transaction.memberSession.updateMany({
      where: { memberId, revokedAt: null },
      data: { activeMemberId: null, revokedAt: now },
    });
    return { kind: 'success' } as const;
  });
};
