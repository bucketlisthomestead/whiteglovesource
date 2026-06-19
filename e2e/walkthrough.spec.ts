import fs from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';

const ADMIN_EMAIL = process.env.WALKTHROUGH_ADMIN_EMAIL ?? 'admin@whiteglovedeliverync.com';
const ADMIN_PASSWORD = process.env.WALKTHROUGH_ADMIN_PASSWORD ?? 'password123';
const CHAPTER_PAUSE_MS = Number(process.env.WALKTHROUGH_CHAPTER_PAUSE_MS ?? 2500);
const MAILPIT_WEB_URL = process.env.MAILPIT_WEB_URL ?? 'http://localhost:8025';
const MAILPIT_API_URL = process.env.MAILPIT_API_URL ?? 'http://localhost:8025';

const chaptersPath = path.join(__dirname, 'walkthrough.chapters.json');

type WalkthroughChapter = {
  id: string;
  title: string;
};

type MailpitMessageSummary = {
  ID: string;
  Subject?: string;
};

const chapters: WalkthroughChapter[] = JSON.parse(fs.readFileSync(chaptersPath, 'utf8'));

async function showOverlay(page: Page, title: string) {
  await page.evaluate((text) => {
    document.getElementById('wgds-walkthrough-chapter')?.remove();
    const el = document.createElement('div');
    el.id = 'wgds-walkthrough-chapter';
    el.textContent = text;
    el.style.cssText = [
      'position:fixed',
      'top:20px',
      'left:50%',
      'transform:translateX(-50%)',
      'z-index:99999',
      'background:#1c1c1c',
      'color:#f8f5f0',
      'padding:12px 28px',
      'font:600 13px/1.4 ui-sans-serif,system-ui,sans-serif',
      'letter-spacing:0.08em',
      'text-transform:uppercase',
      'border:1px solid rgba(201,169,98,0.45)',
      'box-shadow:0 8px 32px rgba(0,0,0,0.25)',
    ].join(';');
    document.body.appendChild(el);
  }, title);
}

async function narratedChapter(
  page: Page,
  chapterId: string,
  action: () => Promise<Page | void>,
) {
  const chapter = chapters.find((c) => c.id === chapterId);
  if (!chapter) throw new Error(`Unknown chapter: ${chapterId}`);

  await showOverlay(page, chapter.title);
  const activePage = (await action()) ?? page;
  if (activePage !== page) {
    await showOverlay(activePage, chapter.title);
    await activePage.bringToFront();
  }
  if (CHAPTER_PAUSE_MS > 0) {
    await activePage.waitForTimeout(CHAPTER_PAUSE_MS);
  }
  if (activePage !== page && !activePage.isClosed()) {
    await activePage.evaluate(() => document.getElementById('wgds-walkthrough-chapter')?.remove());
    await activePage.close();
  }
}

async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.waitForURL(/\/(login|admin)(\/|$|\?)/, { timeout: 15_000 });
  if (page.url().includes('/admin')) return;

  await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Email' }).fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });
}

async function fetchMailpitMessages() {
  const res = await fetch(`${MAILPIT_API_URL.replace(/\/$/, '')}/api/v1/messages`);
  if (!res.ok) {
    throw new Error(`Mailpit API unavailable (${res.status})`);
  }
  const data = (await res.json()) as { messages?: MailpitMessageSummary[] };
  return data.messages ?? [];
}

async function waitForMailpitMessage(subjectPattern: RegExp, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const messages = await fetchMailpitMessages();
      if (messages.some((m) => m.Subject && subjectPattern.test(m.Subject))) {
        return;
      }
    } catch {
      // Mailpit not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for Mailpit message matching ${subjectPattern}`);
}

async function findMailpitMessageId(subjectPattern: RegExp) {
  const messages = await fetchMailpitMessages();
  const match = messages.find((m) => m.Subject && subjectPattern.test(m.Subject));
  if (!match?.ID) {
    throw new Error(`No Mailpit message found matching ${subjectPattern}`);
  }
  return match.ID;
}

async function openMailpitMessage(appPage: Page, subjectPattern: RegExp) {
  await waitForMailpitMessage(subjectPattern);
  const messageId = await findMailpitMessageId(subjectPattern);
  const mailPage = await appPage.context().newPage();
  await mailPage.goto(`${MAILPIT_WEB_URL.replace(/\/$/, '')}/view/${messageId}`);
  await expect(mailPage.getByText(subjectPattern).first()).toBeVisible({ timeout: 15_000 });
  await expect(mailPage.locator('iframe, pre, .tab-pane.active').first()).toBeVisible({
    timeout: 10_000,
  });
  await mailPage.waitForTimeout(600);
  return mailPage;
}

test.beforeAll(async () => {
  try {
    await fetch(`${MAILPIT_API_URL.replace(/\/$/, '')}/api/v1/messages`, { method: 'DELETE' });
  } catch {
    // Mailpit optional at load time; required before email chapters
  }
});

