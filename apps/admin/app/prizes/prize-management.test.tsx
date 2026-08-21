import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PrizeManagement } from './prize-management';

const replace = vi.fn();
const router = { replace };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

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
  currentPrizeId: null,
}));

const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('prize management', () => {
  beforeEach(() => replace.mockReset());

  it('creates, edits and disables a prize after assigning it to a grade', async () => {
    const createdAt = '2026-08-21T10:00:00.000Z';
    const prize = {
      id: 'c4160f28-61a7-4c35-9473-259eef1da179',
      name: '数学星球模型',
      description: '一枚适合桌面摆放的实物奖品',
      claimInstructions: '请联系项目维护者线下领取',
      status: 'ACTIVE' as const,
      gradeIds: [1],
      createdAt,
      updatedAt: createdAt,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/api/v1/admin/me')) return response(adminSession);
        if (
          url.endsWith('/api/v1/admin/grades') &&
          init?.method === undefined
        ) {
          return response({ status: 200, message: '成功', data: grades });
        }
        if (url.endsWith('/api/v1/admin/prizes') && init?.method === 'POST') {
          return response({
            status: 200,
            message: '奖品创建成功',
            data: prize,
          });
        }
        if (url.endsWith('/api/v1/admin/prizes')) {
          return response({ status: 200, message: '成功', data: [] });
        }
        if (
          url.endsWith(`/api/v1/admin/prizes/${prize.id}`) &&
          init?.method === 'PATCH'
        ) {
          return response({
            status: 200,
            message: '奖品更新成功',
            data: { ...prize, name: '数学星球仪' },
          });
        }
        if (url.endsWith(`/api/v1/admin/prizes/${prize.id}/disable`)) {
          return response({
            status: 200,
            message: '奖品已停用',
            data: { ...prize, name: '数学星球仪', status: 'DISABLED' },
          });
        }
        if (url.endsWith(`/api/v1/admin/prizes/${prize.id}/enable`)) {
          return response({
            status: 200,
            message: '奖品已启用',
            data: { ...prize, name: '数学星球仪', status: 'ACTIVE' },
          });
        }
        if (url.endsWith('/api/v1/admin/grades/1/current-prize')) {
          return response({
            status: 200,
            message: '当前奖品设置成功',
            data: { ...grades[0], currentPrizeId: prize.id },
          });
        }
        throw new Error(`Unexpected request: ${url}`);
      }),
    );
    const user = userEvent.setup();
    render(createElement(PrizeManagement));

    await user.type(await screen.findByLabelText('奖品名称'), prize.name);
    await user.type(screen.getByLabelText('奖品说明'), prize.description);
    await user.type(
      screen.getByLabelText('线下领取说明'),
      prize.claimInstructions,
    );
    await user.click(screen.getByLabelText('适用小学一年级'));
    await user.click(screen.getByRole('button', { name: '创建奖品' }));
    expect(await screen.findByDisplayValue(prize.name)).toBeInTheDocument();

    const secondGradeSelect = screen.getByLabelText('小学二年级当前奖品');
    expect(
      within(secondGradeSelect).queryByRole('option', { name: prize.name }),
    ).not.toBeInTheDocument();

    const currentPrizeSelect = screen.getByLabelText('小学一年级当前奖品');
    await user.selectOptions(currentPrizeSelect, prize.id);
    const currentPrizeRow = currentPrizeSelect.closest('.current-prize-row');
    expect(currentPrizeRow).not.toBeNull();
    await user.click(
      within(currentPrizeRow as HTMLElement).getByRole('button', {
        name: '保存当前奖品',
      }),
    );
    await waitFor(() =>
      expect(screen.getByText('当前奖品已保存')).toBeInTheDocument(),
    );

    const prizeEditor = screen.getByRole('group', { name: prize.name });
    const nameInput = within(prizeEditor).getByLabelText('奖品名称');
    await user.clear(nameInput);
    await user.type(nameInput, '数学星球仪');
    await user.click(
      within(prizeEditor).getByRole('button', { name: '保存奖品' }),
    );
    const updatedPrizeEditor = await screen.findByRole('group', {
      name: '数学星球仪',
    });
    await user.click(
      within(updatedPrizeEditor).getByRole('button', { name: '停用奖品' }),
    );
    expect(await screen.findByText('奖品已停用')).toBeInTheDocument();
    expect(
      within(currentPrizeSelect).getByRole('option', {
        name: '数学星球仪（已停用）',
      }),
    ).toBeDisabled();

    await user.click(
      within(updatedPrizeEditor).getByRole('button', { name: '启用奖品' }),
    );
    expect(await screen.findByText('奖品已启用')).toBeInTheDocument();
    expect(
      within(currentPrizeSelect).getByRole('option', { name: '数学星球仪' }),
    ).toBeEnabled();
  });
});
