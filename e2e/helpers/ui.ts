import { expect, type Page } from '@playwright/test';

const LAYOUT_LABELS = {
  classic: 'Classic',
  operations: 'Operations',
  admin: 'Admin',
  compact: 'Compact',
} as const;

export type ProjectLayoutId = keyof typeof LAYOUT_LABELS;

export async function openProject(page: Page, projectId: string) {
  await page.goto(`/project/${projectId}`);
  await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible({ timeout: 20_000 });
}

export async function selectProjectLayout(page: Page, layoutId: ProjectLayoutId) {
  const label = LAYOUT_LABELS[layoutId];
  await page.getByRole('button', { name: /Layout:/ }).click();
  const listbox = page.getByRole('listbox', { name: 'Project layout' });
  await expect(listbox).toBeVisible();
  await listbox.getByRole('option', { name: label, exact: true }).click();
  await expect(page.getByRole('button', { name: new RegExp(`Layout:\\s*${label}`) })).toBeVisible();
}

export async function clickProjectTab(page: Page, tabLabel: string) {
  await page.getByRole('button', { name: tabLabel, exact: true }).click();
}

export async function addCatalogItemToFirstRoom(page: Page) {
  const pieceSelect = page.getByLabel('Add piece from catalogue').locator('select').first();
  await expect(pieceSelect.locator('option')).not.toHaveCount(1, { timeout: 20_000 });
  const firstValue = await pieceSelect.locator('option').nth(1).getAttribute('value');
  expect(firstValue).toBeTruthy();
  await pieceSelect.selectOption(firstValue!);
}
