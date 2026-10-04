import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './e2e',
  testMatch: 'pwa.spec.ts',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60000,
  outputDir: 'test-results-pwa',
  use: {
    // Full Chromium supports worker notifications; the reduced headless shell does not in this environment.
    channel: 'chromium',
    baseURL: 'http://127.0.0.1:4177',
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'pwa-desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'pwa-mobile',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' },
    },
  ],
  webServer: {
    command: 'node scripts/pwa-test-server.mjs',
    url: 'http://127.0.0.1:4177',
    reuseExistingServer: false,
    timeout: 180000,
  },
})
