import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.WALKTHROUGH_BASE_URL ?? 'http://localhost:5173';
const headed = process.env.WALKTHROUGH_HEADED === '1';
const debug = process.env.WALKTHROUGH_DEBUG === '1';

export default defineConfig({
  testDir: '.',
  testMatch: 'walkthrough.spec.ts',
  timeout: 420_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../walkthrough-report' }]],
  outputDir: '../walkthrough-results',
  use: {
    baseURL,
    headless: !headed && !debug,
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 800 },
    video: debug ? 'off' : 'on',
    trace: debug ? 'on' : 'off',
    launchOptions: {
      slowMo: Number(process.env.WALKTHROUGH_SLOW_MO ?? (debug ? 400 : 200)),
    },
  },
});
