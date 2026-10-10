import { defineConfig } from '@playwright/test'
import base from './playwright.config.ts'

// Opt-in diagnostic probes; keep them separate from the functional suite.
export default defineConfig({
  ...base,
  testMatch: '**/sync-startup.probe.ts',
  workers: 1,
  retries: 0,
  outputDir: 'test-results/investigation',
  use: { ...base.use, trace: 'on', screenshot: 'only-on-failure' },
  projects: base.projects
    ?.filter((project) =>
      ['sync-desktop', 'sync-mobile'].includes(project.name!),
    )
    .map((project) => ({ ...project, testMatch: '**/sync-startup.probe.ts' })),
})
