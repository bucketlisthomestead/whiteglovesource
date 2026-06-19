import { test, expect } from '@playwright/test';
import { acceptConfirmDialogs, apiLogin, loginAsAdmin } from '../helpers/auth';
import {
  createChangeOrderQuote,
  createTestProjectWithInventory,
} from '../helpers/project-fixture';
import {
  addCatalogItemToFirstRoom,
  clickProjectTab,
  openProject,
  selectProjectLayout,
} from '../helpers/ui';

test.describe('Quote finalize — change order workflow', () => {
  let projectId: string;
  let changeOrderQuoteId: string;

  test.beforeAll(async ({ request }) => {
    const token = await apiLogin(request);
    const fixture = await createTestProjectWithInventory(request, token);
    projectId = fixture.projectId;
    const co = await createChangeOrderQuote(request, token, projectId);
    changeOrderQuoteId = co.quoteId;
  });

  test.beforeEach(async ({ page }) => {
    acceptConfirmDialogs(page);
    await loginAsAdmin(page);
  });

  test('mark accepted and add change order to project inventory', async ({ page }) => {
    await page.goto(`/admin/quotes/${changeOrderQuoteId}?edit=1`);
    await expect(page.getByRole('heading', { name: 'Change order workflow' })).toBeVisible({
      timeout: 15_000,
    });

    await addCatalogItemToFirstRoom(page);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Quote saved')).toBeVisible();

    await page.getByRole('button', { name: 'View', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Mark accepted' }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Mark accepted' }).first().click();
    await expect(page.getByText('Change order marked as accepted')).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole('button', { name: 'Add to project inventory' }).first().click();
    await expect(page.getByText('Change order applied — inventory updated on project')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Applied to inventory')).toBeVisible();

    await page.goto(`/project/${projectId}`);
    await selectProjectLayout(page, 'admin');
    await clickProjectTab(page, 'Scope Changes');
    await expect(page.getByText('Applied')).toBeVisible();
  });
});
