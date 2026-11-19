import { defineConfig, devices } from '@playwright/test'
import { fixtureServer } from './playwright.config'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'form-accessibility.spec.ts',
  workers: 1,
  use: {
    baseURL: fixtureServer.url,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'webkit-desktop', use: { ...devices['Desktop Safari'] } },
    { name: 'webkit-mobile', use: { ...devices['iPhone 13'] } },
  ],
  webServer: fixtureServer,
})
