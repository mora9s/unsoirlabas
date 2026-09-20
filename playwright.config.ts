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
    launchOptions: { executablePath: '/usr/bin/google-chrome' },
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4673 --strictPort',
    url: 'http://127.0.0.1:4673',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
