import { randomUUID } from 'node:crypto';

import { adminUsernameSchema } from '@math-whiz/contracts';

import {
  disconnectDatabase,
  getDatabase,
} from '../src/infrastructure/database';
import {
  AdminAlreadyInitializedError,
  bootstrapAdmin,
} from '../src/modules/identity/admin-auth/bootstrap';
import { verifyPassword } from '../src/modules/identity/shared/password';

if (process.env.NODE_ENV === 'production') {
  throw new Error('The E2E administrator seeder cannot run in production');
}

const username = adminUsernameSchema.parse(process.env.E2E_ADMIN_USERNAME);
const password = process.env.E2E_ADMIN_PASSWORD;
if (password === undefined || password.length < 32) {
  throw new Error('E2E_ADMIN_PASSWORD must contain at least 32 characters');
}

try {
  await bootstrapAdmin({
    username,
    password,
    requestId: randomUUID(),
  });
} catch (error) {
  if (!(error instanceof AdminAlreadyInitializedError)) {
    throw error;
  }

  const database = getDatabase();
  const admin = await database.admin.findUnique({ where: { username } });
  if (admin === null || !(await verifyPassword(password, admin.passwordHash))) {
    throw new Error('The existing E2E administrator credentials do not match');
  }

  await database.admin.update({
    where: { id: admin.id },
    data: { status: 'ACTIVE', failedLoginCount: 0, lockedUntil: null },
  });
} finally {
  await disconnectDatabase();
}
