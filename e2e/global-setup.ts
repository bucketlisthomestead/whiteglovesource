import { request } from '@playwright/test';
import { E2E_API_PREFIX, E2E_API_URL, E2E_BASE_URL } from './helpers/env';

const healthPath = `${E2E_API_PREFIX}/health`;

export default async function globalSetup() {
  const api = await request.newContext({ baseURL: E2E_API_URL });
  try {
    let health;
    try {
      health = await api.get(healthPath);
    } catch (err) {
      throw new Error(
        `Backend unreachable at ${E2E_API_URL}${healthPath}. ` +
          'Start MySQL (npm run db:setup) and backend (npm run backend:dev).',
        { cause: err },
      );
    }
    if (!health.ok()) {
      throw new Error(
        `API health check failed (${health.status()}) at ${E2E_API_URL}${healthPath}. ` +
          'Ensure MySQL is running (npm run db:setup) and backend started (npm run backend:dev).',
      );
    }
    const body = (await health.json()) as { status?: string };
    if (body.status !== 'ok') {
      throw new Error(`API health returned unexpected status: ${JSON.stringify(body)}`);
    }
  } finally {
    await api.dispose();
  }

  const frontendOrigin = E2E_BASE_URL.replace(/\/$/, '');
  if (E2E_API_URL !== frontendOrigin) {
    const fe = await request.newContext({ baseURL: E2E_BASE_URL });
    try {
      let res;
      try {
        res = await fe.get('/');
      } catch (err) {
        throw new Error(
          `Frontend unreachable at ${E2E_BASE_URL}. Start frontend (npm run frontend:dev).`,
          { cause: err },
        );
      }
      if (!res.ok() && res.status() !== 304) {
        throw new Error(
          `Frontend unreachable at ${E2E_BASE_URL} (${res.status()}). Start frontend (npm run frontend:dev).`,
        );
      }
    } finally {
      await fe.dispose();
    }
  }
}
