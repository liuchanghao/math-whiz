import { describe, expect, it } from 'vitest';

import {
  memberChangePasswordRequestSchema,
  memberLoginRequestSchema,
  memberSessionDataSchema,
} from './member-auth';

describe('member authentication contracts', () => {
  it('accepts only normalized mainland China mobile numbers', () => {
    expect(
      memberLoginRequestSchema.parse({
        phone: '13800138000',
        password: '123456',
      }),
    ).toEqual({ phone: '13800138000', password: '123456' });

    for (const phone of ['12800138000', '138 0013 8000', '+8613800138000']) {
      expect(
        memberLoginRequestSchema.safeParse({ phone, password: '123456' })
          .success,
      ).toBe(false);
    }
  });

  it('requires matching new passwords', () => {
    const result = memberChangePasswordRequestSchema.safeParse({
      currentPassword: '123456',
      newPassword: 'new-password',
      confirmNewPassword: 'different-password',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['confirmNewPassword']);
    }
  });

  it('validates the member and both opaque tokens returned after login', () => {
    expect(
      memberSessionDataSchema.parse({
        member: {
          id: 'b2a33c56-f686-4b2a-8ae1-f0b76c55f135',
          phone: '13800138000',
        },
        accessToken: 'a'.repeat(43),
        accessTokenExpiresAt: '2026-08-21T09:00:00.000Z',
        refreshToken: 'r'.repeat(43),
        refreshTokenExpiresAt: '2026-09-20T09:00:00.000Z',
      }),
    ).toMatchObject({ member: { phone: '13800138000' } });
  });
});