test('client-to-completion workflow walkthrough', async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());

  const stamp = Date.now();
  const clientEmail = `walkthrough+${stamp}@example.com`;
  const clientName = 'Alex Rivera';

  await narratedChapter(page, '01', async () => {
    await page.goto('/quote');
    await expect(page.getByRole('heading', { name: 'Build Your Quote' })).toBeVisible();
    await page.getByRole('textbox').nth(0).fill(clientName);
    await page.getByRole('textbox').nth(1).fill(clientEmail);
    await page.getByRole('textbox').nth(2).fill('(336) 555-0100');
    await page.getByRole('textbox').nth(3).fill('Rivera Design Studio');
    await page.getByRole('button', { name: 'Continue to Logistics' }).click();
  });

  await narratedChapter(page, '02', async () => {
    await page.getByPlaceholder('Vendor or market address').fill('800 Furniture Row, Greensboro, NC');
    await page.getByPlaceholder('Final install location').fill('1200 Market St, High Point, NC');
    await page.getByRole('button', { name: 'Continue to Pieces' }).click();
    const pieceSelect = page.locator('select').filter({ hasText: 'Select a piece type' }).first();
    await expect(pieceSelect.locator('option')).not.toHaveCount(1, { timeout: 20_000 });
    await pieceSelect.selectOption({ index: 1 });
    await expect(page.getByText('Estimated Total')).toBeVisible({ timeout: 20_000 });
  });

  await narratedChapter(page, '03', async () => {
    await page.getByRole('button', { name: 'Submit Quote Request' }).click();
    await expect(page.getByRole('heading', { name: 'Quote Submitted' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Thank You' })).toBeVisible();
  });

  await narratedChapter(page, '04', async () => {
    await loginAsAdmin(page);
    return openMailpitMessage(page, /Quote Request from Alex Rivera|\[WGS\] Quote Request/i);
  });

  await narratedChapter(page, '05', async () => {
    await page.goto('/admin');
    await expect(page.getByText('In progress')).toBeVisible();
    await expect(page.getByText('Proposals')).toBeVisible();
  });

  await narratedChapter(page, '06', async () => {
    await page.getByRole('link', { name: new RegExp(clientName) }).first().click();
    await expect(page.getByRole('heading', { name: new RegExp(`Quote — ${clientName}`) })).toBeVisible();

    const auditHeading = page.getByRole('heading', { name: 'Audit trail' });
    await expect(auditHeading).toBeVisible({ timeout: 30_000 });
    await auditHeading.scrollIntoViewIfNeeded();
    await expect(
      page.getByText(/No activity recorded yet|Quote updated|Quote sent to client/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  await narratedChapter(page, '07', async () => {
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('Quoted amount ($)').fill('18500');
    await page.getByLabel('Status').selectOption('quoted');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Quote saved')).toBeVisible();
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.getByRole('button', { name: 'Send to client for approval' }).click();
    await expect(page.getByText('Quote sent to client for approval')).toBeVisible({ timeout: 15_000 });
  });

  await narratedChapter(page, '08', async () => {
    return openMailpitMessage(page, /Your White Glove Source Quote|Approval Requested/i);
  });

  await narratedChapter(page, '09', async () => {
    await page.goto('/admin');
    await page.getByRole('link', { name: new RegExp(clientName) }).first().click();
    await page.getByRole('button', { name: 'Edit' }).click();

    const initSection = page.locator('section').filter({ hasText: 'Initialize project' });
    await initSection.scrollIntoViewIfNeeded();

    const designerSelect = initSection.getByRole('combobox', { name: 'Designer' });
    await expect(designerSelect).toBeVisible({ timeout: 15_000 });

    if (!(await designerSelect.inputValue())) {
      await designerSelect.selectOption({ index: 1 });
    }

    await initSection.getByRole('button', { name: 'Create project from quote' }).click();
    await expect(page).toHaveURL(/\/project\//, { timeout: 20_000 });
  });

  await narratedChapter(page, '10', async () => {
    await expect(page.getByRole('heading', { level: 2, name: new RegExp(clientName) })).toBeVisible({
      timeout: 20_000,
    });
    const inventoryTab = page.getByRole('button', { name: 'Inventory', exact: true });
    await expect(inventoryTab).toBeVisible();
    await page.getByRole('heading', { name: 'Inventory Signoffs' }).scrollIntoViewIfNeeded();
  });

  await narratedChapter(page, '11', async () => {
    await page.goto('/demo');
    await expect(page.getByRole('heading', { name: 'Project Portal Preview' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('James & Catherine Morrison')).toBeVisible();
    await page.getByRole('button', { name: 'Staging Plan', exact: true }).click();
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: 'Crew Schedule', exact: true }).click();
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: 'Inventory', exact: true }).click();
    await page.getByRole('heading', { name: 'Inventory Signoffs' }).scrollIntoViewIfNeeded();
  });

  await narratedChapter(page, '12', async () => {
    await page.goto('/projects');
    await page.getByRole('button', { name: 'Completed' }).click();
  });

  await page.evaluate(() => document.getElementById('wgds-walkthrough-chapter')?.remove());
});
