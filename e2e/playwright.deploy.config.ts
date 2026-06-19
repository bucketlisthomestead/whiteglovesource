import { defineConfig, devices } from '@playwright/test';

const baseURL =
  process.env.BASE_URL ??
  process.env.WALKTHROUGH_BASE_URL ??
  'http://localhost:5173';

export default defineConfig({
  testDir: '.',
  testMatch: 'deploy-smoke.spec.ts',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL,
    headless: true,
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 800 },
    trace: 'off',
    video: 'off',
  },
});
