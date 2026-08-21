import { describe, expect, it } from 'vitest';

import {
  adminLoginRequestSchema,
  adminSessionDataSchema,
  adminUsernameSchema,
} from './admin-auth';

describe('admin authentication contracts', () => {
  it('normalizes and validates an administrator username', () => {
    expect(adminUsernameSchema.parse('  math_admin  ')).toBe('math_admin');
    expect(adminUsernameSchema.safeParse('会员 13800138000').success).toBe(
      false,
    );
  });

  it('rejects unknown login request fields', () => {
    expect(
      adminLoginRequestSchema.safeParse({
        username: 'math_admin',
        password: 'secret',
        role: 'super-admin',
      }).success,
    ).toBe(false);
  });

  it('exposes only the minimal administrator session DTO', () => {
    const data = adminSessionDataSchema.parse({
      admin: {
        id: '8ca3da70-6101-499a-b4e9-e12bfbca02f8',
        username: 'math_admin',
      },
      csrfToken: 'mH3Q6xTRrB67hi6snjguvBXtc7Ix6wM6xGSwukmejrQ',
    });

    expect(data).toEqual({
      admin: {
        id: '8ca3da70-6101-499a-b4e9-e12bfbca02f8',
        username: 'math_admin',
      },
      csrfToken: 'mH3Q6xTRrB67hi6snjguvBXtc7Ix6wM6xGSwukmejrQ',
    });
    expect(data).not.toHaveProperty('passwordHash');
    expect(data).not.toHaveProperty('status');
  });
});
