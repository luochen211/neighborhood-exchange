import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', timeout: 60000, fullyParallel: false, workers: 1, retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:3117', browserName: 'chromium', headless: true,
    trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'node tests/e2e/server.mjs', url: 'http://127.0.0.1:3117/api/v1/health',
    reuseExistingServer: false, timeout: 30000, gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 } },
});
