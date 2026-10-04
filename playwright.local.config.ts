import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'local-backend.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 90000,
  outputDir: 'test-results-local',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4181',
    trace: 'off',
  },
  webServer: {
    command: 'node scripts/local-test-server.mjs',
    url: 'http://127.0.0.1:4181',
    reuseExistingServer: false,
    timeout: 60000,
  },
})
