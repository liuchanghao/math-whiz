import { expect, test } from '@playwright/test';

test('administrator can log in, restore the protected console and log out', async ({
  context,
  page,
}) => {
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
