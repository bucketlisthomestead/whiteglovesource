import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_API_PREFIX } from './env';

export function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function apiLogin(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${E2E_API_PREFIX}/auth/login`, {
    data: { email: E2E_ADMIN_EMAIL, password: E2E_ADMIN_PASSWORD },
  });
  expect(res.ok(), `Admin login failed (${res.status()})`).toBeTruthy();
  const body = (await res.json()) as { accessToken: string };
  return body.accessToken;
}

export async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.waitForURL(/\/(login|admin|projects)(\/|$|\?)/, { timeout: 15_000 });
  if (!page.url().includes('/login')) return;

  await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Email' }).fill(E2E_ADMIN_EMAIL);
  await page.getByLabel('Password').fill(E2E_ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/(admin|projects)/, { timeout: 20_000 });
}

export function acceptConfirmDialogs(page: Page) {
  page.on('dialog', (dialog) => dialog.accept());
}
