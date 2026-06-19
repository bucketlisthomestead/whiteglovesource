import { test, expect } from '@playwright/test';

const ADMIN_EMAIL =
  process.env.E2E_ADMIN_EMAIL ?? 'admin@whiteglovedeliverync.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'password123';

test.describe('deploy smoke', () => {
  test('API health returns ok', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { status?: string };
    expect(body.status).toBe('ok');
  });

  test('home page loads', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.ok()).toBeTruthy();
    await expect(page.locator('body')).toBeVisible();
  });

  test('admin can sign in', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'Email' }).fill(ADMIN_EMAIL);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 30_000 });
    await expect(page.locator('body')).toBeVisible();
  });
});
