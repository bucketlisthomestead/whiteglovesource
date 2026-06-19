import { test, expect } from '@playwright/test';
import { acceptConfirmDialogs, apiLogin, loginAsAdmin } from '../helpers/auth';
import { createTestProjectWithInventory } from '../helpers/project-fixture';
import { clickProjectTab, openProject, selectProjectLayout } from '../helpers/ui';

test.describe('Scope reduction wizard', () => {
  let projectId: string;

  test.beforeAll(async ({ request }) => {
    const token = await apiLogin(request);
    const fixture = await createTestProjectWithInventory(request, token, { pieceCount: +2 });
    projectId = fixture.projectId;
  });

  test.beforeEach(async ({ page }) => {
    acceptConfirmDialogs(page);
    await loginAsAdmin(page);
  });

  test('selects inventory, previews credit, and creates reduction quote', async ({ page }) => {
    await openProject(page, projectId);
    await selectProjectLayout(page, 'admin');
    await clickProjectTab(page, 'Scope Changes');

    await page.getByRole('button', { name: 'Scope reduction' }).click();
    await expect(page.getByText('Select inventory to remove')).toBeVisible();

    const pieceCheckbox = page
      .getByText('Select inventory to remove')
      .locator('..')
      .getByRole('checkbox')
      .nth(1);
    await pieceCheckbox.check();

    await page.getByRole('button', { name: 'Preview credit line items' }).click();
    await expect(page.getByText('Select quoted line items to credit')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('Selected credit:')).toBeVisible();

    await page.getByRole('button', { name: 'Create reduction quote' }).click();
    await expect(page).toHaveURL(/\/admin\/quotes\/[^/]+\?edit=1/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Scope reduction workflow' })).toBeVisible();
    await expect(page.getByText('Scope reduction')).toBeVisible();
  });

  test('finalizes reduction quote — mark accepted and remove from inventory', async ({
    page,
    request,
  }) => {
    const token = await apiLogin(request);
    const fixture = await createTestProjectWithInventory(request, token);
    await openProject(page, fixture.projectId);
    await selectProjectLayout(page, 'admin');
    await clickProjectTab(page, 'Scope Changes');

    await page.getByRole('button', { name: 'Scope reduction' }).click();
    const pieceCheckbox = page
      .getByText('Select inventory to remove')
      .locator('..')
      .getByRole('checkbox')
      .nth(1);
    await pieceCheckbox.check();
    await page.getByRole('button', { name: 'Preview credit line items' }).click();
    await expect(page.getByText('Select quoted line items to credit')).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('button', { name: 'Create reduction quote' }).click();
    await expect(page.getByRole('heading', { name: 'Scope reduction workflow' })).toBeVisible();

    await page.getByRole('button', { name: 'View', exact: true }).click();
    await page.getByRole('button', { name: 'Mark accepted' }).first().click();
    await expect(page.getByText('Change order marked as accepted')).toBeVisible();

    await page.getByRole('button', { name: 'Remove from project inventory' }).first().click();
    await expect(page.getByText('Scope reduction applied — pieces removed from project')).toBeVisible({
      timeout: 20_000,
    });
  });
});
