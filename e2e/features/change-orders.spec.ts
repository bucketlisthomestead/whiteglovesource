import { test, expect } from '@playwright/test';
import { acceptConfirmDialogs, apiLogin, loginAsAdmin } from '../helpers/auth';
import { createTestProjectWithInventory } from '../helpers/project-fixture';
import {
  addCatalogItemToFirstRoom,
  clickProjectTab,
  openProject,
  selectProjectLayout,
} from '../helpers/ui';

test.describe('Change orders on projects', () => {
  let projectId: string;

  test.beforeAll(async ({ request }) => {
    const token = await apiLogin(request);
    const fixture = await createTestProjectWithInventory(request, token);
    projectId = fixture.projectId;
  });

  test.beforeEach(async ({ page }) => {
    acceptConfirmDialogs(page);
    await loginAsAdmin(page);
  });

  test('creates change order quote from project and lists it on Scope Changes tab', async ({
    page,
  }) => {
    await openProject(page, projectId);
    await selectProjectLayout(page, 'admin');
    await clickProjectTab(page, 'Scope Changes');

    await page.getByRole('button', { name: 'New change order quote' }).click();
    await expect(page).toHaveURL(/\/admin\/quotes\/[^/]+\?edit=1/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Change order workflow' })).toBeVisible();

    await addCatalogItemToFirstRoom(page);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Quote saved')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('link', { name: /Change order for project/i }).click();
    await expect(page).toHaveURL(new RegExp(`/project/${projectId}`), { timeout: 15_000 });
    await clickProjectTab(page, 'Scope Changes');

    await expect(page.getByText('Addition')).toBeVisible();
    await expect(page.getByRole('link', { name: /Open quote/i })).toBeVisible();
    await expect(page.getByText(/Awaiting approval|Quoted|Pending/i).first()).toBeVisible();
  });
});
