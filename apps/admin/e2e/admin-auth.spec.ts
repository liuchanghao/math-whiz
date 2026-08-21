import { expect, test } from '@playwright/test';

const logIn = async (page: import('@playwright/test').Page) => {
  await page.goto('/login');
  await page
    .getByLabel('管理员账号')
    .fill(process.env.E2E_ADMIN_USERNAME ?? 'math_admin');
  await page
    .getByLabel('密码')
    .fill(
      process.env.E2E_ADMIN_PASSWORD ??
        'integration-only-password-4vPteuKz2S6Dq9Yx',
    );
  await page.getByRole('button', { name: '登录后台' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
};

test('administrator can log in, restore the protected console and log out', async ({
  context,
  page,
}) => {
  await logIn(page);
  await expect(page.getByText('math_admin')).toBeVisible();
  await expect(page.getByText('后台功能总览')).toBeVisible();

  const sessionCookie = (await context.cookies()).find(
    (cookie) => cookie.name === '__Host-mw_admin',
  );
  expect(sessionCookie).toMatchObject({
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
  });

  await page.reload();
  await expect(page.getByText('后台功能总览')).toBeVisible();

  await page.getByRole('button', { name: '退出登录' }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(
    (await context.cookies()).some(
      (cookie) => cookie.name === '__Host-mw_admin',
    ),
  ).toBe(false);
});

test('administrator can manage current prizes without selecting unavailable prizes', async ({
  page,
}) => {
  await logIn(page);
  await page.goto('/prizes');

  const prizeName = `端到端数学奖品-${Date.now()}`;
  const createForm = page.locator('.catalog-create-card');
  await createForm.getByLabel('奖品名称', { exact: true }).fill(prizeName);
  await createForm
    .getByLabel('奖品说明', { exact: true })
    .fill('用于验证年级当前奖品流程');
  await createForm
    .getByLabel('线下领取说明', { exact: true })
    .fill('请联系项目维护者线下领取');
  await createForm.getByLabel('适用小学一年级').check();
  await createForm.getByRole('button', { name: '创建奖品' }).click();
  await expect(page.getByRole('status')).toContainText('奖品已创建');

  const firstGrade = page.getByLabel('小学一年级当前奖品');
  const secondGrade = page.getByLabel('小学二年级当前奖品');
  await expect(
    firstGrade.getByRole('option', { name: prizeName }),
  ).toBeEnabled();
  await expect(
    secondGrade.getByRole('option', { name: prizeName }),
  ).toHaveCount(0);

  await firstGrade.selectOption({ label: prizeName });
  await firstGrade
    .locator('xpath=ancestor::div[contains(@class,"current-prize-row")]')
    .getByRole('button', { name: '保存当前奖品' })
    .click();
  await expect(page.getByRole('status')).toContainText('当前奖品已保存');

  const editor = page.getByRole('group', { name: prizeName });
  await editor.getByRole('button', { name: '停用奖品' }).click();
  await expect(page.getByRole('status')).toContainText('奖品已停用');
  await expect(
    firstGrade.getByRole('option', { name: `${prizeName}（已停用）` }),
  ).toHaveAttribute('disabled', '');
  await expect(firstGrade).toHaveValue(/.+/);

  await editor.getByRole('button', { name: '启用奖品' }).click();
  await expect(page.getByRole('status')).toContainText('奖品已启用');
  await expect(
    firstGrade.getByRole('option', { name: prizeName }),
  ).toBeEnabled();
});
