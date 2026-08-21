import { describe, expect, it } from 'vitest';

import {
  generateStrongPassword,
  hashPassword,
  verifyPassword,
} from './password';

describe('administrator password security', () => {
  it('stores only a salted adaptive password hash', async () => {
    const password = 'Correct-Horse-Battery-Staple-42';
    const hash = await hashPassword(password);

    expect(hash).toMatch(/^scrypt\$/);
    expect(hash).not.toContain(password);
    await expect(verifyPassword(password, hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });

  it('rejects malformed stored hashes without throwing', async () => {
    await expect(verifyPassword('anything', 'not-a-hash')).resolves.toBe(false);
  });

  it('generates a high-entropy one-time administrator password', () => {
    const first = generateStrongPassword();
    const second = generateStrongPassword();

    expect(first).toHaveLength(43);
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(second).not.toBe(first);
  });
});
