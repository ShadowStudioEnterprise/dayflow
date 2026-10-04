import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: 4,
  retries: 0,
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'profile-desktop',
      testMatch: '**/profile.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4175' },
    },
    {
      name: 'profile-mobile',
      testMatch: '**/profile.spec.ts',
      use: {
        ...devices['iPhone 13'],
        defaultBrowserType: 'chromium',
        baseURL: 'http://127.0.0.1:4175',
      },
    },
    {
      name: 'organize-desktop',
      testMatch: '**/organize.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4175' },
    },
    {
      name: 'organize-mobile',
      testMatch: '**/organize.spec.ts',
      use: {
        ...devices['iPhone 13'],
        defaultBrowserType: 'chromium',
        baseURL: 'http://127.0.0.1:4175',
      },
    },
    {
      name: 'dashboard-desktop',
      testMatch: '**/dashboard.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4175' },
    },
    {
      name: 'dashboard-mobile',
      testMatch: '**/dashboard.spec.ts',
      use: {
        ...devices['iPhone 13'],
        defaultBrowserType: 'chromium',
        baseURL: 'http://127.0.0.1:4175',
      },
    },
    {
      name: 'sync-desktop',
      testMatch: '**/sync.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4175' },
    },
    {
      name: 'sync-mobile',
      testMatch: '**/sync.spec.ts',
      use: {
        ...devices['iPhone 13'],
        defaultBrowserType: 'chromium',
        baseURL: 'http://127.0.0.1:4175',
      },
    },
    {
      name: 'reminders-desktop',
      testMatch: '**/reminders.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4175' },
    },
    {
      name: 'reminders-mobile',
      testMatch: '**/reminders.spec.ts',
      use: {
        ...devices['iPhone 13'],
        defaultBrowserType: 'chromium',
        baseURL: 'http://127.0.0.1:4175',
      },
    },
    {
      name: 'calendar-desktop',
      testMatch: '**/calendar.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4175' },
    },
    {
      name: 'calendar-mobile',
      testMatch: '**/calendar.spec.ts',
      use: {
        ...devices['iPhone 13'],
        defaultBrowserType: 'chromium',
        baseURL: 'http://127.0.0.1:4175',
      },
    },
    {
      name: 'notes-desktop',
      testMatch: '**/notes.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4175' },
    },
    {
      name: 'notes-mobile',
      testMatch: '**/notes.spec.ts',
      use: {
        ...devices['iPhone 13'],
        defaultBrowserType: 'chromium',
        baseURL: 'http://127.0.0.1:4175',
      },
    },
    {
      name: 'chromium',
      testMatch: '**/foundation.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      testMatch: '**/foundation.spec.ts',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' },
    },
    {
      name: 'tasks-desktop',
      testMatch: '**/tasks.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4175' },
    },
    {
      name: 'tasks-mobile',
      testMatch: '**/tasks.spec.ts',
      use: {
        ...devices['iPhone 13'],
        defaultBrowserType: 'chromium',
        baseURL: 'http://127.0.0.1:4175',
      },
    },
  ],
  webServer: [
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !process.env.CI,
      env: {
        VITE_SUPABASE_URL: '',
        VITE_WEB_PUSH_PUBLIC_KEY: '',
        VITE_SUPABASE_ANON_KEY: '',
        VITE_LOCAL_MAILBOX_URL: '',
      },
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 4175 --strictPort',
      url: 'http://127.0.0.1:4175',
      reuseExistingServer: false,
      env: {
        VITE_SUPABASE_URL: 'https://dayflow-e2e.supabase.co',
        VITE_WEB_PUSH_PUBLIC_KEY: '',
        VITE_SUPABASE_ANON_KEY: 'public-anon-test-key-not-a-secret',
        VITE_LOCAL_MAILBOX_URL: '',
      },
    },
  ],
})
