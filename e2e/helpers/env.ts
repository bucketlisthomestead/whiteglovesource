export const E2E_BASE_URL =
  process.env.E2E_BASE_URL ??
  process.env.BASE_URL ??
  process.env.WALKTHROUGH_BASE_URL ??
  'http://localhost:5173';

/** Backend origin for health checks (bypasses Vite/nginx when set explicitly). */
function defaultE2eApiUrl(baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, '');
  try {
    const u = new URL(base);
    if (
      (u.hostname === 'localhost' || u.hostname === '127.0.0.1') &&
      u.port === '5173'
    ) {
      return 'http://localhost:3001';
    }
  } catch {
    // fall through
  }
  return base;
}

export const E2E_API_URL = (
  process.env.E2E_API_URL ?? defaultE2eApiUrl(E2E_BASE_URL)
).replace(/\/$/, '');

export const E2E_ADMIN_EMAIL =
  process.env.E2E_ADMIN_EMAIL ?? 'admin@whiteglovedeliverync.com';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is required for E2E tests. Set it in your environment (must match DEV_ADMIN_PASSWORD from backend/.env). See e2e/README.md.`,
    );
  }
  return value;
}

export const E2E_ADMIN_PASSWORD = requireEnv('E2E_ADMIN_PASSWORD');

export const E2E_API_PREFIX = process.env.E2E_API_PREFIX ?? '/api';
