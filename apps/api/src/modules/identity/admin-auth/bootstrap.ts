import { adminUsernameSchema, type AdminPublic } from '@math-whiz/contracts';

import { getDatabase } from '@/src/infrastructure/database';

import { hashPassword } from './password';

type BootstrapAdminInput = {
  username: string;
  password: string;
  requestId: string;
};

export class AdminAlreadyInitializedError extends Error {
  constructor() {
    super('The system administrator has already been initialized');
    this.name = 'AdminAlreadyInitializedError';
  }
}

export const bootstrapAdmin = async ({
  username: usernameInput,
  password,
  requestId,
}: BootstrapAdminInput): Promise<AdminPublic> => {
  const username = adminUsernameSchema.parse(usernameInput);
  if (password.length < 32) {
    throw new Error(
      'The bootstrap administrator password is not strong enough',
    );
  }

  const database = getDatabase();
  const passwordHash = await hashPassword(password);

  return database.$transaction(async (transaction) => {
    if ((await transaction.admin.count()) > 0) {
      throw new AdminAlreadyInitializedError();
    }

    const admin = await transaction.admin.create({
      data: {
        username,
        passwordHash,
      },
      select: {
        id: true,
        username: true,
      },
    });

    await transaction.auditLog.create({
      data: {
        adminId: admin.id,
        action: 'ADMIN_BOOTSTRAPPED',
        targetType: 'ADMIN',
        targetId: admin.id,
        summary: { username: admin.username },
        requestId,
      },
    });

    return admin;
  });
};
