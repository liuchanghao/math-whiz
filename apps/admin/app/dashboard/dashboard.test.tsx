import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Dashboard } from './dashboard';

const replace = vi.fn();
const router = { replace };

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));

describe('protected administrator dashboard', () => {
  beforeEach(() => {
    replace.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('restores the database session before showing protected content', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 200,
          message: '会话有效',
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

    render(createElement(Dashboard));

    expect(await screen.findByText('math_admin')).toBeInTheDocument();
    expect(screen.getByText('后台功能总览')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/v1/admin/me',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('sends the in-memory CSRF token when logging out', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 200,
            message: '会话有效',
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
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ status: 200, message: '已退出登录', data: null }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    const user = userEvent.setup();
    render(createElement(Dashboard));

    const logoutButton = await screen.findByRole('button', {
      name: '退出登录',
    });
    await waitFor(() => expect(logoutButton).toBeEnabled());
    await user.click(logoutButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/v1/admin/auth/logout',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: {
            'x-csrf-token': 'csrf-token-value-that-is-at-least-32-characters',
          },
        }),
      );
      expect(replace).toHaveBeenCalledWith('/login');
    });
  });
});
