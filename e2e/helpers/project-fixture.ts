import { expect, type APIRequestContext } from '@playwright/test';
import { authHeaders } from './auth';
import { E2E_API_PREFIX } from './env';

export interface TestProjectFixture {
  projectId: string;
  quoteId: string;
  projectName: string;
  contactEmail: string;
}

interface CatalogItem {
  id: string;
  name: string;
}

/**
 * Creates a non-demo project with seeded inventory via the public quote flow + admin APIs.
 * Requires backend + DB with catalog seed data (npm run db:setup, backend start:dev).
 */
export async function createTestProjectWithInventory(
  request: APIRequestContext,
  token: string,
  options: { pieceCount?: number } = {},
): Promise<TestProjectFixture> {
  const stamp = Date.now();
  const suffix = Math.random().toString(36).slice(2, 8);
  const contactEmail = `e2e+${stamp}-${suffix}@example.com`;
  const projectName = `E2E Project ${stamp}`;

  const catalogRes = await request.get(`${E2E_API_PREFIX}/catalog/pieces`);
  expect(catalogRes.ok(), 'Catalog API unavailable — is the backend running?').toBeTruthy();
  const catalog = (await catalogRes.json()) as CatalogItem[];
  expect(catalog.length, 'Piece catalog is empty — run db setup / backend seed').toBeGreaterThan(0);

  const itemA = catalog[0];
  const itemB = catalog[1] ?? catalog[0];

  const leadRes = await request.post(`${E2E_API_PREFIX}/quotes/lead`, {
    data: {
      contactName: `E2E User ${stamp}`,
      email: contactEmail,
      phone: '(336) 555-0199',
      company: 'E2E Studio',
      serviceType: 'Full white glove',
    },
  });
  expect(leadRes.ok()).toBeTruthy();
  const lead = (await leadRes.json()) as { id: string };

  const completeRes = await request.patch(`${E2E_API_PREFIX}/quotes/${lead.id}`, {
    data: {
      projectDescription: 'Automated E2E test project',
      propertyAddress: '1200 Market St, High Point, NC',
      pickupAddress: '800 Furniture Row, Greensboro, NC',
      preferredDate: '2026-08-15',
      storageMonths: 1,
      storageType: 'standard_climate',
      pickupLocationCount: 1,
      rooms: [
        {
          name: 'Living Room',
          items: [{ catalogItemId: itemA.id, quantity: options.pieceCount ?? 2 }],
        },
        {
          name: 'Primary Bedroom',
          items: [{ catalogItemId: itemB.id, quantity: 1 }],
        },
      ],
    },
  });
  expect(completeRes.ok()).toBeTruthy();

  const designersRes = await request.get(`${E2E_API_PREFIX}/admin/designers`, {
    headers: authHeaders(token),
  });
  expect(designersRes.ok()).toBeTruthy();
  const designers = (await designersRes.json()) as { id: string }[];
  expect(designers.length, 'No designers in seed data').toBeGreaterThan(0);

  const projectRes = await request.post(
    `${E2E_API_PREFIX}/admin/quotes/${lead.id}/create-project`,
    {
      headers: authHeaders(token),
      data: {
        name: projectName,
        designerId: designers[0].id,
      },
    },
  );
  expect(projectRes.ok(), `create-project failed: ${await projectRes.text()}`).toBeTruthy();
  const project = (await projectRes.json()) as { id: string };

  return {
    projectId: project.id,
    quoteId: lead.id,
    projectName,
    contactEmail,
  };
}

export async function createChangeOrderQuote(
  request: APIRequestContext,
  token: string,
  projectId: string,
): Promise<{ quoteId: string }> {
  const res = await request.post(
    `${E2E_API_PREFIX}/admin/projects/${projectId}/change-order-quote`,
    { headers: authHeaders(token) },
  );
  expect(res.ok(), `change-order-quote failed: ${await res.text()}`).toBeTruthy();
  const quote = (await res.json()) as { id: string };
  return { quoteId: quote.id };
}
