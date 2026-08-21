import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginForm } from './login-form';

const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

describe('administrator login form', () => {
  beforeEach(() => {
    replace.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('submits credentials with cookies and enters the protected console', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 200,
          message: '登录成功',
          data: {
            admin: {
              id: '8ca3da70-6101-499a-b4e9-e12bfbca02f8',
              username: 'math_admin',
            },
            csrfToken: 'csrf-token-value-that-is-at-least-32-characters',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const user = userEvent.setup();
    render(createElement(LoginForm));

    await user.type(screen.getByLabelText('管理员账号'), 'math_admin');
    await user.type(screen.getByLabelText('密码'), 'strong-password');
    await user.click(screen.getByRole('button', { name: '登录后台' }));

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/v1/admin/auth/login',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          username: 'math_admin',
          password: 'strong-password',
        }),
      }),
    );
    expect(replace).toHaveBeenCalledWith('/dashboard');
  });

  it('shows the generic API error without revealing the account state', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 401,
          message: '用户名或密码错误',
          data: { errorCode: 'ADMIN_INVALID_CREDENTIALS' },
        }),
        { status: 401, headers: { 'content-type': 'application/json' } },
      ),
    );
    const user = userEvent.setup();
    render(createElement(LoginForm));

    await user.type(screen.getByLabelText('管理员账号'), 'unknown');
    await user.type(screen.getByLabelText('密码'), 'wrong');
    await user.click(screen.getByRole('button', { name: '登录后台' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '用户名或密码错误',
    );
    expect(replace).not.toHaveBeenCalled();
  });
});
