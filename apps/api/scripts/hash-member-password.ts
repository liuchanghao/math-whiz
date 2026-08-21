import { memberNewPasswordSchema } from '@math-whiz/contracts';

import { hashPassword } from '../src/modules/identity/shared/password';

const password = memberNewPasswordSchema.parse(
  process.env.MEMBER_INITIAL_PASSWORD,
);
if (
  process.env.NODE_ENV === 'production' &&
  (password === '123456' || password.length < 12)
) {
  throw new Error('Production member passwords must be unique and strong');
}

process.stdout.write(`${await hashPassword(password)}\n`);
