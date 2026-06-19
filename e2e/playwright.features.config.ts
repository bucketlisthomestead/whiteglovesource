import { defineConfig, devices } from '@playwright/test';
import { E2E_BASE_URL } from './helpers/env';

export default defineConfig({
  testDir: './features',
  globalSetup: './global-setup.ts',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL: E2E_BASE_URL,
    headless: process.env.E2E_HEADED !== '1',
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
});
