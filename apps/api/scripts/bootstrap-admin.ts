import { randomUUID } from 'node:crypto';
import { rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { adminUsernameSchema } from '@math-whiz/contracts';

import { disconnectDatabase } from '../src/infrastructure/database';
import { bootstrapAdmin } from '../src/modules/identity/admin-auth/bootstrap';
import { generateStrongPassword } from '../src/modules/identity/admin-auth/password';

const username = adminUsernameSchema.parse(process.env.ADMIN_USERNAME);
const outputFileValue = process.env.ADMIN_BOOTSTRAP_OUTPUT_FILE;
if (outputFileValue === undefined || outputFileValue.length === 0) {
  throw new Error('ADMIN_BOOTSTRAP_OUTPUT_FILE is required');
}

const outputFile = resolve(outputFileValue);
const password = generateStrongPassword();
let outputCreated = false;

try {
  await writeFile(
    outputFile,
    `${JSON.stringify({ username, password }, null, 2)}\n`,
    {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    },
  );
  outputCreated = true;

  await bootstrapAdmin({
    username,
    password,
    requestId: randomUUID(),
  });

  console.info(`系统管理员已初始化，凭据已写入受限文件：${outputFile}`);
} catch (error) {
  if (outputCreated) {
    await rm(outputFile, { force: true });
  }

  throw error;
} finally {
  await disconnectDatabase();
}
