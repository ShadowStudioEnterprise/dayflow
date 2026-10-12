import { defineConfig, devices } from '@playwright/test'

// Read-only checks against the final origin. No local server or mocked backend.
export default defineConfig({
  testDir: './e2e',
  testMatch: 'vercel.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 60000,
  outputDir: 'test-results-vercel',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'https://dayflow-by-shadowstudio.vercel.app',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
})
