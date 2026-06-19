import { test, expect } from '@playwright/test';
import { acceptConfirmDialogs, apiLogin, loginAsAdmin } from '../helpers/auth';
import { createTestProjectWithInventory } from '../helpers/project-fixture';
import { clickProjectTab, openProject, selectProjectLayout } from '../helpers/ui';

test.describe('Project layout presets', () => {
  let projectId: string;

  test.beforeAll(async ({ request }) => {
    const token = await apiLogin(request);
    const fixture = await createTestProjectWithInventory(request, token);
    projectId = fixture.projectId;
  });

  test.beforeEach(async ({ page }) => {
    acceptConfirmDialogs(page);
    await loginAsAdmin(page);
    await openProject(page, projectId);
  });

  test('Classic layout shows staging plan and crew schedule tabs', async ({ page }) => {
    await selectProjectLayout(page, 'classic');
    await expect(page.getByRole('button', { name: 'Inventory', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Staging Plan', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Crew Schedule', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Scope Changes', exact: true })).toHaveCount(0);

    await clickProjectTab(page, 'Staging Plan');
    await expect(page.getByRole('heading', { name: 'Scope additions' })).toBeVisible();
  });

  test('Admin layout shows Scope Changes tab with change-order tools', async ({ page }) => {
    await selectProjectLayout(page, 'admin');
    await expect(page.getByRole('button', { name: 'Scope Changes', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Plan & Logistics', exact: true })).toBeVisible();

    await clickProjectTab(page, 'Scope Changes');
    await expect(page.getByRole('heading', { name: 'Scope additions' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Scope reduction' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New change order quote' })).toBeVisible();
  });

  test('Compact layout merges schedule into plan tab', async ({ page }) => {
    await selectProjectLayout(page, 'compact');
    await expect(page.getByRole('button', { name: 'Plan', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Crew Schedule', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Scope Changes', exact: true })).toHaveCount(0);
  });

  test('Layout choice persists after reload', async ({ page }) => {
    await selectProjectLayout(page, 'operations');
    await page.reload();
    await expect(
      page.getByRole('button', { name: /Layout:\s*Operations/ }),
    ).toBeVisible({ timeout: 15_000 });
  });
});
