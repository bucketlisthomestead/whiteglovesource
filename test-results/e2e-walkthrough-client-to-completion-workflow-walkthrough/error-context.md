# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/walkthrough.spec.ts >> client-to-completion workflow walkthrough
- Location: e2e/walkthrough.spec.ts:40:5

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/quote", waiting until "load"

```

# Page snapshot

```yaml
- generic [ref=e2]: 1 · Client requests a quote
```

# Test source

```ts
  1   | import { test, expect, type Page } from '@playwright/test';
  2   | 
  3   | const ADMIN_EMAIL = process.env.WALKTHROUGH_ADMIN_EMAIL ?? 'admin@whiteglovedeliverync.com';
  4   | const ADMIN_PASSWORD = process.env.WALKTHROUGH_ADMIN_PASSWORD ?? 'password123';
  5   | 
  6   | async function chapter(page: Page, title: string) {
  7   |   await page.evaluate((text) => {
  8   |     document.getElementById('wgds-walkthrough-chapter')?.remove();
  9   |     const el = document.createElement('div');
  10  |     el.id = 'wgds-walkthrough-chapter';
  11  |     el.textContent = text;
  12  |     el.style.cssText = [
  13  |       'position:fixed',
  14  |       'top:20px',
  15  |       'left:50%',
  16  |       'transform:translateX(-50%)',
  17  |       'z-index:99999',
  18  |       'background:#1c1c1c',
  19  |       'color:#f8f5f0',
  20  |       'padding:12px 28px',
  21  |       'font:600 13px/1.4 ui-sans-serif,system-ui,sans-serif',
  22  |       'letter-spacing:0.08em',
  23  |       'text-transform:uppercase',
  24  |       'border:1px solid rgba(201,169,98,0.45)',
  25  |       'box-shadow:0 8px 32px rgba(0,0,0,0.25)',
  26  |     ].join(';');
  27  |     document.body.appendChild(el);
  28  |   }, title);
  29  |   await page.waitForTimeout(2800);
  30  | }
  31  | 
  32  | async function loginAsAdmin(page: Page) {
  33  |   await page.goto('/login');
  34  |   await page.getByLabel('Email').fill(ADMIN_EMAIL);
  35  |   await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  36  |   await page.getByRole('button', { name: 'Sign In' }).click();
  37  |   await expect(page).toHaveURL(/\/admin/);
  38  | }
  39  | 
  40  | test('client-to-completion workflow walkthrough', async ({ page }) => {
  41  |   page.on('dialog', (dialog) => dialog.accept());
  42  | 
  43  |   const stamp = Date.now();
  44  |   const clientEmail = `walkthrough+${stamp}@example.com`;
  45  |   const clientName = 'Alex Rivera';
  46  | 
  47  |   await chapter(page, '1 · Client requests a quote');
> 48  |   await page.goto('/quote');
      |              ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  49  |   await expect(page.getByRole('heading', { name: 'Build Your Quote' })).toBeVisible();
  50  | 
  51  |   await page.getByLabel('Your Name').fill(clientName);
  52  |   await page.getByLabel('Email').fill(clientEmail);
  53  |   await page.getByLabel('Phone').fill('(336) 555-0100');
  54  |   await page.getByLabel('Design Firm / Company').fill('Rivera Design Studio');
  55  |   await page.getByRole('button', { name: 'Continue to Logistics' }).click();
  56  | 
  57  |   await chapter(page, '2 · Logistics & piece catalogue');
  58  |   await page.getByLabel('Pickup Address').fill('800 Furniture Row, Greensboro, NC');
  59  |   await page.getByLabel('Install Property Address').fill('1200 Market St, High Point, NC');
  60  |   await page.getByRole('button', { name: 'Continue to Pieces' }).click();
  61  | 
  62  |   const pieceSelect = page.locator('select').filter({ hasText: 'Select a piece type' }).first();
  63  |   await expect(pieceSelect.locator('option')).not.toHaveCount(1, { timeout: 20_000 });
  64  |   await pieceSelect.selectOption({ index: 1 });
  65  |   await expect(page.getByText('Estimated Total')).toBeVisible({ timeout: 20_000 });
  66  | 
  67  |   await chapter(page, '3 · Submit quote request');
  68  |   await page.getByRole('button', { name: 'Submit Quote Request' }).click();
  69  |   await expect(page.getByRole('heading', { name: 'Quote Submitted' })).toBeVisible({ timeout: 20_000 });
  70  |   await expect(page.getByRole('heading', { name: 'Thank You' })).toBeVisible();
  71  |   await page.waitForTimeout(1500);
  72  | 
  73  |   await chapter(page, '4 · Admin reviews on dashboard');
  74  |   await loginAsAdmin(page);
  75  |   await expect(page.getByText('In progress')).toBeVisible();
  76  |   await expect(page.getByText('Pending')).toBeVisible();
  77  | 
  78  |   await chapter(page, '5 · Quote detail & audit trail');
  79  |   await page.getByRole('link', { name: new RegExp(clientName) }).first().click();
  80  |   await expect(page.getByRole('heading', { name: new RegExp(`Quote — ${clientName}`) })).toBeVisible();
  81  |   await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  82  |   await expect(page.getByText('Audit trail')).toBeVisible();
  83  |   await page.waitForTimeout(1200);
  84  | 
  85  |   await chapter(page, '6 · Admin quotes & sends for approval');
  86  |   await page.getByRole('button', { name: 'Edit' }).click();
  87  |   await page.getByLabel('Quoted amount ($)').fill('18500');
  88  |   await page.getByLabel('Status').selectOption('quoted');
  89  |   await page.getByRole('button', { name: 'Save changes' }).click();
  90  |   await expect(page.getByText('Quote saved')).toBeVisible();
  91  |   await page.getByRole('button', { name: 'Edit' }).click();
  92  |   await page.getByRole('button', { name: 'Send to client for approval' }).click();
  93  |   await expect(page.getByText('Quote sent to client for approval')).toBeVisible({ timeout: 15_000 });
  94  | 
  95  |   await chapter(page, '7 · Create project from quote');
  96  |   await page.getByRole('button', { name: 'Edit' }).click();
  97  |   await page.getByLabel('Designer').selectOption({ label: /Sarah Whitfield/ });
  98  |   await page.getByRole('button', { name: 'Create project from quote' }).click();
  99  |   await expect(page).toHaveURL(/\/project\//, { timeout: 20_000 });
  100 | 
  101 |   await chapter(page, '8 · New project inventory');
  102 |   await expect(page.getByRole('button', { name: 'Inventory' })).toBeVisible();
  103 |   await page.waitForTimeout(1200);
  104 |   await page.evaluate(() => window.scrollBy(0, 500));
  105 |   await page.waitForTimeout(1200);
  106 | 
  107 |   await chapter(page, '9 · Pickups, schedule & signoffs (demo)');
  108 |   await page.goto('/demo');
  109 |   await expect(page.getByText(/Morrison Lake House/i)).toBeVisible({ timeout: 15_000 });
  110 |   await page.getByRole('button', { name: 'Staging Plan' }).click();
  111 |   await page.waitForTimeout(1200);
  112 |   await page.getByRole('button', { name: 'Crew Schedule' }).click();
  113 |   await page.waitForTimeout(1500);
  114 |   await page.getByRole('button', { name: 'Inventory' }).click();
  115 |   await page.evaluate(() => window.scrollBy(0, 700));
  116 |   await page.waitForTimeout(1500);
  117 | 
  118 |   await chapter(page, '10 · Completed projects');
  119 |   await page.goto('/projects');
  120 |   await page.getByRole('button', { name: 'Completed' }).click();
  121 |   await page.waitForTimeout(2000);
  122 | 
  123 |   await page.evaluate(() => document.getElementById('wgds-walkthrough-chapter')?.remove());
  124 | });
  125 | 
```