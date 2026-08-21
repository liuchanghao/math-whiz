import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CatalogManagement } from './catalog-management';

const replace = vi.fn();
const router = { replace };

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));

const adminSession = {
  status: 200,
  message: '会话有效',
  data: {
    admin: {
      id: '8ca3da70-6101-499a-b4e9-e12bfbca02f8',
      username: 'math_admin',
    },
    csrfToken: 'csrf-token-value-that-is-at-least-32-characters',
  },
};

const grades = Array.from({ length: 6 }, (_, index) => ({
  id: index + 1,
  name: `小学${['一', '二', '三', '四', '五', '六'][index]}年级`,
  sortOrder: index + 1,
  status: 'ACTIVE' as const,
}));

const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('grade and knowledge-point management', () => {
  beforeEach(() => {
    replace.mockReset();
  });

  it('loads all fixed grades and lets the administrator update one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/api/v1/admin/me')) {
          return response(adminSession);
        }
        if (
          url.endsWith('/api/v1/admin/grades') &&
          init?.method === undefined
        ) {
          return response({ status: 200, message: '成功', data: grades });
        }
        if (url.endsWith('/api/v1/admin/knowledge-points')) {
          return response({ status: 200, message: '成功', data: [] });
        }
        if (url.endsWith('/api/v1/admin/grades/1')) {
          return response({
            status: 200,
            message: '年级更新成功',
            data: {
              ...grades[0],
              name: '一年级',
              status: 'DISABLED',
            },
          });
        }
        throw new Error(`Unexpected request: ${url}`);
      }),
    );
    const user = userEvent.setup();
    render(createElement(CatalogManagement));

    const gradeRow = await screen.findByRole('group', {
      name: '小学一年级',
    });
    expect(screen.getAllByRole('group', { name: /小学.年级/ })).toHaveLength(6);
    const nameInput = within(gradeRow).getByLabelText('年级名称');
    await user.clear(nameInput);
    await user.type(nameInput, '一年级');
    await user.selectOptions(
      within(gradeRow).getByLabelText('状态'),
      'DISABLED',
    );
    await user.click(within(gradeRow).getByRole('button', { name: '保存' }));

    await waitFor(() =>
      expect(screen.getByText('年级已保存')).toBeInTheDocument(),
    );
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/v1/admin/grades/1',
      expect.objectContaining({
        method: 'PATCH',
        credentials: 'include',
        headers: expect.objectContaining({
          'x-csrf-token': adminSession.data.csrfToken,
        }),
      }),
    );
  });

  it('creates a knowledge point associated with multiple grades', async () => {
    const createdAt = '2026-08-21T10:00:00.000Z';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/api/v1/admin/me')) {
          return response(adminSession);
        }
        if (url.endsWith('/api/v1/admin/grades')) {
          return response({ status: 200, message: '成功', data: grades });
        }
        if (
          url.endsWith('/api/v1/admin/knowledge-points') &&
          init?.method === 'POST'
        ) {
          return response({
            status: 200,
            message: '知识点创建成功',
            data: {
              id: '9a66746d-e998-4812-8670-f6c2a5529d42',
              name: '20 以内加减法',
              status: 'ACTIVE',
              gradeIds: [1, 2],
              createdAt,
              updatedAt: createdAt,
            },
          });
        }
        if (url.endsWith('/api/v1/admin/knowledge-points')) {
          return response({ status: 200, message: '成功', data: [] });
        }
        throw new Error(`Unexpected request: ${url}`);
      }),
    );
    const user = userEvent.setup();
    render(createElement(CatalogManagement));

    await user.type(
      await screen.findByLabelText('知识点名称'),
      '20 以内加减法',
    );
    await user.click(screen.getByLabelText('适用小学一年级'));
    await user.click(screen.getByLabelText('适用小学二年级'));
    await user.click(screen.getByRole('button', { name: '创建知识点' }));

    expect(
      await screen.findByDisplayValue('20 以内加减法'),
    ).toBeInTheDocument();
    expect(screen.getByText('小学一年级、小学二年级')).toBeInTheDocument();
  });

  it('shows a grade conflict without reporting a successful save', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/api/v1/admin/me')) {
          return response(adminSession);
        }
        if (
          url.endsWith('/api/v1/admin/grades') &&
          init?.method === undefined
        ) {
          return response({ status: 200, message: '成功', data: grades });
        }
        if (url.endsWith('/api/v1/admin/knowledge-points')) {
          return response({ status: 200, message: '成功', data: [] });
        }
        if (url.endsWith('/api/v1/admin/grades/1')) {
          return response(
            {
              status: 409,
              message: '年级排序不能重复',
              data: { errorCode: 'GRADE_SORT_ORDER_CONFLICT' },
            },
            409,
          );
        }
        throw new Error(`Unexpected request: ${url}`);
      }),
    );
    const user = userEvent.setup();
    render(createElement(CatalogManagement));

    const gradeRow = await screen.findByRole('group', {
      name: '小学一年级',
    });
    await user.click(within(gradeRow).getByRole('button', { name: '保存' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '年级排序不能重复',
    );
    expect(screen.queryByText('年级已保存')).not.toBeInTheDocument();
  });
});
