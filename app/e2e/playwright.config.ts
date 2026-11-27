import { defineConfig, devices } from '@playwright/test';

/**
 * E2E on the REAL stack (ADR-000 §10, ADR-004 §9): `npm run dev` from app/ starts the real backend
 * (real SQLite, real OpenRouter via the checkout-root .env) and the Angular dev server.
 * No mocks, no request interception (`page.route` / `route.fulfill` are forbidden here).
 */
export default defineConfig({
  testDir: './tests',
  timeout: 240_000,
  expect: { timeout: 120_000 },
  fullyParallel: false,
  workers: 1, // one real backend + real model; keep runs sequential and comparable
  retries: 0,
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: 'http://localhost:4200',
    locale: 'pl-PL',
    timezoneId: 'Europe/Warsaw',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
  webServer: {
    command: 'npm run dev',
    cwd: '..',
    url: 'http://localhost:4200/api/health',
    reuseExistingServer: true,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
