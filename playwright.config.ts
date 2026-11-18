import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: 'http://127.0.0.1:4673',
    actionTimeout: 7_000,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : {},
  },
  projects: [
    { name: 'production-preview', testIgnore: ['**/media-durability-regressions.spec.ts', '**/integration-storage.spec.ts', '**/integration-exports.spec.ts'] },
    { name: 'durability-dev', testMatch: ['**/media-durability-regressions.spec.ts', '**/integration-storage.spec.ts', '**/integration-exports.spec.ts'], use: { baseURL: 'http://127.0.0.1:4674' } },
  ],
  webServer: [
    {
      command: 'npm run preview -- --host 127.0.0.1 --port 4673 --strictPort',
      url: 'http://127.0.0.1:4673',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 4674 --strictPort',
      url: 'http://127.0.0.1:4674',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
